// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./LandNFT.sol";

/**
 * @title LandRegistry
 * @dev Core contract for registering, approving, and managing land parcels.
 *      Government officials approve registrations.
 *      Upon approval, a LandNFT title deed is automatically minted.
 */
contract LandRegistry is AccessControl, ReentrancyGuard {

    // ─── Roles ───────────────────────────────────────────────────────────────
    bytes32 public constant OFFICIAL_ROLE = keccak256("OFFICIAL_ROLE");
    bytes32 public constant ADMIN_ROLE    = keccak256("ADMIN_ROLE");

    // ─── Parcel status enum ───────────────────────────────────────────────────
    enum Status { Pending, Approved, Rejected, Disputed }

    // ─── Data structures ──────────────────────────────────────────────────────
    struct Parcel {
        string  parcelId;        // e.g. "LC-2024-00142"
        address owner;           // MetaMask wallet of owner
        string  ownerName;       // Full legal name
        string  county;
        string  subCounty;
        string  gpsCoordinates;  // "-1.0332,37.0693"
        uint256 sizeAcres;       // stored as acres * 1000 (3 decimal places)
        string  documentHash;    // SHA-256 hash of uploaded survey document
        string  metadataURI;     // IPFS URI of full metadata
        Status  status;
        uint256 registeredAt;
        uint256 approvedAt;
        bool    isCollateral;    // true when locked for a loan
    }

    // ─── State ────────────────────────────────────────────────────────────────
    LandNFT public nftContract;

    mapping(string  => Parcel)   public parcels;           // parcelId → Parcel
    mapping(address => string[]) public ownerParcels;      // wallet → parcel IDs
    string[]                     public allParcelIds;

    uint256 public totalRegistered;
    uint256 public totalApproved;

    // ─── Events ───────────────────────────────────────────────────────────────
    event ParcelRegistered(string indexed parcelId, address indexed owner, uint256 timestamp);
    event ParcelApproved  (string indexed parcelId, address indexed official, uint256 tokenId);
    event ParcelRejected  (string indexed parcelId, address indexed official, string reason);
    event ParcelStatusChanged(string indexed parcelId, Status newStatus);
    event CollateralLocked  (string indexed parcelId, address indexed loanContract);
    event CollateralReleased(string indexed parcelId);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address nftAddress) {
        nftContract = LandNFT(nftAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE,         msg.sender);
        _grantRole(OFFICIAL_ROLE,      msg.sender);
    }

    // ─── Register ─────────────────────────────────────────────────────────────
    /**
     * @notice Submit a new land parcel for registration.
     *         Status starts as Pending until a government official approves.
     */
    function registerParcel(
        string memory parcelId,
        string memory ownerName,
        string memory county,
        string memory subCounty,
        string memory gpsCoordinates,
        uint256       sizeAcres,
        string memory documentHash,
        string memory metadataURI
    ) external nonReentrant {
        require(bytes(parcelId).length > 0,         "Registry: empty parcel ID");
        require(bytes(parcels[parcelId].parcelId).length == 0, "Registry: parcel already registered");
        require(bytes(ownerName).length > 0,        "Registry: owner name required");
        require(bytes(documentHash).length == 64,   "Registry: invalid document hash (must be SHA-256)");

        parcels[parcelId] = Parcel({
            parcelId:       parcelId,
            owner:          msg.sender,
            ownerName:      ownerName,
            county:         county,
            subCounty:      subCounty,
            gpsCoordinates: gpsCoordinates,
            sizeAcres:      sizeAcres,
            documentHash:   documentHash,
            metadataURI:    metadataURI,
            status:         Status.Pending,
            registeredAt:   block.timestamp,
            approvedAt:     0,
            isCollateral:   false
        });

        ownerParcels[msg.sender].push(parcelId);
        allParcelIds.push(parcelId);
        totalRegistered++;

        emit ParcelRegistered(parcelId, msg.sender, block.timestamp);
    }

    // ─── Approve ──────────────────────────────────────────────────────────────
    /**
     * @notice Government official approves a pending parcel.
     *         Automatically mints an NFT title deed to the owner.
     */
    function approveParcel(string memory parcelId)
        external onlyRole(OFFICIAL_ROLE) nonReentrant
    {
        Parcel storage p = parcels[parcelId];
        require(bytes(p.parcelId).length > 0,  "Registry: parcel not found");
        require(p.status == Status.Pending,     "Registry: parcel not pending");

        p.status     = Status.Approved;
        p.approvedAt = block.timestamp;
        totalApproved++;

        // Mint NFT title deed
        uint256 tokenId = nftContract.mintTitleDeed(p.owner, parcelId, p.metadataURI);

        emit ParcelApproved(parcelId, msg.sender, tokenId);
        emit ParcelStatusChanged(parcelId, Status.Approved);
    }

    // ─── Reject ───────────────────────────────────────────────────────────────
    function rejectParcel(string memory parcelId, string memory reason)
        external onlyRole(OFFICIAL_ROLE)
    {
        Parcel storage p = parcels[parcelId];
        require(bytes(p.parcelId).length > 0, "Registry: parcel not found");
        require(p.status == Status.Pending,   "Registry: parcel not pending");

        p.status = Status.Rejected;
        emit ParcelRejected(parcelId, msg.sender, reason);
        emit ParcelStatusChanged(parcelId, Status.Rejected);
    }

    // ─── Collateral lock / release (called by LandLoan contract) ─────────────
    function lockAsCollateral(string memory parcelId, address loanContract)
        external onlyRole(ADMIN_ROLE)
    {
        Parcel storage p = parcels[parcelId];
        require(p.status == Status.Approved,  "Registry: parcel not approved");
        require(!p.isCollateral,              "Registry: already locked as collateral");
        p.isCollateral = true;
        emit CollateralLocked(parcelId, loanContract);
    }

    function releaseCollateral(string memory parcelId)
        external onlyRole(ADMIN_ROLE)
    {
        Parcel storage p = parcels[parcelId];
        require(p.isCollateral, "Registry: not locked as collateral");
        p.isCollateral = false;
        emit CollateralReleased(parcelId);
    }

    // ─── Mark disputed (called by DisputeResolution contract) ────────────────
    function markDisputed(string memory parcelId) external onlyRole(ADMIN_ROLE) {
        parcels[parcelId].status = Status.Disputed;
        emit ParcelStatusChanged(parcelId, Status.Disputed);
    }

    function resolveDisputed(string memory parcelId) external onlyRole(ADMIN_ROLE) {
        parcels[parcelId].status = Status.Approved;
        emit ParcelStatusChanged(parcelId, Status.Approved);
    }

    // ─── View helpers ─────────────────────────────────────────────────────────
    function getParcel(string memory parcelId) external view returns (Parcel memory) {
        return parcels[parcelId];
    }

    function getOwnerParcels(address owner) external view returns (string[] memory) {
        return ownerParcels[owner];
    }

    function getAllParcelIds() external view returns (string[] memory) {
        return allParcelIds;
    }

    function totalParcels() external view returns (uint256) {
        return allParcelIds.length;
    }
}
