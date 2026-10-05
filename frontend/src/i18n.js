import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      appName:"LandChain", appSub:"Blockchain Land Registry",
      dashboard:"Dashboard", registerLand:"Register Land",
      nftDeeds:"NFT Deeds", disputes:"Disputes", loans:"Loans",
      verify:"Verify", admin:"Admin", market:"Market", logout:"Logout",
      connect:"Connect Wallet", loading:"Loading...", noData:"No records found",
      status_pending:"Pending", status_approved:"Approved",
      status_rejected:"Rejected", status_disputed:"Disputed",
      fileDispute:"File Dispute", applyLoan:"Apply for Loan",
      verifyOwnership:"Verify Ownership", submit:"Submit to Blockchain"
    }
  },
  sw: {
    translation: {
      appName:"LandChain", appSub:"Usajili wa Ardhi wa Blockchain",
      dashboard:"Dashibodi", registerLand:"Sajili Ardhi",
      nftDeeds:"Hati za NFT", disputes:"Migogoro", loans:"Mikopo",
      verify:"Thibitisha", admin:"Msimamizi", market:"Soko", logout:"Ondoka",
      connect:"Unganisha Pochi", loading:"Inapakia...", noData:"Hakuna rekodi",
      status_pending:"Inasubiri", status_approved:"Imeidhinishwa",
      status_rejected:"Imekataliwa", status_disputed:"Inapingwa",
      fileDispute:"Wasilisha Mgogoro", applyLoan:"Omba Mkopo",
      verifyOwnership:"Thibitisha Umiliki", submit:"Wasilisha kwa Blockchain"
    }
  }
};

i18n.use(initReactI18next).init({
  resources, lng: localStorage.getItem("lc_lang") || "en",
  fallbackLng: "en", interpolation: { escapeValue: false }
});

export default i18n;