/**
 * LandChain Demo Seed Script
 * Run: node seed.js
 * Adds 10 demo users + sample parcels, disputes, loans, transactions
 * Uses the free Hardhat test wallets already on your machine
 */

require("dotenv").config();
const mongoose = require("mongoose");

// ── MongoDB connection ────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/landchain";

// ── Hardhat test wallet addresses (free, pre-loaded with 10,000 ETH each) ───
// These come from running: npx hardhat node
const WALLETS = [
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", // Account #0  — Admin
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8", // Account #1  — Government Official
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc", // Account #2  — Land Owner 1
  "0x90f79bf6eb2c4f870365e785982e1f101e93b906", // Account #3  — Land Owner 2
  "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65", // Account #4  — Land Owner 3
  "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc", // Account #5  — Arbitrator 1
  "0x976ea74026e726554db657fa54763abd0c3a0aa9", // Account #6  — Arbitrator 2
  "0x14dc79964da2c08b23698b3d3cc7ca32193d9955", // Account #7  — Arbitrator 3
  "0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f", // Account #8  — Land Owner 4
  "0xa0ee7a142d267c1f36714e4a8f75612f20a79720", // Account #9  — Public Verifier
];

// ── 10 Demo users ─────────────────────────────────────────────────────────────
const USERS = [
  {
    walletAddress: WALLETS[0],
    fullName:      "James Kariuki Mwangi",
    nationalId:    "12345678",
    phone:         "+254712000001",
    email:         "james.kariuki@landchain.io",
    role:          "admin",
    isVerified:    true,
    language:      "en",
  },
  {
    walletAddress: WALLETS[1],
    fullName:      "Grace Achieng Otieno",
    nationalId:    "23456789",
    phone:         "+254723000002",
    email:         "grace.otieno@lands.go.ke",
    role:          "official",
    isVerified:    true,
    language:      "sw",
  },
  {
    walletAddress: WALLETS[2],
    fullName:      "Peter Kamau Njoroge",
    nationalId:    "34567890",
    phone:         "+254734000003",
    email:         "peter.njoroge@gmail.com",
    role:          "owner",
    isVerified:    true,
    language:      "en",
  },
  {
    walletAddress: WALLETS[3],
    fullName:      "Mary Wanjiku Gitau",
    nationalId:    "45678901",
    phone:         "+254745000004",
    email:         "mary.wanjiku@gmail.com",
    role:          "owner",
    isVerified:    true,
    language:      "sw",
  },
  {
    walletAddress: WALLETS[4],
    fullName:      "David Omondi Onyango",
    nationalId:    "56789012",
    phone:         "+254756000005",
    email:         "david.omondi@yahoo.com",
    role:          "owner",
    isVerified:    true,
    language:      "en",
  },
  {
    walletAddress: WALLETS[5],
    fullName:      "Dr. Sarah Mutua Kimani",
    nationalId:    "67890123",
    phone:         "+254767000006",
    email:         "sarah.mutua@jkuat.ac.ke",
    role:          "arbitrator",
    isVerified:    true,
    language:      "en",
  },
  {
    walletAddress: WALLETS[6],
    fullName:      "Hon. Robert Kipchoge Bett",
    nationalId:    "78901234",
    phone:         "+254778000007",
    email:         "robert.bett@parliament.go.ke",
    role:          "arbitrator",
    isVerified:    true,
    language:      "en",
  },
  {
    walletAddress: WALLETS[7],
    fullName:      "Advocate Fatuma Hassan",
    nationalId:    "89012345",
    phone:         "+254789000008",
    email:         "fatuma.hassan@lawfirm.co.ke",
    role:          "arbitrator",
    isVerified:    true,
    language:      "sw",
  },
  {
    walletAddress: WALLETS[8],
    fullName:      "Joseph Muthoni Ndegwa",
    nationalId:    "90123456",
    phone:         "+254790000009",
    email:         "joseph.ndegwa@gmail.com",
    role:          "owner",
    isVerified:    true,
    language:      "en",
  },
  {
    walletAddress: WALLETS[9],
    fullName:      "Agnes Chebet Korir",
    nationalId:    "01234567",
    phone:         "+254701000010",
    email:         "agnes.korir@gmail.com",
    role:          "public",
    isVerified:    true,
    language:      "sw",
  },
];

