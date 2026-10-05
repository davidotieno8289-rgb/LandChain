// backend/middleware/auth.js
const jwt  = require("jsonwebtoken");
const { User, AuditLog } = require("../../database/models");

const JWT_SECRET  = process.env.JWT_SECRET  || "landchain-dev-secret-change-in-production";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "8h";

// ─── Generate token ────────────────────────────────────────────────────────────
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// ─── Verify JWT from Authorization header ─────────────────────────────────────
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access token required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch fresh user from DB
    const user = await User.findOne({ walletAddress: decoded.walletAddress });
    if (!user) return res.status(401).json({ error: "User not found" });
    if (!user.isVerified) return res.status(403).json({ error: "Account not verified" });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired. Please log in again." });
    }
    return res.status(403).json({ error: "Invalid token" });
  }
}

// ─── Role-based access control ────────────────────────────────────────────────
function requireRole(allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    if (!allowedRoles.includes(req.user.role)) {
      await AuditLog.create({
        action:      "UNAUTHORIZED_ACCESS_ATTEMPT",
        actorWallet: req.user.walletAddress,
        actorIp:     req.ip,
        targetId:    req.path,
        details:     { requiredRoles: allowedRoles, userRole: req.user.role },
        severity:    "warning"
      });
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(" or ")}`
      });
    }
    next();
  };
}

// ─── MetaMask signature verification ─────────────────────────────────────────
// Users prove wallet ownership by signing a nonce with MetaMask
const { ethers } = require("ethers");

function verifyWalletSignature(walletAddress, nonce, signature) {
  try {
    const message  = `Sign this message to login to LandChain.\nNonce: ${nonce}`;
    const recovered = ethers.utils.verifyMessage(message, signature);
    return recovered.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
}

module.exports = { generateToken, authenticateToken, requireRole, verifyWalletSignature };
