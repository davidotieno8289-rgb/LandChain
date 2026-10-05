// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./LandRegistry.sol";

/**
 * @title DisputeResolution
 * @dev Handles land ownership disputes through a transparent arbitration panel.
 *
 *  Flow:
 *  1. Claimant files a dispute and pays a bond (refunded if they win).
 *  2. Admin assigns 6 arbitrators from the registered arbitrator pool.
 *  3. Each arbitrator votes FOR or AGAINST the claimant.
 *  4. After all 6 vote (or deadline passes), majority rules.
 *  5. Verdict is recorded permanently on-chain.
 *  6. LandRegistry ownership is updated accordingly.
 */
contract DisputeResolution is AccessControl, ReentrancyGuard {

    // ─── Roles ───────────────────────────────────────────────────────────────
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");
    bytes32 public constant ADMIN_ROLE      = keccak256("ADMIN_ROLE");

    // ─── Status enums ─────────────────────────────────────────────────────────
    enum DisputeStatus  { Filed, UnderReview, Resolved, Dismissed }
    enum Verdict        { Pending, ClaimantWins, RespondentWins }

    // ─── Data structures ──────────────────────────────────────────────────────
    struct Dispute {
        uint256       disputeId;
        string        parcelId;
        address       claimant;
        address       respondent;
        string        claimantEvidence;   // IPFS hash of evidence documents
        string        respondentEvidence;
        string        description;
        address[]     arbitrators;        // panel of 6
        mapping(address => bool) hasVoted;
        mapping(address => bool) voteForClaimant; // true = supports claimant
        uint256       votesForClaimant;
        uint256       votesForRespondent;
        DisputeStatus status;
        Verdict       verdict;
        uint256       bondAmount;         // ETH bond paid by claimant
        uint256       filedAt;
        uint256       resolvedAt;
        string        verdictReason;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    LandRegistry public registryContract;

    uint256 private _disputeCounter;
    mapping(uint256 => Dispute) public disputes;
    mapping(string  => uint256) public parcelActiveDispute; // parcelId → disputeId

    address[] public arbitratorPool;

    uint256 public constant ARBITRATOR_COUNT  = 6;
    uint256 public constant DISPUTE_BOND      = 0.01 ether; // refunded if claimant wins
    uint256 public constant VOTING_DEADLINE   = 14 days;

    // ─── Events ───────────────────────────────────────────────────────────────
    event DisputeFiled     (uint256 indexed disputeId, string parcelId, address claimant);
    event ArbitratorsAssigned(uint256 indexed disputeId, address[] arbitrators);
    event VoteCast         (uint256 indexed disputeId, address arbitrator, bool forClaimant);
    event DisputeResolved  (uint256 indexed disputeId, Verdict verdict, string reason);
    event RespondentEvidenceSubmitted(uint256 indexed disputeId);
    event ArbitratorAdded  (address indexed arbitrator);
    event ArbitratorRemoved(address indexed arbitrator);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address registryAddress) {
        registryContract = LandRegistry(registryAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE,         msg.sender);
    }

    // ─── Arbitrator management ────────────────────────────────────────────────
    function addArbitrator(address arb) external onlyRole(ADMIN_ROLE) {
        require(!hasRole(ARBITRATOR_ROLE, arb), "Dispute: already an arbitrator");
        _grantRole(ARBITRATOR_ROLE, arb);
        arbitratorPool.push(arb);
        emit ArbitratorAdded(arb);
    }

    function removeArbitrator(address arb) external onlyRole(ADMIN_ROLE) {
        _revokeRole(ARBITRATOR_ROLE, arb);
        for (uint i = 0; i < arbitratorPool.length; i++) {
            if (arbitratorPool[i] == arb) {
                arbitratorPool[i] = arbitratorPool[arbitratorPool.length - 1];
                arbitratorPool.pop();
                break;
            }
        }
        emit ArbitratorRemoved(arb);
    }

    // ─── File dispute ─────────────────────────────────────────────────────────
    /**
     * @notice Claimant files a dispute against a land parcel's current owner.
     * @param parcelId          ID of the disputed parcel.
     * @param description       Description of the claim.
     * @param evidenceIPFSHash  IPFS hash of supporting documents.
     */
    function fileDispute(
        string memory parcelId,
        string memory description,
        string memory evidenceIPFSHash
    ) external payable nonReentrant {
        require(msg.value == DISPUTE_BOND,               "Dispute: incorrect bond amount");
        require(parcelActiveDispute[parcelId] == 0,      "Dispute: parcel already under dispute");
        require(bytes(description).length > 0,           "Dispute: description required");

        LandRegistry.Parcel memory parcel = registryContract.getParcel(parcelId);
        require(bytes(parcel.parcelId).length > 0,       "Dispute: parcel not found");
        require(parcel.owner != msg.sender,              "Dispute: cannot dispute your own parcel");

        _disputeCounter++;
        uint256 disputeId = _disputeCounter;

        Dispute storage d = disputes[disputeId];
        d.disputeId          = disputeId;
        d.parcelId           = parcelId;
        d.claimant           = msg.sender;
        d.respondent         = parcel.owner;
        d.description        = description;
        d.claimantEvidence   = evidenceIPFSHash;
        d.status             = DisputeStatus.Filed;
        d.verdict            = Verdict.Pending;
        d.bondAmount         = msg.value;
        d.filedAt            = block.timestamp;

        parcelActiveDispute[parcelId] = disputeId;

        // Mark parcel as Disputed in registry
        registryContract.markDisputed(parcelId);

        emit DisputeFiled(disputeId, parcelId, msg.sender);
    }

    // ─── Respondent submits counter-evidence ─────────────────────────────────
    function submitRespondentEvidence(uint256 disputeId, string memory evidenceIPFSHash)
        external
    {
        Dispute storage d = disputes[disputeId];
        require(msg.sender == d.respondent,           "Dispute: not the respondent");
        require(d.status == DisputeStatus.Filed ||
                d.status == DisputeStatus.UnderReview, "Dispute: not in filing stage");
        d.respondentEvidence = evidenceIPFSHash;
        emit RespondentEvidenceSubmitted(disputeId);
    }

    // ─── Admin assigns arbitrators ────────────────────────────────────────────
    /**
     * @notice Admin assigns 6 arbitrators from the pool to review the dispute.
     *         Uses a pseudo-random selection (sufficient for this prototype).
     */
    function assignArbitrators(uint256 disputeId) external onlyRole(ADMIN_ROLE) {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Filed, "Dispute: not in filed status");
        require(arbitratorPool.length >= ARBITRATOR_COUNT, "Dispute: not enough arbitrators");

        // Simple selection — in production use Chainlink VRF for true randomness
        address[] memory selected = new address[](ARBITRATOR_COUNT);
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, disputeId)));
        uint256 poolSize = arbitratorPool.length;
        uint256 count = 0;

        for (uint256 i = 0; i < poolSize && count < ARBITRATOR_COUNT; i++) {
            uint256 idx = (seed + i) % poolSize;
            address candidate = arbitratorPool[idx];
            // Skip claimant and respondent
            if (candidate != d.claimant && candidate != d.respondent) {
                selected[count] = candidate;
                count++;
            }
        }

        require(count == ARBITRATOR_COUNT, "Dispute: could not select enough arbitrators");

        d.arbitrators = selected;
        d.status      = DisputeStatus.UnderReview;

        emit ArbitratorsAssigned(disputeId, selected);
    }

    // ─── Arbitrator votes ─────────────────────────────────────────────────────
    /**
     * @notice Assigned arbitrator casts their vote.
     * @param forClaimant  true = supports claimant, false = supports respondent.
     */
    function castVote(uint256 disputeId, bool forClaimant)
        external onlyRole(ARBITRATOR_ROLE) nonReentrant
    {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.UnderReview, "Dispute: not under review");
        require(!d.hasVoted[msg.sender],               "Dispute: already voted");

        // Check arbitrator is on the assigned panel
        bool isAssigned = false;
        for (uint i = 0; i < d.arbitrators.length; i++) {
            if (d.arbitrators[i] == msg.sender) { isAssigned = true; break; }
        }
        require(isAssigned, "Dispute: not assigned to this dispute");

        d.hasVoted[msg.sender]       = true;
        d.voteForClaimant[msg.sender] = forClaimant;

        if (forClaimant) {
            d.votesForClaimant++;
        } else {
            d.votesForRespondent++;
        }

        emit VoteCast(disputeId, msg.sender, forClaimant);

        // Auto-resolve once all votes are in
        if (d.votesForClaimant + d.votesForRespondent == ARBITRATOR_COUNT) {
            _resolveDispute(disputeId);
        }
    }

    // ─── Admin force-resolve (after deadline) ─────────────────────────────────
    function forceResolve(uint256 disputeId) external onlyRole(ADMIN_ROLE) {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.UnderReview, "Dispute: not under review");
        require(block.timestamp > d.filedAt + VOTING_DEADLINE, "Dispute: deadline not passed");
        _resolveDispute(disputeId);
    }

    // ─── Internal resolution logic ────────────────────────────────────────────
    function _resolveDispute(uint256 disputeId) internal {
        Dispute storage d = disputes[disputeId];

        d.status      = DisputeStatus.Resolved;
        d.resolvedAt  = block.timestamp;
        parcelActiveDispute[d.parcelId] = 0;

        if (d.votesForClaimant > d.votesForRespondent) {
            // Claimant wins — TODO: in full system, NFT ownership transfer logic
            d.verdict      = Verdict.ClaimantWins;
            d.verdictReason = "Majority arbitrators ruled in favour of claimant";

            // Refund claimant's bond
            (bool refunded, ) = payable(d.claimant).call{value: d.bondAmount}("");
            require(refunded, "Dispute: bond refund failed");

        } else {
            // Respondent wins
            d.verdict       = Verdict.RespondentWins;
            d.verdictReason = "Majority arbitrators ruled in favour of respondent";

            // Bond goes to respondent as compensation
            (bool paid, ) = payable(d.respondent).call{value: d.bondAmount}("");
            require(paid, "Dispute: respondent payment failed");
        }

        // Restore parcel to Approved status in registry
        registryContract.resolveDisputed(d.parcelId);

        emit DisputeResolved(disputeId, d.verdict, d.verdictReason);
    }

    // ─── View helpers ─────────────────────────────────────────────────────────
    function getDisputeBasic(uint256 disputeId) external view returns (
        string memory parcelId,
        address claimant,
        address respondent,
        DisputeStatus status,
        Verdict verdict,
        uint256 votesForClaimant,
        uint256 votesForRespondent,
        uint256 filedAt
    ) {
        Dispute storage d = disputes[disputeId];
        return (
            d.parcelId, d.claimant, d.respondent,
            d.status, d.verdict,
            d.votesForClaimant, d.votesForRespondent,
            d.filedAt
        );
    }

    function getArbitratorPool() external view returns (address[] memory) {
        return arbitratorPool;
    }

    function totalDisputes() external view returns (uint256) {
        return _disputeCounter;
    }
}