// ── Sample parcels ────────────────────────────────────────────────────────────
const PARCELS = [
  {
    parcelId:       "LC-2026-00001",
    ownerWallet:    WALLETS[2],
    ownerName:      "Peter Kamau Njoroge",
    county:         "Kiambu",
    subCounty:      "Thika",
    gpsCoordinates: "-1.0332, 37.0693",
    sizeAcres:      0.5,
    landUse:        "residential",
    estimatedValue: 4200000,
    documentHash:   "a3f1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
    metadataURI:    "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/1",
    nftTokenId:     1,
    status:         "approved",
    isCollateral:   false,
    registeredAt:   new Date("2026-01-15"),
    approvedAt:     new Date("2026-01-17"),
    approvedBy:     WALLETS[1],
    blockchainTxHash: "0x8f3a2d1c9e4b7f0a5c8d2e1b4f7a3c9d2e5b8f1a4d7e2c9e4b7f0a5c8d2e1b4",
    blockNumber:    18442891,
  },
  {
    parcelId:       "LC-2026-00002",
    ownerWallet:    WALLETS[3],
    ownerName:      "Mary Wanjiku Gitau",
    county:         "Nairobi",
    subCounty:      "Karen",
    gpsCoordinates: "-1.3167, 36.6830",
    sizeAcres:      0.25,
    landUse:        "residential",
    estimatedValue: 8500000,
    documentHash:   "b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5",
    metadataURI:    "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/2",
    nftTokenId:     2,
    status:         "approved",
    isCollateral:   true,
    registeredAt:   new Date("2026-01-20"),
    approvedAt:     new Date("2026-01-22"),
    approvedBy:     WALLETS[1],
    blockchainTxHash: "0x9a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4",
    blockNumber:    18445200,
  },
  {
    parcelId:       "LC-2026-00003",
    ownerWallet:    WALLETS[4],
    ownerName:      "David Omondi Onyango",
    county:         "Nakuru",
    subCounty:      "Nakuru East",
    gpsCoordinates: "-0.3031, 36.0800",
    sizeAcres:      2.0,
    landUse:        "agricultural",
    estimatedValue: 2800000,
    documentHash:   "c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    metadataURI:    "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/3",
    nftTokenId:     3,
    status:         "approved",
    isCollateral:   false,
    registeredAt:   new Date("2026-02-01"),
    approvedAt:     new Date("2026-02-03"),
    approvedBy:     WALLETS[1],
    blockchainTxHash: "0xab1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1",
    blockNumber:    18448500,
  },
  {
    parcelId:       "LC-2026-00004",
    ownerWallet:    WALLETS[8],
    ownerName:      "Joseph Muthoni Ndegwa",
    county:         "Kisumu",
    subCounty:      "Kisumu Central",
    gpsCoordinates: "-0.0917, 34.7680",
    sizeAcres:      0.75,
    landUse:        "commercial",
    estimatedValue: 6100000,
    documentHash:   "d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7",
    metadataURI:    "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/4",
    nftTokenId:     4,
    status:         "approved",
    isCollateral:   false,
    registeredAt:   new Date("2026-02-10"),
    approvedAt:     new Date("2026-02-12"),
    approvedBy:     WALLETS[1],
    blockchainTxHash: "0xbc2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2",
    blockNumber:    18452100,
  },
  {
    parcelId:       "LC-2026-00005",
    ownerWallet:    WALLETS[2],
    ownerName:      "Peter Kamau Njoroge",
    county:         "Mombasa",
    subCounty:      "Nyali",
    gpsCoordinates: "-4.0435, 39.6682",
    sizeAcres:      0.3,
    landUse:        "residential",
    estimatedValue: 5500000,
    documentHash:   "e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8",
    metadataURI:    "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/5",
    nftTokenId:     5,
    status:         "disputed",
    isCollateral:   false,
    registeredAt:   new Date("2026-02-20"),
    approvedAt:     new Date("2026-02-22"),
    approvedBy:     WALLETS[1],
    blockchainTxHash: "0xcd3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3",
    blockNumber:    18455800,
  },
  {
    parcelId:       "LC-2026-00006",
    ownerWallet:    WALLETS[4],
    ownerName:      "David Omondi Onyango",
    county:         "Uasin Gishu",
    subCounty:      "Eldoret East",
    gpsCoordinates: "0.5203, 35.2699",
    sizeAcres:      5.0,
    landUse:        "agricultural",
    estimatedValue: 3200000,
    documentHash:   "f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9",
    metadataURI:    "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/6",
    status:         "pending",
    isCollateral:   false,
    registeredAt:   new Date("2026-03-01"),
  },
];

