import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { connectWallet } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);
    const result = await connectWallet();
    if (result?.success) navigate("/");
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", background:"#f0f4f8" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:40, maxWidth:420,
        width:"100%", boxShadow:"0 4px 24px rgba(0,0,0,0.08)", textAlign:"center" }}>
        <div style={{ width:64, height:64, background:"#1A5276", borderRadius:16,
          display:"flex", alignItems:"center", justifyContent:"center",
          margin:"0 auto 20px", color:"#fff", fontSize:24, fontWeight:700 }}>LC</div>
        <h1 style={{ fontSize:22, fontWeight:700, marginBottom:8 }}>LandChain</h1>
        <p style={{ fontSize:13, color:"#6b7280", marginBottom:32 }}>
          Blockchain Land Registry — Secure. Transparent. Tamper-proof.
        </p>
        <button onClick={handleConnect} disabled={loading}
          style={{ width:"100%", padding:"12px 0", background:"#1A5276", color:"#fff",
            border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer",
            opacity: loading ? 0.7 : 1 }}>
          {loading ? "Connecting..." : "Connect MetaMask Wallet"}
        </button>
        <p style={{ fontSize:11, color:"#9ca3af", marginTop:16 }}>
          Your wallet is your identity. No password needed.
        </p>
        <div style={{ marginTop:24, borderTop:"1px solid #f3f4f6", paddingTop:20 }}>
          <p style={{ fontSize:12, color:"#6b7280" }}>Public land verification:</p>
          <a href="/verify" style={{ color:"#1A5276", fontSize:12, fontWeight:500 }}>
            Search land records →
          </a>
        </div>
      </div>
    </div>
  );
}