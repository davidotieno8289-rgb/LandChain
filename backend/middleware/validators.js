// backend/routes/auth.js
const express  = require("express");
const router   = express.Router();
const crypto   = require("crypto");
const { User, AuditLog } = require("../../database/models");
const { generateToken, verifyWalletSignature, authenticateToken } = require("../middleware/auth");
const smsService = require("../services/sms");

// In-memory nonce store (use Redis in production)
const nonceStore = new Map(); // walletAddress → { nonce, expiresAt }
// In-memory OTP store (use Redis in production)
const otpStore   = new Map(); // phone → { otp, expiresAt }

// ─── GET /api/auth/nonce/:walletAddress ───────────────────────────────────────
// Step 1 of MetaMask login: get a one-time nonce to sign
router.get("/nonce/:walletAddress", async (req, res) => {
  try {
    const wallet = req.params.walletAddress.toLowerCase();
    const nonce  = crypto.randomBytes(16).toString("hex");
    nonceStore.set(wallet, { nonce, expiresAt: Date.now() + 5 * 60 * 1000 }); // 5 min
    res.json({ nonce, message: `Sign this message to login to LandChain.\nNonce: ${nonce}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Step 2: verify MetaMask signature and issue JWT
router.post("/login", async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;
    if (!walletAddress || !signature)
      return res.status(400).json({ error: "walletAddress and signature required" });

    const wallet = walletAddress.toLowerCase();
    const stored = nonceStore.get(wallet);
    if (!stored || Date.now() > stored.expiresAt)
      return res.status(400).json({ error: "Nonce expired. Request a new one." });

    const valid = verifyWalletSignature(wallet, stored.nonce, signature);
    if (!valid) return res.status(401).json({ error: "Invalid signature" });

    nonceStore.delete(wallet); // nonce is single-use

    // Find or create user
    let user = await User.findOne({ walletAddress: wallet });
    if (!user) {
      // Auto-create with public role — they can upgrade after profile setup
      user = await User.create({ walletAddress: wallet, fullName: "New User",
        nationalId: `TEMP-${Date.now()}`, phone: "", isVerified: false });
    }

    user.lastLogin = new Date();
    await user.save();

    // If 2FA enabled, send OTP and require verification
    if (user.twoFactorEnabled && user.phone) {
      const otp = await smsService.sendOTP(user.phone);
      otpStore.set(user.phone, { otp, walletAddress: wallet, expiresAt: Date.now() + 10 * 60 * 1000 });
      return res.json({ requireOTP: true, message: "OTP sent to your registered phone number" });
    }

    const token = generateToken({ walletAddress: wallet, role: user.role });

    await AuditLog.create({ action: "USER_LOGIN", actorWallet: wallet,
      actorIp: req.ip, severity: "info" });

    res.json({ success: true, token, user: {
      walletAddress: user.walletAddress, fullName: user.fullName,
      role: user.role, isVerified: user.isVerified, language: user.language
    }});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/verify-otp ────────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const stored = otpStore.get(phone);
    if (!stored || Date.now() > stored.expiresAt)
      return res.status(400).json({ error: "OTP expired" });
    if (stored.otp !== otp)
      return res.status(401).json({ error: "Invalid OTP" });

    otpStore.delete(phone);
    const user  = await User.findOne({ walletAddress: stored.walletAddress });
    const token = generateToken({ walletAddress: user.walletAddress, role: user.role });
    res.json({ success: true, token, user: {
      walletAddress: user.walletAddress, fullName: user.fullName, role: user.role
    }});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────
// Complete profile after first wallet login
router.post("/register", authenticateToken, async (req, res) => {
  try {
    const { fullName, nationalId, phone, email, language } = req.body;
    if (!fullName || !nationalId || !phone)
      return res.status(400).json({ error: "fullName, nationalId and phone are required" });

    const existing = await User.findOne({ nationalId });
    if (existing && existing.walletAddress !== req.user.walletAddress)
      return res.status(409).json({ error: "National ID already registered" });

    const user = await User.findOneAndUpdate(
      { walletAddress: req.user.walletAddress },
      { fullName, nationalId, phone, email, language: language || "en",
        isVerified: true, role: "owner" },
      { new: true }
    );

    res.json({ success: true, message: "Profile registered", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/me", authenticateToken, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ─── PATCH /api/auth/language ─────────────────────────────────────────────────
router.patch("/language", authenticateToken, async (req, res) => {
  const { language } = req.body;
  if (!["en","sw","other"].includes(language))
    return res.status(400).json({ error: "Invalid language" });
  await User.findOneAndUpdate({ walletAddress: req.user.walletAddress }, { language });
  res.json({ success: true, language });
});

module.exports = router;