// ── Sample disputes ───────────────────────────────────────────────────────────
const DISPUTES = [
  {
    disputeId:        1,
    parcelId:         "LC-2026-00005",
    claimantWallet:   WALLETS[3],
    respondentWallet: WALLETS[2],
    description:      "The boundary of parcel LC-2026-00005 overlaps with my inherited land in Nyali. My late father purchased this plot in 2008 and I have evidence of payment. The current registered owner obtained the title through forged documents.",
    claimantEvidence: ["QmEvidence1Hash3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c"],
    respondentEvidence: ["QmEvidence2Hash4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9"],
    arbitrators:      [WALLETS[5], WALLETS[6], WALLETS[7]],
    votes: [
      { arbitratorWallet: WALLETS[5], forClaimant: true,  votedAt: new Date("2026-03-10") },
      { arbitratorWallet: WALLETS[6], forClaimant: false, votedAt: new Date("2026-03-11") },
    ],
    status:           "under_review",
    verdict:          "pending",
    filedAt:          new Date("2026-03-05"),
    blockchainTxHash: "0xde4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4",
  },
];

// ── Sample loans ──────────────────────────────────────────────────────────────
const LOANS = [
  {
    loanId:           1,
    parcelId:         "LC-2026-00002",
    borrowerWallet:   WALLETS[3],
    lenderWallet:     WALLETS[0],
    principalKES:     500000,
    principalWei:     "1315789473684210",
    interestRateBps:  1000,
    durationDays:     90,
    totalRepayable:   "1348684210526315",
    amountRepaid:     "400000000000000",
    status:           "active",
    appliedAt:        new Date("2026-02-25"),
    fundedAt:         new Date("2026-02-27"),
    deadline:         new Date("2026-05-28"),
    repayments: [
      { amount: "400000000000000", paidAt: new Date("2026-03-15") },
    ],
  },
  {
    loanId:           2,
    parcelId:         "LC-2026-00003",
    borrowerWallet:   WALLETS[4],
    principalKES:     200000,
    principalWei:     "526315789473684",
    durationDays:     60,
    amountRepaid:     "0",
    status:           "applied",
    appliedAt:        new Date("2026-03-20"),
  },
];

