// database/models/index.js
// MongoDB schemas using Mongoose for all LandChain off-chain data

const mongoose = require("mongoose");

// ─── USER ─────────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true, lowercase: true },
  fullName:      { type: String, required: true },
  nationalId:    { type: String, required: true, unique: true },
  phone: { type: String, default: "" },   // for SMS alerts
  email:         { type: String },
  role:          { type: String, enum: ["public","owner","official","arbitrator","admin"], default: "public" },
  language:      { type: String, enum: ["en","sw","other"], default: "en" },
  isVerified:    { type: Boolean, default: false },
  twoFactorEnabled: { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
  lastLogin:     { type: Date }
});

// ─── PARCEL ───────────────────────────────────────────────────────────────────
const ParcelSchema = new mongoose.Schema({
  parcelId:       { type: String, required: true, unique: true },  // "LC-2024-00142"
  ownerWallet:    { type: String, required: true, lowercase: true },
  ownerName:      { type: String, required: true },
  county:         { type: String, required: true },
  subCounty:      { type: String, required: true },
  gpsCoordinates: { type: String, required: true },   // "-1.0332,37.0693"
  sizeAcres:      { type: Number, required: true },
  landUse:        { type: String, enum: ["residential","commercial","agricultural","industrial"], default: "residential" },
  estimatedValue: { type: Number },                   // in KES
  documentHash:   { type: String, required: true },   // SHA-256 of survey doc
  surveyDocUrl:   { type: String },                   // storage URL
  mapImageUrl:    { type: String },
  metadataURI:    { type: String },                   // IPFS URI
  nftTokenId:     { type: Number },                   // set after minting
  status:         { type: String, enum: ["pending","approved","rejected","disputed"], default: "pending" },
  isCollateral:   { type: Boolean, default: false },
  registeredAt:   { type: Date, default: Date.now },
  approvedAt:     { type: Date },
  approvedBy:     { type: String },                   // official wallet
  blockchainTxHash: { type: String },                 // tx hash of registration
  blockNumber:    { type: Number }
});

// ─── TRANSACTION (sale/transfer history) ─────────────────────────────────────
const TransactionSchema = new mongoose.Schema({
  transactionType: { type: String, enum: ["registration","transfer","loan","dispute"], required: true },
  parcelId:       { type: String, required: true },
  fromWallet:     { type: String, lowercase: true },
  toWallet:       { type: String, lowercase: true },
  priceKES:       { type: Number },
  priceWei:       { type: String },                   // stored as string (BigNumber safe)
  escrowId:       { type: Number },
  txHash:         { type: String, required: true },   // blockchain transaction hash
  blockNumber:    { type: Number },
  status:         { type: String, enum: ["pending","confirmed","failed"], default: "pending" },
  timestamp:      { type: Date, default: Date.now }
});

// ─── DOCUMENT ─────────────────────────────────────────────────────────────────
const DocumentSchema = new mongoose.Schema({
  parcelId:       { type: String, required: true },
  uploaderWallet: { type: String, required: true, lowercase: true },
  documentType:   { type: String, enum: ["survey_map","title_deed","id_copy","court_order","evidence","other"], required: true },
  fileName:       { type: String, required: true },
  fileSize:       { type: Number },                   // bytes
  mimeType:       { type: String },
  storageUrl:     { type: String, required: true },   // cloud storage URL
  sha256Hash:     { type: String, required: true },   // for blockchain verification
  ipfsHash:       { type: String },
  uploadedAt:     { type: Date, default: Date.now }
});

// ─── DISPUTE ──────────────────────────────────────────────────────────────────
const DisputeSchema = new mongoose.Schema({
  disputeId:          { type: Number, required: true, unique: true },  // matches on-chain ID
  parcelId:           { type: String, required: true },
  claimantWallet:     { type: String, required: true, lowercase: true },
  respondentWallet:   { type: String, required: true, lowercase: true },
  description:        { type: String, required: true },
  claimantEvidence:   [{ type: String }],             // document IDs
  respondentEvidence: [{ type: String }],
  arbitrators:        [{ type: String }],             // wallet addresses
  votes: [{
    arbitratorWallet: String,
    forClaimant:      Boolean,
    votedAt:          Date
  }],
  status:             { type: String, enum: ["filed","under_review","resolved","dismissed"], default: "filed" },
  verdict:            { type: String, enum: ["pending","claimant_wins","respondent_wins"], default: "pending" },
  verdictReason:      { type: String },
  filedAt:            { type: Date, default: Date.now },
  resolvedAt:         { type: Date },
  blockchainTxHash:   { type: String }
});

// ─── LOAN ─────────────────────────────────────────────────────────────────────
const LoanSchema = new mongoose.Schema({
  loanId:           { type: Number, required: true, unique: true },
  parcelId:         { type: String, required: true },
  borrowerWallet:   { type: String, required: true, lowercase: true },
  lenderWallet:     { type: String, lowercase: true },
  principalKES:     { type: Number, required: true },
  principalWei:     { type: String, required: true },
  interestRateBps:  { type: Number },
  durationDays:     { type: Number, required: true },
  totalRepayable:   { type: String },
  amountRepaid:     { type: String, default: "0" },
  status:           { type: String, enum: ["applied","active","repaid","defaulted","rejected"], default: "applied" },
  appliedAt:        { type: Date, default: Date.now },
  fundedAt:         { type: Date },
  deadline:         { type: Date },
  repaidAt:         { type: Date },
  repayments: [{
    amount:   String,
    txHash:   String,
    paidAt:   Date
  }]
});

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────
const AuditLogSchema = new mongoose.Schema({
  action:       { type: String, required: true },       // "PARCEL_REGISTERED", "HACK_ATTEMPT", etc.
  actorWallet:  { type: String, lowercase: true },
  actorIp:      { type: String },
  targetId:     { type: String },                       // parcelId, disputeId, etc.
  details:      { type: mongoose.Schema.Types.Mixed },
  severity:     { type: String, enum: ["info","warning","critical"], default: "info" },
  txHash:       { type: String },
  timestamp:    { type: Date, default: Date.now }
});

// ─── MARKET DATA (for price dashboard) ───────────────────────────────────────
const MarketDataSchema = new mongoose.Schema({
  county:        { type: String, required: true },
  subCounty:     { type: String },
  landUse:       { type: String },
  avgPricePerAcreKES: { type: Number },
  totalSales:    { type: Number },
  recordedMonth: { type: String },                     // "2024-01"
  updatedAt:     { type: Date, default: Date.now }
});

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
module.exports = {
  User:        mongoose.model("User",        UserSchema),
  Parcel:      mongoose.model("Parcel",      ParcelSchema),
  Transaction: mongoose.model("Transaction", TransactionSchema),
  Document:    mongoose.model("Document",    DocumentSchema),
  Dispute:     mongoose.model("Dispute",     DisputeSchema),
  Loan:        mongoose.model("Loan",        LoanSchema),
  AuditLog:    mongoose.model("AuditLog",    AuditLogSchema),
  MarketData:  mongoose.model("MarketData",  MarketDataSchema),
};
