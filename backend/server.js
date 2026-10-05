// backend/server.js
require("dotenv").config();
const express       = require("express");
const mongoose      = require("mongoose");
const cors          = require("cors");
const helmet        = require("helmet");
const rateLimit     = require("express-rate-limit");
const morgan        = require("morgan");

// ─── Route imports ────────────────────────────────────────────────────────────
const authRoutes     = require("./routes/auth");
const parcelRoutes   = require("./routes/parcels");
const transferRoutes = require("./routes/transfers");
const disputeRoutes  = require("./routes/disputes");
const loanRoutes     = require("./routes/loans");
const verifyRoutes   = require("./routes/verify");
const adminRoutes    = require("./routes/admin");
const marketRoutes   = require("./routes/market");

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc:  ["'self'"],
    styleSrc:   ["'self'", "'unsafe-inline'"],
    imgSrc:     ["'self'", "data:", "https:"],
  }
}));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max:      100,               // 100 requests per window
  message:  { error: "Too many requests. Please try again later." }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  { error: "Too many login attempts. Please try again in 15 minutes." }
});

app.use(globalLimiter);

// ─── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods:     ["GET","POST","PUT","PATCH","DELETE"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan("combined"));

// ─── Database connection ──────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/landchain", {
  useNewUrlParser:    true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch(err => { console.error("MongoDB error:", err); process.exit(1); });

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",      authLimiter, authRoutes);
app.use("/api/parcels",   parcelRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/disputes",  disputeRoutes);
app.use("/api/loans",     loanRoutes);
app.use("/api/verify",    verifyRoutes);
app.use("/api/admin",     adminRoutes);
app.use("/api/market",    marketRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.statusCode || 500;
  res.status(status).json({
    error:   err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`LandChain API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;