// ── Sample transactions ────────────────────────────────────────────────────────
const TRANSACTIONS = [
  {
    transactionType: "registration",
    parcelId:        "LC-2026-00001",
    toWallet:        WALLETS[2],
    txHash:          "0x8f3a2d1c9e4b7f0a5c8d2e1b4f7a3c9d2e5b8f1a4d7e2c9e4b7f0a5c8d2e1b4",
    blockNumber:     18442891,
    status:          "confirmed",
    timestamp:       new Date("2026-01-17"),
  },
  {
    transactionType: "registration",
    parcelId:        "LC-2026-00002",
    toWallet:        WALLETS[3],
    txHash:          "0x9a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4",
    blockNumber:     18445200,
    status:          "confirmed",
    timestamp:       new Date("2026-01-22"),
  },
  {
    transactionType: "transfer",
    parcelId:        "LC-2026-00001",
    fromWallet:      WALLETS[2],
    toWallet:        WALLETS[8],
    priceKES:        4200000,
    priceWei:        "11052631578947368",
    txHash:          "0xef5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5",
    blockNumber:     18460000,
    status:          "pending",
    timestamp:       new Date("2026-03-25"),
  },
  {
    transactionType: "loan",
    parcelId:        "LC-2026-00002",
    fromWallet:      WALLETS[0],
    toWallet:        WALLETS[3],
    priceWei:        "1315789473684210",
    txHash:          "0xfa6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6",
    blockNumber:     18452800,
    status:          "confirmed",
    timestamp:       new Date("2026-02-27"),
  },
  {
    transactionType: "dispute",
    parcelId:        "LC-2026-00005",
    fromWallet:      WALLETS[3],
    txHash:          "0xde4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4",
    blockNumber:     18458200,
    status:          "confirmed",
    timestamp:       new Date("2026-03-05"),
  },
];

// ── Sample audit logs ─────────────────────────────────────────────────────────
const AUDIT_LOGS = [
  { action:"PARCEL_REGISTERED",  actorWallet:WALLETS[2], actorIp:"41.90.64.12",  targetId:"LC-2026-00001", severity:"info",     details:{ county:"Kiambu", sizeAcres:0.5 },        timestamp: new Date("2026-01-15") },
  { action:"PARCEL_APPROVED",    actorWallet:WALLETS[1], actorIp:"41.90.64.10",  targetId:"LC-2026-00001", severity:"info",     details:{ nftTokenId:1 },                           timestamp: new Date("2026-01-17") },
  { action:"PARCEL_REGISTERED",  actorWallet:WALLETS[3], actorIp:"41.90.65.22",  targetId:"LC-2026-00002", severity:"info",     details:{ county:"Nairobi", sizeAcres:0.25 },       timestamp: new Date("2026-01-20") },
  { action:"PARCEL_APPROVED",    actorWallet:WALLETS[1], actorIp:"41.90.64.10",  targetId:"LC-2026-00002", severity:"info",     details:{ nftTokenId:2 },                           timestamp: new Date("2026-01-22") },
  { action:"LOAN_APPLIED",       actorWallet:WALLETS[3], actorIp:"41.90.65.22",  targetId:"LC-2026-00002", severity:"info",     details:{ loanId:1, principalKES:500000 },          timestamp: new Date("2026-02-25") },
  { action:"PARCEL_REGISTERED",  actorWallet:WALLETS[4], actorIp:"105.160.12.9", targetId:"LC-2026-00003", severity:"info",     details:{ county:"Nakuru", sizeAcres:2.0 },         timestamp: new Date("2026-02-01") },
  { action:"PARCEL_APPROVED",    actorWallet:WALLETS[1], actorIp:"41.90.64.10",  targetId:"LC-2026-00003", severity:"info",     details:{ nftTokenId:3 },                           timestamp: new Date("2026-02-03") },
  { action:"ESCROW_CREATED",     actorWallet:WALLETS[2], actorIp:"41.90.64.12",  targetId:"LC-2026-00001", severity:"info",     details:{ buyerWallet:WALLETS[8], priceKES:4200000 },timestamp: new Date("2026-03-25") },
  { action:"DISPUTE_FILED",      actorWallet:WALLETS[3], actorIp:"41.90.65.22",  targetId:"LC-2026-00005", severity:"warning",  details:{ disputeId:1 },                            timestamp: new Date("2026-03-05") },
  { action:"UNAUTHORIZED_ACCESS_ATTEMPT", actorWallet:WALLETS[9], actorIp:"196.201.45.88", targetId:"/api/admin", severity:"critical", details:{ requiredRoles:"admin", userRole:"public" }, timestamp: new Date("2026-03-10") },
  { action:"ROLE_CHANGED",       actorWallet:WALLETS[0], actorIp:"41.90.64.12",  targetId:WALLETS[5],      severity:"warning",  details:{ newRole:"arbitrator" },                   timestamp: new Date("2026-01-10") },
  { action:"USER_LOGIN",         actorWallet:WALLETS[2], actorIp:"41.90.64.12",  targetId:null,            severity:"info",     details:{},                                         timestamp: new Date("2026-03-28") },
  { action:"PARCEL_REGISTERED",  actorWallet:WALLETS[8], actorIp:"105.160.14.3", targetId:"LC-2026-00004", severity:"info",     details:{ county:"Kisumu", sizeAcres:0.75 },        timestamp: new Date("2026-02-10") },
  { action:"PARCEL_APPROVED",    actorWallet:WALLETS[1], actorIp:"41.90.64.10",  targetId:"LC-2026-00004", severity:"info",     details:{ nftTokenId:4 },                           timestamp: new Date("2026-02-12") },
  { action:"LOAN_APPLIED",       actorWallet:WALLETS[4], actorIp:"105.160.12.9", targetId:"LC-2026-00003", severity:"info",     details:{ loanId:2, principalKES:200000 },          timestamp: new Date("2026-03-20") },
];

