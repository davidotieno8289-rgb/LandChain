// backend/routes/verify.js
// Public route — no authentication required
const express  = require("express");
const router   = express.Router();
const { Parcel, Transaction, Dispute } = require("../../database/models");
const blockchainService = require("../services/blockchain");

// ─── GET /api/verify/:parcelId ────────────────────────────────────────────────
// Anyone can verify ownership. Pulls from both blockchain + MongoDB.
router.get("/:parcelId", async (req, res) => {
  try {
    const { parcelId } = req.params;

    // Fetch from MongoDB
    const parcel = await Parcel.findOne({ parcelId });
    if (!parcel) return res.status(404).json({ error: "Parcel not found" });

    // Verify on blockchain
    let chainData = null;
    try {
      chainData = await blockchainService.verifyOwnership(parcelId);
    } catch (e) {
      chainData = { note: "Blockchain node not available — showing database record" };
    }

    // Check for active disputes
    const activeDispute = await Dispute.findOne({
      parcelId, status: { $in: ["filed","under_review"] }
    });

    // Transaction history
    const history = await Transaction.find({ parcelId }).sort({ timestamp: -1 }).limit(10);

    res.json({
      success:       true,
      parcelId,
      owner:         parcel.ownerWallet,
      ownerName:     parcel.ownerName,
      county:        parcel.county,
      subCounty:     parcel.subCounty,
      sizeAcres:     parcel.sizeAcres,
      status:        parcel.status,
      nftTokenId:    parcel.nftTokenId,
      documentHash:  parcel.documentHash,
      registeredAt:  parcel.registeredAt,
      approvedAt:    parcel.approvedAt,
      isCollateral:  parcel.isCollateral,
      activeDispute: activeDispute ? { disputeId: activeDispute.disputeId,
        status: activeDispute.status } : null,
      blockchainVerification: chainData,
      transactionHistory:     history,
      cleanTitle:    !activeDispute && parcel.status === "approved"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/verify/search ───────────────────────────────────────────────────
// Search by owner name, GPS, or county
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ error: "Query too short" });

    const parcels = await Parcel.find({
      $or: [
        { ownerName:      new RegExp(q, "i") },
        { county:         new RegExp(q, "i") },
        { gpsCoordinates: new RegExp(q, "i") },
        { parcelId:       new RegExp(q, "i") }
      ]
    }).limit(20).select("parcelId ownerName county subCounty sizeAcres status nftTokenId");

    res.json({ success: true, count: parcels.length, parcels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
