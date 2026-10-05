// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./LandNFT.sol";
import "./LandRegistry.sol";

/**
 * @title LandLoan
 * @dev DeFi micro-loan contract using land NFTs as collateral.
 *
 *  Flow:
 *  1. Land owner applies for a loan — land NFT is locked as collateral.
 *  2. Admin/lender approves and funds the loan.
 *  3. Borrower repays principal + interest before deadline.
 *  4. NFT collateral released back to borrower upon full repayment.
 *  5. If deadline passes without repayment → lender claims the NFT.
 */
contract LandLoan is ReentrancyGuard, AccessControl {

    // ─── Roles ───────────────────────────────────────────────────────────────
    bytes32 public constant LENDER_ROLE = keccak256("LENDER_ROLE");
    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN_ROLE");

    // ─── Loan status ──────────────────────────────────────────────────────────
    enum LoanStatus { Applied, Active, Repaid, Defaulted, Rejected }

    // ─── Data structures ──────────────────────────────────────────────────────
    struct Loan {
        uint256    loanId;
        string     parcelId;
        uint256    nftTokenId;
        address    borrower;
        address    lender;
        uint256    principalWei;      // loan amount
        uint256    interestRateBps;   // annual interest in basis points (e.g. 1000 = 10%)
        uint256    durationDays;
        uint256    totalRepayable;    // principal + interest
        uint256    amountRepaid;
        LoanStatus status;
        uint256    appliedAt;
        uint256    fundedAt;
        uint256    deadline;
        uint256    repaidAt;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    LandNFT      public nftContract;
    LandRegistry public registryContract;

    uint256 private _loanCounter;
    mapping(uint256 => Loan)   public loans;
    mapping(string  => uint256) public parcelActiveLoan;  // parcelId → loanId

    uint256 public constant MAX_INTEREST_BPS = 3000; // max 30% annual
    uint256 public constant MAX_DURATION_DAYS = 365;

    // ─── Events ───────────────────────────────────────────────────────────────
    event LoanApplied    (uint256 indexed loanId, string parcelId, address borrower, uint256 amount);
    event LoanApproved   (uint256 indexed loanId, address lender);
    event LoanFunded     (uint256 indexed loanId, uint256 amount);
    event LoanRepayment  (uint256 indexed loanId, uint256 amount, uint256 remaining);
    event LoanFullyRepaid(uint256 indexed loanId, string parcelId, address borrower);
    event LoanDefaulted  (uint256 indexed loanId, string parcelId, address lender);
    event LoanRejected   (uint256 indexed loanId, string reason);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address nftAddress, address registryAddress) {
        nftContract      = LandNFT(nftAddress);
        registryContract = LandRegistry(registryAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE,         msg.sender);
        _grantRole(LENDER_ROLE,        msg.sender);
    }

    // ─── Apply for loan ───────────────────────────────────────────────────────
    /**
     * @notice Land owner applies for a micro-loan using their NFT as collateral.
     * @param parcelId       The parcel being used as collateral.
     * @param principalWei   Amount requested in wei.
     * @param durationDays   Loan repayment period in days.
     */
    function applyForLoan(
        string memory parcelId,
        uint256       principalWei,
        uint256       durationDays
    ) external nonReentrant returns (uint256) {
        require(principalWei > 0,                         "Loan: amount must be > 0");
        require(durationDays > 0 && durationDays <= MAX_DURATION_DAYS, "Loan: invalid duration");
        require(parcelActiveLoan[parcelId] == 0,          "Loan: parcel already has active loan");

        LandRegistry.Parcel memory parcel = registryContract.getParcel(parcelId);
        require(parcel.owner == msg.sender,  "Loan: caller is not parcel owner");
        require(!parcel.isCollateral,        "Loan: parcel already locked");

        uint256 tokenId = nftContract.getTokenByParcel(parcelId);
        require(nftContract.ownerOf(tokenId) == msg.sender, "Loan: caller does not own NFT");

        _loanCounter++;
        uint256 loanId = _loanCounter;

        loans[loanId] = Loan({
            loanId:           loanId,
            parcelId:         parcelId,
            nftTokenId:       tokenId,
            borrower:         msg.sender,
            lender:           address(0),
            principalWei:     principalWei,
            interestRateBps:  1000,              // default 10% — updated on approval
            durationDays:     durationDays,
            totalRepayable:   0,                 // calculated on funding
            amountRepaid:     0,
            status:           LoanStatus.Applied,
            appliedAt:        block.timestamp,
            fundedAt:         0,
            deadline:         0,
            repaidAt:         0
        });

        parcelActiveLoan[parcelId] = loanId;

        emit LoanApplied(loanId, parcelId, msg.sender, principalWei);
        return loanId;
    }

    // ─── Lender approves and funds ────────────────────────────────────────────
    /**
     * @notice Lender approves and funds a loan application.
     *         Borrower's NFT is automatically locked as collateral.
     * @param interestRateBps  Annual interest rate in basis points.
     */
    function approveAndFund(uint256 loanId, uint256 interestRateBps)
        external payable onlyRole(LENDER_ROLE) nonReentrant
    {
        Loan storage l = loans[loanId];
        require(l.status == LoanStatus.Applied,        "Loan: not in applied status");
        require(msg.value == l.principalWei,           "Loan: incorrect funding amount");
        require(interestRateBps <= MAX_INTEREST_BPS,   "Loan: interest rate too high");

        // Calculate total repayable: principal + (principal * rate * duration / 365 / 10000)
        uint256 interest = (l.principalWei * interestRateBps * l.durationDays) / (365 * 10000);
        l.totalRepayable  = l.principalWei + interest;
        l.interestRateBps = interestRateBps;
        l.lender          = msg.sender;
        l.status          = LoanStatus.Active;
        l.fundedAt        = block.timestamp;
        l.deadline        = block.timestamp + (l.durationDays * 1 days);

        // Lock NFT as collateral in registry
        registryContract.lockAsCollateral(l.parcelId, address(this));

        // Transfer ETH loan to borrower
        (bool sent, ) = payable(l.borrower).call{value: msg.value}("");
        require(sent, "Loan: ETH transfer to borrower failed");

        emit LoanApproved(loanId, msg.sender);
        emit LoanFunded(loanId, msg.value);
    }

    // ─── Reject loan ──────────────────────────────────────────────────────────
    function rejectLoan(uint256 loanId, string memory reason)
        external onlyRole(LENDER_ROLE)
    {
        Loan storage l = loans[loanId];
        require(l.status == LoanStatus.Applied, "Loan: not in applied status");
        l.status = LoanStatus.Rejected;
        parcelActiveLoan[l.parcelId] = 0;
        emit LoanRejected(loanId, reason);
    }

    // ─── Repay loan ───────────────────────────────────────────────────────────
    /**
     * @notice Borrower makes a repayment. Can repay in installments.
     *         Full repayment releases the NFT collateral.
     */
    function repayLoan(uint256 loanId) external payable nonReentrant {
        Loan storage l = loans[loanId];
        require(l.status == LoanStatus.Active,    "Loan: not active");
        require(msg.sender == l.borrower,         "Loan: not the borrower");
        require(msg.value > 0,                    "Loan: repayment must be > 0");
        require(block.timestamp <= l.deadline,    "Loan: deadline passed");

        uint256 remaining = l.totalRepayable - l.amountRepaid;
        require(msg.value <= remaining,           "Loan: overpayment");

        l.amountRepaid += msg.value;

        // Forward repayment to lender
        (bool sent, ) = payable(l.lender).call{value: msg.value}("");
        require(sent, "Loan: repayment to lender failed");

        emit LoanRepayment(loanId, msg.value, l.totalRepayable - l.amountRepaid);

        // Check if fully repaid
        if (l.amountRepaid >= l.totalRepayable) {
            l.status   = LoanStatus.Repaid;
            l.repaidAt = block.timestamp;
            parcelActiveLoan[l.parcelId] = 0;

            // Release NFT collateral
            registryContract.releaseCollateral(l.parcelId);

            emit LoanFullyRepaid(loanId, l.parcelId, l.borrower);
        }
    }

    // ─── Claim defaulted collateral ───────────────────────────────────────────
    /**
     * @notice Lender claims the NFT if borrower missed the deadline.
     */
    function claimDefault(uint256 loanId) external nonReentrant {
        Loan storage l = loans[loanId];
        require(l.status == LoanStatus.Active,       "Loan: not active");
        require(msg.sender == l.lender,              "Loan: not the lender");
        require(block.timestamp > l.deadline,        "Loan: deadline not passed");

        l.status = LoanStatus.Defaulted;
        parcelActiveLoan[l.parcelId] = 0;

        // Release from registry collateral lock
        registryContract.releaseCollateral(l.parcelId);

        // Transfer NFT to lender
        nftContract.safeTransferFrom(l.borrower, l.lender, l.nftTokenId);

        emit LoanDefaulted(loanId, l.parcelId, l.lender);
    }

    // ─── View helpers ─────────────────────────────────────────────────────────
    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    function getActiveLoanForParcel(string memory parcelId)
        external view returns (uint256)
    {
        return parcelActiveLoan[parcelId];
    }

    function totalLoans() external view returns (uint256) {
        return _loanCounter;
    }
}