// ── Schemas (inline, no separate model file needed) ───────────────────────────
const UserSchema = new mongoose.Schema({
  walletAddress: String, fullName: String, nationalId: String, phone: String,
  email: String, role: String, language: String, isVerified: Boolean,
  twoFactorEnabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }, lastLogin: Date
});
const ParcelSchema = new mongoose.Schema({ parcelId: String, ownerWallet: String,
  ownerName: String, county: String, subCounty: String, gpsCoordinates: String,
  sizeAcres: Number, landUse: String, estimatedValue: Number, documentHash: String,
  metadataURI: String, nftTokenId: Number, status: String, isCollateral: Boolean,
  registeredAt: Date, approvedAt: Date, approvedBy: String,
  blockchainTxHash: String, blockNumber: Number, surveyDocUrl: String
});
const DisputeSchema = new mongoose.Schema({ disputeId: Number, parcelId: String,
  claimantWallet: String, respondentWallet: String, description: String,
  claimantEvidence: [String], respondentEvidence: [String], arbitrators: [String],
  votes: [{ arbitratorWallet: String, forClaimant: Boolean, votedAt: Date }],
  status: String, verdict: String, verdictReason: String,
  filedAt: Date, resolvedAt: Date, blockchainTxHash: String
});
const LoanSchema = new mongoose.Schema({ loanId: Number, parcelId: String,
  borrowerWallet: String, lenderWallet: String, principalKES: Number,
  principalWei: String, interestRateBps: Number, durationDays: Number,
  totalRepayable: String, amountRepaid: { type: String, default: "0" },
  status: String, appliedAt: Date, fundedAt: Date, deadline: Date, repaidAt: Date,
  repayments: [{ amount: String, paidAt: Date }]
});
const TransactionSchema = new mongoose.Schema({ transactionType: String,
  parcelId: String, fromWallet: String, toWallet: String, priceKES: Number,
  priceWei: String, escrowId: Number, txHash: String, blockNumber: Number,
  status: String, timestamp: { type: Date, default: Date.now }
});
const AuditSchema = new mongoose.Schema({ action: String, actorWallet: String,
  actorIp: String, targetId: String, details: mongoose.Schema.Types.Mixed,
  severity: String, txHash: String, timestamp: { type: Date, default: Date.now }
});

