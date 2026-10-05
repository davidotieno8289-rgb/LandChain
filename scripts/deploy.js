// scripts/deploy.js
// Run: npx hardhat run scripts/deploy.js --network localhost
//      npx hardhat run scripts/deploy.js --network sepolia

const hre = require("hardhat");
const fs  = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("=======================================================");
  console.log("  LandChain — Deploying Smart Contracts");
  console.log("=======================================================");
  console.log("Deployer address :", deployer.address);
  console.log("Network          :", hre.network.name);
  console.log("-------------------------------------------------------\n");

  // ── 1. Deploy LandNFT ──────────────────────────────────────────────────────
  console.log("1. Deploying LandNFT...");
  const LandNFT = await hre.ethers.getContractFactory("LandNFT");
  const landNFT = await LandNFT.deploy();
  await landNFT.deployed();
  console.log("   LandNFT deployed at:", landNFT.address);

  // ── 2. Deploy LandRegistry ─────────────────────────────────────────────────
  console.log("2. Deploying LandRegistry...");
  const LandRegistry = await hre.ethers.getContractFactory("LandRegistry");
  const landRegistry = await LandRegistry.deploy(landNFT.address);
  await landRegistry.deployed();
  console.log("   LandRegistry deployed at:", landRegistry.address);

  // ── 3. Grant MINTER_ROLE to LandRegistry ──────────────────────────────────
  console.log("3. Granting MINTER_ROLE to LandRegistry...");
  const MINTER_ROLE = await landNFT.MINTER_ROLE();
  await landNFT.grantRole(MINTER_ROLE, landRegistry.address);
  console.log("   MINTER_ROLE granted.");

  // ── 4. Deploy LandTransfer ─────────────────────────────────────────────────
  console.log("4. Deploying LandTransfer...");
  const LandTransfer = await hre.ethers.getContractFactory("LandTransfer");
  const landTransfer = await LandTransfer.deploy(landNFT.address, landRegistry.address);
  await landTransfer.deployed();
  console.log("   LandTransfer deployed at:", landTransfer.address);

  // ── 5. Deploy DisputeResolution ────────────────────────────────────────────
  console.log("5. Deploying DisputeResolution...");
  const DisputeResolution = await hre.ethers.getContractFactory("DisputeResolution");
  const disputeResolution = await DisputeResolution.deploy(landRegistry.address);
  await disputeResolution.deployed();
  console.log("   DisputeResolution deployed at:", disputeResolution.address);

  // ── 6. Deploy LandLoan ─────────────────────────────────────────────────────
  console.log("6. Deploying LandLoan...");
  const LandLoan = await hre.ethers.getContractFactory("LandLoan");
  const landLoan = await LandLoan.deploy(landNFT.address, landRegistry.address);
  await landLoan.deployed();
  console.log("   LandLoan deployed at:", landLoan.address);

  // ── 7. Grant ADMIN_ROLE to DisputeResolution and LandLoan in LandRegistry ──
  console.log("7. Granting ADMIN_ROLE to DisputeResolution and LandLoan...");
  const ADMIN_ROLE = await landRegistry.ADMIN_ROLE();
  await landRegistry.grantRole(ADMIN_ROLE, disputeResolution.address);
  await landRegistry.grantRole(ADMIN_ROLE, landLoan.address);
  console.log("   ADMIN_ROLE granted.");

  // ── 8. Save addresses to file ──────────────────────────────────────────────
  const addresses = {
    network:           hre.network.name,
    deployedAt:        new Date().toISOString(),
    deployer:          deployer.address,
    LandNFT:           landNFT.address,
    LandRegistry:      landRegistry.address,
    LandTransfer:      landTransfer.address,
    DisputeResolution: disputeResolution.address,
    LandLoan:          landLoan.address,
  };

  const outPath = path.join(__dirname, "../deployed-addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));

  // Also write to frontend src for easy import
  const frontendPath = path.join(__dirname, "../frontend/src/contracts/addresses.json");
  if (!fs.existsSync(path.dirname(frontendPath))) {
    fs.mkdirSync(path.dirname(frontendPath), { recursive: true });
  }
  fs.writeFileSync(frontendPath, JSON.stringify(addresses, null, 2));

  console.log("\n=======================================================");
  console.log("  All contracts deployed successfully!");
  console.log("=======================================================");
  console.log(JSON.stringify(addresses, null, 2));
  console.log("\n  Addresses saved to: deployed-addresses.json");
  console.log("  & frontend/src/contracts/addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
