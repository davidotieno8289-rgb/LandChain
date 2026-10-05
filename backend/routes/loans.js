// backend/routes/loans.js
const express  = require("express");
const router   = express.Router();
const { Loan, Parcel, User, AuditLog } = require("../../database/models");
const { authenticateToken, requireRole } = require("../middleware/auth");
const smsService = require("../services/sms");

// ─── POST /api/loans/apply ────────────────────────────────────────────────────
router.post("/apply", authenticateToken, requireRole(["owner","admin"]), async (req, res) => {
  try {
    const { parcelId, principalKES, principalWei, durationDays } = req.body;
    if (!parcelId || !principalWei || !durationDays)
      return res.status(400).json({ error: "parcelId, principalWei and durationDays required" });

    const parcel = await Parcel.findOne({ parcelId });
    if (!parcel) return res.status(404).json({ error: "Parcel not found" });
    if (parcel.ownerWallet !== req.user.walletAddress)
      return res.status(403).json({ error: "Not the parcel owner" });
    if (parcel.status !== "approved")
      return res.status(400).json({ error: "Parcel must be approved before using as collateral" });
    if (parcel.isCollateral)
      return res.status(400).json({ error: "Parcel already locked as collateral" });

    const count  = await Loan.countDocuments() + 1;
    const loan   = await Loan.create({
      loanId:         count,
      parcelId,
      borrowerWallet: req.user.walletAddress,
      principalKES:   principalKES || 0,
      principalWei,
      durationDays:   parseInt(durationDays),
      status:         "applied"
    });

    await AuditLog.create({ action: "LOAN_APPLIED", actorWallet: req.user.walletAddress,
      targetId: parcelId, details: { loanId: count, principalWei, durationDays }, severity: "info" });

    res.status(201).json({ success: true, loan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/loans/:loanId/approve ─────────────────────────────────────────
router.post("/:loanId/approve", authenticateToken, requireRole(["admin"]), async (req, res) => {
  try {
    const { interestRateBps } = req.body;
    const loan = await Loan.findOne({ loanId: req.params.loanId });
    if (!loan) return res.status(404).json({ error: "Loan not found" });

    const interest = Math.floor((parseInt(loan.principalWei) * interestRateBps * loan.durationDays) / (365 * 10000));
    const totalRepayable = (parseInt(loan.principalWei) + interest).toString();
    const deadline = new Date(Date.now() + loan.durationDays * 24 * 60 * 60 * 1000);

    loan.status          = "active";
    loan.lenderWallet    = req.user.walletAddress;
    loan.interestRateBps = interestRateBps;
    loan.totalRepayable  = totalRepayable;
    loan.fundedAt        = new Date();
    loan.deadline        = deadline;
    await loan.save();

    // Lock parcel as collateral
    await Parcel.findOneAndUpdate({ parcelId: loan.parcelId }, { isCollateral: true });

    const borrower = await User.findOne({ walletAddress: loan.borrowerWallet });
    if (borrower?.phone) {
      await smsService.sendLoanAlert(borrower.phone, loan.loanId,
        `Your loan application has been APPROVED. ` +
        `Repay ${totalRepayable} wei before ${deadline.toDateString()}.`);
    }

    res.json({ success: true, loan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/loans/:loanId/repay ────────────────────────────────────────────
router.post("/:loanId/repay", authenticateToken, async (req, res) => {
  try {
    const { amountWei } = req.body;
    const loan = await Loan.findOne({ loanId: req.params.loanId });
    if (!loan) return res.status(404).json({ error: "Loan not found" });
    if (loan.borrowerWallet !== req.user.walletAddress)
      return res.status(403).json({ error: "Not the borrower" });
    if (loan.status !== "active")
      return res.status(400).json({ error: "Loan not active" });

    const newAmountRepaid = (BigInt(loan.amountRepaid || "0") + BigInt(amountWei)).toString();
    loan.amountRepaid = newAmountRepaid;
    loan.repayments.push({ amount: amountWei, paidAt: new Date() });

    if (BigInt(newAmountRepaid) >= BigInt(loan.totalRepayable)) {
      loan.status   = "repaid";
      loan.repaidAt = new Date();
      await Parcel.findOneAndUpdate({ parcelId: loan.parcelId }, { isCollateral: false });
    }

    await loan.save();
    res.json({ success: true, loan, fullyRepaid: loan.status === "repaid" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/loans/my ────────────────────────────────────────────────────────
router.get("/my", authenticateToken, async (req, res) => {
  try {
    const loans = await Loan.find({ borrowerWallet: req.user.walletAddress }).sort({ appliedAt: -1 });
    res.json({ success: true, loans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/loans ───────────────────────────────────────────────────────────
router.get("/", authenticateToken, requireRole(["admin"]), async (req, res) => {
  try {
    const loans = await Loan.find().sort({ appliedAt: -1 });
    res.json({ success: true, count: loans.length, loans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