// ── Main seed function ────────────────────────────────────────────────────────
async function seed() {
  console.log("\n========================================");
  console.log("  LandChain — Demo Data Seed Script");
  console.log("========================================\n");

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB:", MONGO_URI);

  const User        = mongoose.model("User",        UserSchema);
  const Parcel      = mongoose.model("Parcel",      ParcelSchema);
  const Dispute     = mongoose.model("Dispute",     DisputeSchema);
  const Loan        = mongoose.model("Loan",        LoanSchema);
  const Transaction = mongoose.model("Transaction", TransactionSchema);
  const AuditLog    = mongoose.model("AuditLog",    AuditSchema);

  // Clear existing data
  console.log("\n🗑  Clearing existing data...");
  await Promise.all([
    User.deleteMany({}), Parcel.deleteMany({}), Dispute.deleteMany({}),
    Loan.deleteMany({}), Transaction.deleteMany({}), AuditLog.deleteMany({})
  ]);
  console.log("   Done.");

  // Insert users
  console.log("\n👥 Seeding 10 demo users...");
  await User.insertMany(USERS);
  USERS.forEach((u,i) => {
    const roleLabel = u.role.padEnd(10);
    console.log(`   [${i+1}] ${roleLabel} | ${u.fullName.padEnd(30)} | ${u.walletAddress.slice(0,14)}...`);
  });

  // Insert parcels
  console.log("\n🏡 Seeding 6 land parcels...");
  await Parcel.insertMany(PARCELS);
  PARCELS.forEach(p => {
    console.log(`   ${p.parcelId} | ${p.county.padEnd(12)} | ${p.sizeAcres} acres | ${p.status}`);
  });

  // Insert disputes
  console.log("\n⚖  Seeding 1 active dispute...");
  await Dispute.insertMany(DISPUTES);
  DISPUTES.forEach(d => {
    console.log(`   Dispute #${d.disputeId} | ${d.parcelId} | ${d.status}`);
  });

  // Insert loans
  console.log("\n💰 Seeding 2 loans...");
  await Loan.insertMany(LOANS);
  LOANS.forEach(l => {
    console.log(`   Loan #${l.loanId} | ${l.parcelId} | KES ${l.principalKES?.toLocaleString()} | ${l.status}`);
  });

  // Insert transactions
  console.log("\n⇄  Seeding 5 transactions...");
  await Transaction.insertMany(TRANSACTIONS);
  TRANSACTIONS.forEach(t => {
    console.log(`   ${t.transactionType.padEnd(12)} | ${t.parcelId} | ${t.status}`);
  });

  // Insert audit logs
  console.log("\n🔍 Seeding 15 audit log entries...");
  await AuditLog.insertMany(AUDIT_LOGS);
  console.log("   Done.");

  console.log("\n========================================");
  console.log("  ✅ ALL DEMO DATA SEEDED SUCCESSFULLY!");
  console.log("========================================\n");
  console.log("METAMASK WALLETS FOR PRESENTATION:");
  console.log("-----------------------------------");
  console.log("Import these private keys into MetaMask:");
  console.log("(Hardhat Account #0 = Admin)");
  console.log("Private Key #0: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
  console.log("Private Key #1: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
  console.log("Private Key #2: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
  console.log("Private Key #3: 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
  console.log("Private Key #4: 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a");
  console.log("\nUser Summary:");
  console.log("  Wallet #0 → Admin         (James Kariuki Mwangi)");
  console.log("  Wallet #1 → Official      (Grace Achieng Otieno)");
  console.log("  Wallet #2 → Owner         (Peter Kamau Njoroge)   — 2 parcels");
  console.log("  Wallet #3 → Owner         (Mary Wanjiku Gitau)    — 1 parcel + active loan");
  console.log("  Wallet #4 → Owner         (David Omondi Onyango)  — 2 parcels + loan");
  console.log("  Wallet #5 → Arbitrator    (Dr. Sarah Mutua Kimani)");
  console.log("  Wallet #6 → Arbitrator    (Hon. Robert Kipchoge Bett)");
  console.log("  Wallet #7 → Arbitrator    (Advocate Fatuma Hassan)");
  console.log("  Wallet #8 → Owner         (Joseph Muthoni Ndegwa) — 1 parcel");
  console.log("  Wallet #9 → Public        (Agnes Chebet Korir)");
  console.log("\nRun the app and log in with any of the above wallets.");
  console.log("========================================\n");

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});
