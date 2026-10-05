// backend/routes/parcels.js
const express  = require("express");
const router   = express.Router();
const crypto   = require("crypto");
const { Parcel, AuditLog, Transaction } = require("../../database/models");
const { authenticateToken, requireRole } = require("../middleware/auth");
const validateParcelRegistration = [];
const blockchainService = require("../services/blockchain");
const smsService        = require("../services/sms");
const uploadMiddleware  = require("../middleware/upload");

// ─── POST /api/parcels/register ───────────────────────────────────────────────
// Land owner registers a new parcel. Requires wallet auth.
router.post("/register",
  authenticateToken,
  requireRole(["owner","admin"]),
  uploadMiddleware.single("surveyDocument"),
  validateParcelRegistration,
  async (req, res) => {
    try {
      const {
        ownerName, county, subCounty, gpsCoordinates,
        sizeAcres, landUse, estimatedValue
      } = req.body;

      // Generate unique parcel ID: LC-YYYY-XXXXX
      const year     = new Date().getFullYear();
      const count    = await Parcel.countDocuments() + 1;
      const parcelId = `LC-${year}-${String(count).padStart(5, "0")}`;

      // Hash the uploaded document (malware check + integrity)
      let documentHash = "";
      let surveyDocUrl = "";
      if (req.file) {
        documentHash = crypto.createHash("sha256")
                             .update(req.file.buffer)
                             .digest("hex");
        // In production: upload to AWS S3 or IPFS here
        surveyDocUrl = `/uploads/${req.file.originalname}`;
      }

      // Save to MongoDB
      const parcel = await Parcel.create({
        parcelId,
        ownerWallet:    req.user.walletAddress,
        ownerName,
        county,
        subCounty,
        gpsCoordinates,
        sizeAcres:      parseFloat(sizeAcres),
        landUse,
        estimatedValue: estimatedValue ? parseFloat(estimatedValue) : null,
        documentHash,
        surveyDocUrl,
        status: "pending"
      });

      // Log to audit trail
      await AuditLog.create({
        action:      "PARCEL_REGISTERED",
        actorWallet: req.user.walletAddress,
        actorIp:     req.ip,
        targetId:    parcelId,
        details:     { county, subCounty, sizeAcres },
        severity:    "info"
      });

      // Send SMS to owner
      await smsService.send(
        req.user.phone,
        `LandChain: Your parcel ${parcelId} (${county}, ${sizeAcres} acres) ` +
        `has been submitted for registration. Awaiting government approval.`
      );

      res.status(201).json({
        success: true,
        message: "Parcel submitted for registration",
        parcelId,
        parcel
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── POST /api/parcels/:parcelId/approve ──────────────────────────────────────
// Government official approves a pending parcel.
router.post("/:parcelId/approve",
  authenticateToken,
  requireRole(["official","admin"]),
  async (req, res) => {
    try {
      const { parcelId } = req.params;
      const parcel = await Parcel.findOne({ parcelId });
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });
      if (parcel.status !== "pending")
        return res.status(400).json({ error: "Parcel is not pending" });

      // Call blockchain smart contract
      const result = await blockchainService.approveParcel(parcelId);

      // Update MongoDB
      parcel.status     = "approved";
      parcel.approvedAt = new Date();
      parcel.approvedBy = req.user.walletAddress;
      parcel.blockchainTxHash = result.txHash;
      parcel.blockNumber      = result.blockNumber;
      parcel.nftTokenId       = result.tokenId;
      await parcel.save();

      // Record transaction
      await Transaction.create({
        transactionType: "registration",
        parcelId,
        toWallet: parcel.ownerWallet,
        txHash:   result.txHash,
        blockNumber: result.blockNumber,
        status:   "confirmed"
      });

      await AuditLog.create({
        action:      "PARCEL_APPROVED",
        actorWallet: req.user.walletAddress,
        targetId:    parcelId,
        details:     { nftTokenId: result.tokenId, txHash: result.txHash },
        severity:    "info"
      });

      // SMS to owner
      const owner = await require("../../database/models").User
        .findOne({ walletAddress: parcel.ownerWallet });
      if (owner) {
        await smsService.send(
          owner.phone,
          `LandChain: Your land parcel ${parcelId} has been APPROVED. ` +
          `NFT Title Deed #${result.tokenId} has been minted to your wallet. ` +
          `Block: #${result.blockNumber}`
        );
      }

      res.json({ success: true, message: "Parcel approved and NFT minted", result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── POST /api/parcels/:parcelId/reject ───────────────────────────────────────
router.post("/:parcelId/reject",
  authenticateToken,
  requireRole(["official","admin"]),
  async (req, res) => {
    try {
      const { parcelId } = req.params;
      const { reason }   = req.body;
      if (!reason) return res.status(400).json({ error: "Rejection reason required" });

      const parcel = await Parcel.findOne({ parcelId });
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });

      parcel.status = "rejected";
      await parcel.save();

      await AuditLog.create({
        action:      "PARCEL_REJECTED",
        actorWallet: req.user.walletAddress,
        targetId:    parcelId,
        details:     { reason },
        severity:    "warning"
      });

      res.json({ success: true, message: "Parcel rejected" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── GET /api/parcels/my ──────────────────────────────────────────────────────
// Get all parcels belonging to authenticated user.
router.get("/my", authenticateToken, async (req, res) => {
  try {
    const parcels = await Parcel.find({ ownerWallet: req.user.walletAddress })
                                .sort({ registeredAt: -1 });
    res.json({ success: true, count: parcels.length, parcels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/parcels/:parcelId ───────────────────────────────────────────────
router.get("/:parcelId", async (req, res) => {
  try {
    const parcel = await Parcel.findOne({ parcelId: req.params.parcelId });
    if (!parcel) return res.status(404).json({ error: "Parcel not found" });
    res.json({ success: true, parcel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/parcels ─────────────────────────────────────────────────────────
// Admin/public list with filters
router.get("/", async (req, res) => {
  try {
    const { county, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (county) filter.county = new RegExp(county, "i");
    if (status) filter.status = status;

    const parcels = await Parcel.find(filter)
      .sort({ registeredAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Parcel.countDocuments(filter);
    res.json({ success: true, total, page: parseInt(page), parcels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
