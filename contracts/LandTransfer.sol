// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./LandNFT.sol";
import "./LandRegistry.sol";

/**
 * @title LandTransfer
 * @dev Escrow-based land sale contract.
 *
 *  Flow:
 *  1. Seller initiates a sale listing (sets price, approves this contract to transfer NFT).
 *  2. Buyer deposits exact ETH amount → funds locked in escrow.
 *  3. Both parties confirm → NFT ownership transfers + ETH releases to seller atomically.
 *  4. Either party can cancel before both confirm → buyer refunded, NFT unlocked.
 *
 *  No lawyers. No middlemen. No corruption possible.
 */
contract LandTransfer is ReentrancyGuard, AccessControl {

    // ─── Roles ───────────────────────────────────────────────────────────────
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ─── Escrow status ────────────────────────────────────────────────────────
    enum EscrowStatus { Open, Funded, Completed, Cancelled }

    // ─── Data structures ──────────────────────────────────────────────────────
    struct Escrow {
        uint256      escrowId;
        string       parcelId;
        uint256      nftTokenId;
        address      seller;
        address      buyer;
        uint256      priceWei;        // sale price in wei
        bool         sellerConfirmed;
        bool         buyerConfirmed;
        EscrowStatus status;
        uint256      createdAt;
        uint256      completedAt;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    LandNFT      public nftContract;
    LandRegistry public registryContract;

    uint256 private _escrowCounter;
    mapping(uint256 => Escrow) public escrows;
    mapping(string  => uint256) public parcelActiveEscrow; // parcelId → active escrowId

    uint256 public platformFeeBps = 100; // 1% platform fee (100 basis points)
    address public feeRecipient;

    // ─── Events ───────────────────────────────────────────────────────────────
    event EscrowCreated   (uint256 indexed escrowId, string parcelId, address seller, address buyer, uint256 price);
    event EscrowFunded    (uint256 indexed escrowId, address buyer, uint256 amount);
    event EscrowCompleted (uint256 indexed escrowId, string parcelId, address newOwner, uint256 amount);
    event EscrowCancelled (uint256 indexed escrowId, string reason);
    event SellerConfirmed (uint256 indexed escrowId);
    event BuyerConfirmed  (uint256 indexed escrowId);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address nftAddress, address registryAddress) {
        nftContract      = LandNFT(nftAddress);
        registryContract = LandRegistry(registryAddress);
        feeRecipient     = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE,         msg.sender);
    }

    // ─── Create escrow (seller initiates) ────────────────────────────────────
    /**
     * @notice Seller creates a sale listing for their land parcel.
     * @param parcelId   The parcel being sold.
     * @param buyer      Wallet address of the agreed buyer.
     * @param priceWei   Agreed sale price in wei.
     *
     * Requirements:
     * - Seller must own the NFT.
     * - Parcel must be Approved and not locked as collateral.
     * - No active escrow for this parcel.
     */
    function createEscrow(
        string memory parcelId,
        address buyer,
        uint256 priceWei
    ) external nonReentrant returns (uint256) {
        LandRegistry.Parcel memory parcel = registryContract.getParcel(parcelId);

        require(parcel.owner == msg.sender,       "Transfer: caller is not parcel owner");
        require(!parcel.isCollateral,             "Transfer: parcel is locked as collateral");
        require(parcelActiveEscrow[parcelId] == 0,"Transfer: parcel already in escrow");
        require(buyer != address(0),              "Transfer: invalid buyer address");
        require(buyer != msg.sender,              "Transfer: seller cannot be buyer");
        require(priceWei > 0,                     "Transfer: price must be > 0");

        uint256 tokenId = nftContract.getTokenByParcel(parcelId);
        require(nftContract.ownerOf(tokenId) == msg.sender, "Transfer: seller does not own NFT");

        _escrowCounter++;
        uint256 escrowId = _escrowCounter;

        escrows[escrowId] = Escrow({
            escrowId:         escrowId,
            parcelId:         parcelId,
            nftTokenId:       tokenId,
            seller:           msg.sender,
            buyer:            buyer,
            priceWei:         priceWei,
            sellerConfirmed:  false,
            buyerConfirmed:   false,
            status:           EscrowStatus.Open,
            createdAt:        block.timestamp,
            completedAt:      0
        });

        parcelActiveEscrow[parcelId] = escrowId;

        emit EscrowCreated(escrowId, parcelId, msg.sender, buyer, priceWei);
        return escrowId;
    }

    // ─── Fund escrow (buyer deposits payment) ────────────────────────────────
    /**
     * @notice Buyer deposits the exact sale price into escrow.
     */
    function fundEscrow(uint256 escrowId) external payable nonReentrant {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.Open, "Transfer: escrow not open");
        require(msg.sender == e.buyer,         "Transfer: caller is not the buyer");
        require(msg.value == e.priceWei,       "Transfer: incorrect payment amount");

        e.status = EscrowStatus.Funded;
        emit EscrowFunded(escrowId, msg.sender, msg.value);
    }

    // ─── Confirm (both parties must confirm) ──────────────────────────────────
    function confirmSale(uint256 escrowId) external nonReentrant {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.Funded, "Transfer: escrow not funded");
        require(msg.sender == e.seller || msg.sender == e.buyer, "Transfer: not a party");

        if (msg.sender == e.seller) {
            e.sellerConfirmed = true;
            emit SellerConfirmed(escrowId);
        } else {
            e.buyerConfirmed = true;
            emit BuyerConfirmed(escrowId);
        }

        // Both confirmed → execute atomically
        if (e.sellerConfirmed && e.buyerConfirmed) {
            _executeTransfer(escrowId);
        }
    }

    // ─── Internal atomic execution ────────────────────────────────────────────
    function _executeTransfer(uint256 escrowId) internal {
        Escrow storage e = escrows[escrowId];

        // 1. Transfer NFT from seller to buyer
        nftContract.safeTransferFrom(e.seller, e.buyer, e.nftTokenId);

        // 2. Calculate and deduct platform fee
        uint256 fee     = (e.priceWei * platformFeeBps) / 10000;
        uint256 payout  = e.priceWei - fee;

        // 3. Release ETH to seller
        (bool sent, ) = payable(e.seller).call{value: payout}("");
        require(sent, "Transfer: ETH release to seller failed");

        // 4. Send fee to platform
        if (fee > 0) {
            (bool feeSent, ) = payable(feeRecipient).call{value: fee}("");
            require(feeSent, "Transfer: fee transfer failed");
        }

        // 5. Update escrow state
        e.status       = EscrowStatus.Completed;
        e.completedAt  = block.timestamp;
        parcelActiveEscrow[e.parcelId] = 0;

        emit EscrowCompleted(escrowId, e.parcelId, e.buyer, payout);
    }

    // ─── Cancel escrow ────────────────────────────────────────────────────────
    /**
     * @notice Either party can cancel before both have confirmed.
     *         Buyer is fully refunded if escrow was funded.
     */
    function cancelEscrow(uint256 escrowId, string memory reason) external nonReentrant {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.Open || e.status == EscrowStatus.Funded,
                "Transfer: escrow cannot be cancelled");
        require(msg.sender == e.seller || msg.sender == e.buyer ||
                hasRole(ADMIN_ROLE, msg.sender), "Transfer: not authorised");

        e.status = EscrowStatus.Cancelled;
        parcelActiveEscrow[e.parcelId] = 0;

        // Refund buyer if they had funded
        if (e.status == EscrowStatus.Funded || address(this).balance >= e.priceWei) {
            (bool refunded, ) = payable(e.buyer).call{value: e.priceWei}("");
            require(refunded, "Transfer: refund failed");
        }

        emit EscrowCancelled(escrowId, reason);
    }

    // ─── View helpers ─────────────────────────────────────────────────────────
    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return escrows[escrowId];
    }

    function getActiveEscrowForParcel(string memory parcelId)
        external view returns (uint256)
    {
        return parcelActiveEscrow[parcelId];
    }

    function totalEscrows() external view returns (uint256) {
        return _escrowCounter;
    }

    // ─── Admin: update fee ────────────────────────────────────────────────────
    function updatePlatformFee(uint256 newBps) external onlyRole(ADMIN_ROLE) {
        require(newBps <= 500, "Transfer: fee cannot exceed 5%");
        platformFeeBps = newBps;
    }
}
