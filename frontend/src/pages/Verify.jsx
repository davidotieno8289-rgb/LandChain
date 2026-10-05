// frontend/src/pages/Verify.jsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

export default function Verify() {
  const { parcelId: urlParam } = useParams();
  const navigate = useNavigate();
  const { t }    = useTranslation();
  const [query,  setQuery]   = useState(urlParam || "");
  const [result, setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function doVerify(e) {
    e?.preventDefault();
    if (!query.trim()) return toast.error("Enter a parcel ID to verify");
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await axios.get(`/api/verify/${query.trim()}`);
      setResult(data);
      navigate(`/verify/${query.trim()}`, { replace: true });
    } catch (err) {
      setResult(null);
      toast.error(err.response?.data?.error || "Parcel not found");
    } finally { setLoading(false); }
  }

  const Field = ({ label, value, mono, highlight }) => (
    <div style={{ padding:"10px 0", borderBottom:"1px solid var(--border)" }}>
      <div className="text-muted text-sm" style={{ marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight: highlight ? 600 : 400,
        fontFamily: mono ? "var(--font-mono, monospace)" : "inherit",
        color: highlight ? "var(--text)" : "var(--text)", wordBreak:"break-all" }}>
        {value || "—"}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:700, margin:"0 auto" }}>
      <div className="page-header">
        <h1 className="page-title">{t("verifyOwnership")}</h1>
        <p className="page-subtitle">Anyone can verify land ownership — no account required. Results are pulled directly from the Ethereum blockchain.</p>
      </div>

      {/* Search box */}
      <div className="card" style={{ marginBottom:20 }}>
        <form onSubmit={doVerify} style={{ display:"flex", gap:10 }}>
          <input className="form-input" style={{ flex:1 }} value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Enter Parcel ID (e.g. LC-2024-00142)" />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Searching..." : "Verify"}
          </button>
        </form>
      </div>

      {/* Loading */}
      {loading && <div className="spinner" />}

      {/* Result */}
      {result && !loading && (
        <div className="card">
          {/* Clean title indicator */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            marginBottom:20, paddingBottom:16, borderBottom:"1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize:18, fontWeight:700 }}>{result.parcelId}</div>
              <div className="text-muted text-sm mt-1">
                Registered {result.registeredAt
                  ? new Date(result.registeredAt).toLocaleDateString("en-KE",
                    { year:"numeric", month:"long", day:"numeric" })
                  : "—"}
              </div>
            </div>
            <div>
              {result.cleanTitle ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                  <span className="badge badge-green" style={{ fontSize:13, padding:"6px 14px" }}>
                    ✓ Clean Title
                  </span>
                  <span className="text-muted text-sm">Blockchain verified</span>
                </div>
              ) : (
                <span className="badge badge-red" style={{ fontSize:13, padding:"6px 14px" }}>
                  ⚠ Disputed / Not Clear
                </span>
              )}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 24px" }}>
            <div>
              <Field label="Registered Owner" value={result.ownerName} highlight />
              <Field label="Owner Wallet"     value={result.owner}    mono />
              <Field label="County"           value={result.county} />
              <Field label="Sub-County"       value={result.subCounty} />
              <Field label="Size"             value={`${result.sizeAcres} acres`} />
            </div>
            <div>
              <Field label="Status"           value={result.status} highlight />
              <Field label="NFT Token ID"     value={result.nftTokenId ? `#${result.nftTokenId}` : "Not minted"} />
              <Field label="Approved"         value={result.approvedAt
                ? new Date(result.approvedAt).toLocaleDateString() : "Pending"} />
              <Field label="Land as Collateral" value={result.isCollateral ? "Yes — locked for loan" : "No"} />
              <Field label="Active Dispute"   value={result.activeDispute
                ? `Dispute #${result.activeDispute.disputeId} — ${result.activeDispute.status}` : "None"} />
            </div>
          </div>

          <div style={{ marginTop:12 }}>
            <Field label="Document Hash (SHA-256)" value={result.documentHash} mono />
          </div>

          {/* Blockchain verification */}
          {result.blockchainVerification && !result.blockchainVerification.note && (
            <div style={{ marginTop:16, padding:14, background:"var(--primary-pale)",
              borderRadius:"var(--radius)", border:"1px solid #b3d4ec" }}>
              <div style={{ fontWeight:600, fontSize:13, color:"var(--primary)",
                marginBottom:8 }}>Blockchain Verification</div>
              <div style={{ fontSize:12, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div>
                  <span className="text-muted">On-chain owner: </span>
                  <span className="mono">{result.blockchainVerification.owner?.slice(0,16)}...</span>
                </div>
                <div>
                  <span className="text-muted">Chain status: </span>
                  <span style={{ fontWeight:500 }}>{result.blockchainVerification.status}</span>
                </div>
              </div>
            </div>
          )}

          {/* Transaction history */}
          {result.transactionHistory?.length > 0 && (
            <div style={{ marginTop:16 }}>
              <div style={{ fontWeight:600, fontSize:13, marginBottom:10 }}>Transaction History</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th><th>From</th><th>To</th><th>Date</th><th>Tx Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.transactionHistory.map((tx, i) => (
                      <tr key={i}>
                        <td><span className="badge badge-blue">{tx.transactionType}</span></td>
                        <td className="mono">{tx.fromWallet?.slice(0,10) || "—"}...</td>
                        <td className="mono">{tx.toWallet?.slice(0,10) || "—"}...</td>
                        <td>{new Date(tx.timestamp).toLocaleDateString()}</td>
                        <td className="mono" style={{ fontSize:10 }}>
                          {tx.txHash?.slice(0,14)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display:"flex", gap:8, marginTop:20, paddingTop:16,
            borderTop:"1px solid var(--border)" }}>
            <button className="btn btn-outline btn-sm"
              onClick={() => window.open(`https://sepolia.etherscan.io/address/${result.owner}`)}>
              View on Etherscan
            </button>
            <button className="btn btn-outline btn-sm"
              onClick={() => {
                const txt = JSON.stringify(result, null, 2);
                const blob = new Blob([txt], { type:"application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${result.parcelId}-verification.json`;
                a.click();
              }}>
              Download Certificate
            </button>
          </div>
        </div>
      )}

      {/* No result */}
      {searched && !result && !loading && (
        <div className="card empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-text">No parcel found for "{query}"</div>
        </div>
      )}
    </div>
  );
}
