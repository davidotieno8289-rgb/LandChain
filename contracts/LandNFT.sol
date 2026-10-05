// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title LandNFT
 * @dev ERC-721 NFT contract for LandChain digital title deeds.
 *      Each land parcel is minted as a unique, unforgeable NFT.
 *      Only the LandRegistry contract (MINTER_ROLE) can mint new tokens.
 */
contract LandNFT is ERC721, ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;

    // ─── Roles ───────────────────────────────────────────────────────────────
    bytes32 public constant MINTER_ROLE  = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE  = keccak256("BURNER_ROLE");

    // ─── State ────────────────────────────────────────────────────────────────
    Counters.Counter private _tokenIdCounter;

    // tokenId → parcel ID string (e.g. "LC-2024-00142")
    mapping(uint256 => string) public tokenToParcelId;
    // parcel ID string → tokenId
    mapping(string  => uint256) public parcelIdToToken;

    // ─── Events ───────────────────────────────────────────────────────────────
    event TitleDeedMinted(uint256 indexed tokenId, string parcelId, address indexed owner);
    event TitleDeedBurned(uint256 indexed tokenId, string parcelId);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor() ERC721("LandChain Title Deed", "LCTD") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE,        msg.sender);
        _grantRole(BURNER_ROLE,        msg.sender);
    }

    // ─── Mint ─────────────────────────────────────────────────────────────────
    /**
     * @notice Mint a new NFT title deed for a registered land parcel.
     * @param to       Wallet address of the land owner.
     * @param parcelId Unique parcel identifier (e.g. "LC-2024-00142").
     * @param uri      IPFS URI pointing to the parcel metadata JSON.
     * @return tokenId The newly minted token ID.
     */
    function mintTitleDeed(
        address to,
        string memory parcelId,
        string memory uri
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(parcelIdToToken[parcelId] == 0, "LandNFT: parcel already has a deed");
        require(to != address(0), "LandNFT: mint to zero address");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        tokenToParcelId[tokenId] = parcelId;
        parcelIdToToken[parcelId] = tokenId;

        emit TitleDeedMinted(tokenId, parcelId, to);
        return tokenId;
    }

    // ─── Burn (used when dispute resolution voids a deed) ─────────────────────
    function burnTitleDeed(uint256 tokenId) external onlyRole(BURNER_ROLE) {
        string memory parcelId = tokenToParcelId[tokenId];
        delete parcelIdToToken[parcelId];
        delete tokenToParcelId[tokenId];
        _burn(tokenId);
        emit TitleDeedBurned(tokenId, parcelId);
    }

    // ─── View helpers ─────────────────────────────────────────────────────────
    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    function getTokenByParcel(string memory parcelId) external view returns (uint256) {
        uint256 tokenId = parcelIdToToken[parcelId];
        require(tokenId != 0, "LandNFT: no deed for this parcel");
        return tokenId;
    }

    // ─── Required overrides ───────────────────────────────────────────────────
    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage) returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
}
