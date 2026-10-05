// backend/routes/admin.js
const express  = require("express");
const router   = express.Router();
const { User, Parcel, Dispute, Loan, AuditLog, Transaction } = require("../../database/models");
const { authenticateToken, requireRole } = require("../middleware/auth");
const blockchainService = require("../services/blockchain");

// All admin routes require admin role
router.use(authenticateToken, requireRole(["admin"]));

// ─── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const [users, parcels, approved, disputes, loans, chainStats] = await Promise.all([
      User.countDocuments(),
      Parcel.countDocuments(),
      Parcel.countDocuments({ status: "approved" }),
      Dispute.countDocuments({ status: { $in: ["filed","under_review"] } }),
      Loan.countDocuments({ status: "active" }),
      blockchainService.getTotalStats().catch(() => null)
    ]);

    const fraudAttempts = await AuditLog.countDocuments({ severity: "critical" });
    const pendingApprovals = await Parcel.countDocuments({ status: "pending" });

    res.json({
      success: true,
      stats: {
        totalUsers: users, totalParcels: parcels,
        approvedParcels: approved, pendingApprovals,
        activeDisputes: disputes, activeLoans: loans,
        fraudAttempts, chainStats
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/audit ─────────────────────────────────────────────────────
router.get("/audit", async (req, res) => {
  try {
    const { severity, page = 1, limit = 50 } = req.query;
    const filter = severity ? { severity } : {};
    const logs   = await AuditLog.find(filter)
                                  .sort({ timestamp: -1 })
                                  .skip((page - 1) * limit)
                                  .limit(parseInt(limit));
    const total  = await AuditLog.countDocuments(filter);
    res.json({ success: true, total, page: parseInt(page), logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get("/users", async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const filter = role ? { role } : {};
    const users  = await User.find(filter).sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(parseInt(limit));
    const total  = await User.countDocuments(filter);
    res.json({ success: true, total, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/admin/users/:wallet/role ─────────────────────────────────────
router.patch("/users/:wallet/role", async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ["public","owner","official","arbitrator","admin"];
    if (!validRoles.includes(role))
      return res.status(400).json({ error: "Invalid role" });

    const user = await User.findOneAndUpdate(
      { walletAddress: req.params.wallet.toLowerCase() },
      { role }, { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    await AuditLog.create({ action: "ROLE_CHANGED", actorWallet: req.user.walletAddress,
      targetId: req.params.wallet, details: { newRole: role }, severity: "warning" });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/pending ───────────────────────────────────────────────────
router.get("/pending", async (req, res) => {
  try {
    const parcels = await Parcel.find({ status: "pending" }).sort({ registeredAt: 1 });
    res.json({ success: true, count: parcels.length, parcels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
