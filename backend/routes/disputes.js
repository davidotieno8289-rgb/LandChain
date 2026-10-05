// backend/routes/disputes.js
const express  = require("express");
const router   = express.Router();
const { Dispute, Parcel, User, AuditLog } = require("../../database/models");
const { authenticateToken, requireRole }  = require("../middleware/auth");
const blockchainService = require("../services/blockchain");
const smsService        = require("../services/sms");

// ─── POST /api/disputes/file ──────────────────────────────────────────────────
router.post("/file", authenticateToken, requireRole(["owner","admin"]), async (req, res) => {
  try {
    const { parcelId, description, evidenceIPFSHash } = req.body;
    if (!parcelId || !description)
      return res.status(400).json({ error: "parcelId and description required" });

    const parcel = await Parcel.findOne({ parcelId });
    if (!parcel) return res.status(404).json({ error: "Parcel not found" });
    if (parcel.ownerWallet === req.user.walletAddress)
      return res.status(400).json({ error: "Cannot dispute your own parcel" });

    const existing = await Dispute.findOne({ parcelId, status: { $in: ["filed","under_review"] } });
    if (existing) return res.status(409).json({ error: "Parcel already under active dispute" });

    // Call blockchain (bond = 0.01 ETH)
    const bondWei = "10000000000000000"; // 0.01 ETH in wei
    const result  = await blockchainService.fileDispute(
      parcelId, description, evidenceIPFSHash || "", bondWei
    );

    const dispute = await Dispute.create({
      disputeId:        result.disputeId,
      parcelId,
      claimantWallet:   req.user.walletAddress,
      respondentWallet: parcel.ownerWallet,
      description,
      claimantEvidence: evidenceIPFSHash ? [evidenceIPFSHash] : [],
      status:           "filed",
      blockchainTxHash: result.txHash
    });

    // Notify respondent via SMS
    const respondent = await User.findOne({ walletAddress: parcel.ownerWallet });
    if (respondent?.phone) {
      await smsService.sendDisputeAlert(respondent.phone, parcelId, result.disputeId);
    }

    await AuditLog.create({ action: "DISPUTE_FILED", actorWallet: req.user.walletAddress,
      targetId: parcelId, details: { disputeId: result.disputeId }, severity: "warning" });

    res.status(201).json({ success: true, dispute, txHash: result.txHash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/disputes/:disputeId/evidence ───────────────────────────────────
router.post("/:disputeId/evidence", authenticateToken, async (req, res) => {
  try {
    const dispute = await Dispute.findOne({ disputeId: req.params.disputeId });
    if (!dispute) return res.status(404).json({ error: "Dispute not found" });

    const { evidenceIPFSHash } = req.body;
    if (!evidenceIPFSHash) return res.status(400).json({ error: "evidenceIPFSHash required" });

    if (req.user.walletAddress === dispute.claimantWallet) {
      dispute.claimantEvidence.push(evidenceIPFSHash);
    } else if (req.user.walletAddress === dispute.respondentWallet) {
      dispute.respondentEvidence.push(evidenceIPFSHash);
    } else {
      return res.status(403).json({ error: "Not a party to this dispute" });
    }

    await dispute.save();
    res.json({ success: true, message: "Evidence submitted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/disputes/:disputeId/assign ─────────────────────────────────────
// Admin assigns arbitrators
router.post("/:disputeId/assign", authenticateToken, requireRole(["admin"]), async (req, res) => {
  try {
    const result = await blockchainService.assignArbitrators(parseInt(req.params.disputeId));
    await Dispute.findOneAndUpdate(
      { disputeId: req.params.disputeId },
      { status: "under_review" }
    );
    res.json({ success: true, txHash: result.txHash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/disputes/:disputeId/vote ───────────────────────────────────────
router.post("/:disputeId/vote", authenticateToken, requireRole(["arbitrator","admin"]), async (req, res) => {
  try {
    const { forClaimant } = req.body;
    const dispute = await Dispute.findOne({ disputeId: req.params.disputeId });
    if (!dispute) return res.status(404).json({ error: "Dispute not found" });

    const alreadyVoted = dispute.votes.find(v => v.arbitratorWallet === req.user.walletAddress);
    if (alreadyVoted) return res.status(409).json({ error: "Already voted on this dispute" });

    dispute.votes.push({ arbitratorWallet: req.user.walletAddress,
      forClaimant, votedAt: new Date() });

    const forCount     = dispute.votes.filter(v => v.forClaimant).length;
    const againstCount = dispute.votes.filter(v => !v.forClaimant).length;

    if (forCount + againstCount >= 6) {
      dispute.status  = "resolved";
      dispute.verdict = forCount > againstCount ? "claimant_wins" : "respondent_wins";
      dispute.resolvedAt = new Date();
    }

    await dispute.save();
    res.json({ success: true, votes: dispute.votes.length,
      forClaimant: forCount, forRespondent: againstCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/disputes ────────────────────────────────────────────────────────
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    // Non-admins only see their own disputes
    if (!["admin","official"].includes(req.user.role)) {
      filter.$or = [
        { claimantWallet:  req.user.walletAddress },
        { respondentWallet: req.user.walletAddress }
      ];
    }

    const disputes = await Dispute.find(filter)
      .sort({ filedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Dispute.countDocuments(filter);
    res.json({ success: true, total, disputes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/disputes/:disputeId ─────────────────────────────────────────────
router.get("/:disputeId", authenticateToken, async (req, res) => {
  try {
    const dispute = await Dispute.findOne({ disputeId: req.params.disputeId });
    if (!dispute) return res.status(404).json({ error: "Dispute not found" });
    res.json({ success: true, dispute });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
