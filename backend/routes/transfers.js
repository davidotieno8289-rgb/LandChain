// backend/routes/transfers.js
const express  = require("express");
const router   = express.Router();
const { Parcel, Transaction, AuditLog, User } = require("../../database/models");
const { authenticateToken, requireRole }       = require("../middleware/auth");
const blockchainService = require("../services/blockchain");
const smsService        = require("../services/sms");

// ─── POST /api/transfers/escrow ───────────────────────────────────────────────
router.post("/escrow", authenticateToken, requireRole(["owner","admin"]), async (req, res) => {
  try {
    const { parcelId, buyerWallet, priceWei } = req.body;
    if (!parcelId || !buyerWallet || !priceWei)
      return res.status(400).json({ error: "parcelId, buyerWallet and priceWei required" });

    const parcel = await Parcel.findOne({ parcelId });
    if (!parcel) return res.status(404).json({ error: "Parcel not found" });
    if (parcel.ownerWallet !== req.user.walletAddress)
      return res.status(403).json({ error: "Not the parcel owner" });
    if (parcel.isCollateral)
      return res.status(400).json({ error: "Parcel is locked as collateral" });

    const result = await blockchainService.createEscrow(parcelId, buyerWallet, priceWei);

    await Transaction.create({
      transactionType: "transfer",
      parcelId,
      fromWallet: req.user.walletAddress,
      toWallet:   buyerWallet,
      priceWei,
      escrowId:   result.escrowId,
      txHash:     result.txHash,
      status:     "pending"
    });

    // Alert buyer via SMS if registered
    const buyer = await User.findOne({ walletAddress: buyerWallet.toLowerCase() });
    if (buyer?.phone) {
      await smsService.send(buyer.phone,
        `LandChain: A land sale escrow for parcel ${parcelId} has been created for you. ` +
        `Log in to fund and confirm the purchase.`);
    }

    await AuditLog.create({ action: "ESCROW_CREATED", actorWallet: req.user.walletAddress,
      targetId: parcelId, details: { escrowId: result.escrowId, buyerWallet, priceWei }, severity: "info" });

    res.status(201).json({ success: true, escrowId: result.escrowId, txHash: result.txHash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/transfers/history/:parcelId ─────────────────────────────────────
router.get("/history/:parcelId", async (req, res) => {
  try {
    const transactions = await Transaction.find({ parcelId: req.params.parcelId })
                                          .sort({ timestamp: -1 });
    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
