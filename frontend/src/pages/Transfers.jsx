// frontend/src/pages/Transfers.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";

const STATUS_BADGE = { pending:"badge-amber", confirmed:"badge-green", failed:"badge-red" };
const TYPE_BADGE   = { registration:"badge-blue", transfer:"badge-green", loan:"badge-amber", dispute:"badge-red" };

export default function Transfers() {
  const { user } = useAuth();
  const [parcels,  setParcels]  = useState([]);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedParcel, setSelectedParcel] = useState("");
  const [form, setForm] = useState({ buyerWallet: "", priceWei: "", priceKES: "" });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const parcelRes = await axios.get("/api/parcels/my");
      const approved  = (parcelRes.data.parcels || []).filter(p => p.status === "approved" && !p.isCollateral);
      setParcels(approved);

      // Load history for all owned parcels
      const all = parcelRes.data.parcels || [];
      const histPromises = all.map(p =>
        axios.get(`/api/transfers/history/${p.parcelId}`).then(r => r.data.transactions || []).catch(() => [])
      );
      const results = await Promise.all(histPromises);
      const combined = results.flat().sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
      setHistory(combined);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function createEscrow(e) {
    e.preventDefault();
    if (!selectedParcel || !form.buyerWallet || !form.priceWei)
      return toast.error("Please fill in all fields");
    if (!/^0x[a-fA-F0-9]{40}$/.test(form.buyerWallet))
      return toast.error("Invalid buyer wallet address (must start with 0x...)");

    setSubmitting(true);
    try {
      const { data } = await axios.post("/api/transfers/escrow", {
        parcelId: selectedParcel,
        buyerWallet: form.buyerWallet,
        priceWei: form.priceWei
      });
      toast.success(`Escrow #${data.escrowId} created! Buyer can now fund and confirm.`);
      setShowForm(false);
      setForm({ buyerWallet:"", priceWei:"", priceKES:"" });
      setSelectedParcel("");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create escrow");
    } finally { setSubmitting(false); }
  }

  // rough KES ↔ Wei converter (1 ETH ≈ KES 380,000)
  function kesToWei(kes) {
    if (!kes) return "";
    const eth = parseFloat(kes) / 380000;
    return Math.round(eth * 1e18).toString();
  }
  function weiToKes(wei) {
    if (!wei) return "";
    const eth = parseFloat(wei) / 1e18;
    return Math.round(eth * 380000).toLocaleString();
  }

  if (loading) return <div className="spinner" />;

  return (
    <div>
      {/* Header */}
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Land Transfers</h1>
          <p className="page-subtitle">Create escrow-based land sales and track all transaction history on the blockchain.</p>
        </div>
        {parcels.length > 0 && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Create Transfer Escrow
          </button>
        )}
      </div>

      {/* Escrow Modal */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }}>
          <div className="card" style={{ width:500, maxWidth:"92vw" }}>
            <div className="card-title">Create Land Sale Escrow</div>
            <div style={{ background:"var(--primary-pale)", borderRadius:"var(--radius)",
              padding:12, marginBottom:16, fontSize:12, color:"var(--primary)" }}>
              How it works: Buyer deposits ETH into the smart contract. Once both parties confirm,
              your NFT title deed transfers to the buyer and the ETH releases to you — automatically. No lawyers needed.
            </div>
            <form onSubmit={createEscrow}>
              <div className="form-group">
                <label className="form-label">Select Parcel to Sell *</label>
                <select className="form-select" value={selectedParcel}
                  onChange={e => setSelectedParcel(e.target.value)}>
                  <option value="">Choose an approved parcel</option>
                  {parcels.map(p => (
                    <option key={p.parcelId} value={p.parcelId}>
                      {p.parcelId} — {p.county}, {p.subCounty} ({p.sizeAcres} acres)
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Buyer Wallet Address (0x...) *</label>
                <input className="form-input" value={form.buyerWallet}
                  onChange={e => setForm(f=>({...f, buyerWallet: e.target.value}))}
                  placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Price in KES</label>
                  <input className="form-input" type="number" value={form.priceKES}
                    onChange={e => {
                      const kes = e.target.value;
                      setForm(f=>({...f, priceKES: kes, priceWei: kesToWei(kes)}));
                    }}
                    placeholder="4200000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Price in Wei (auto-calculated) *</label>
                  <input className="form-input" value={form.priceWei}
                    onChange={e => setForm(f=>({...f, priceWei: e.target.value, priceKES:""}))}
                    placeholder="11052631578947368" />
                </div>
              </div>
              {form.priceWei && (
                <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:12, marginTop:-8 }}>
                  ≈ KES {weiToKes(form.priceWei)} · ≈ {(parseFloat(form.priceWei)/1e18).toFixed(6)} ETH
                </div>
              )}
              <div style={{ display:"flex", gap:10 }}>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Creating..." : "Lock in Escrow"}
                </button>
                <button type="button" className="btn btn-outline"
                  onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* No parcels message */}
      {parcels.length === 0 && history.length === 0 && (
        <div className="card empty-state">
          <div className="empty-icon" style={{ fontSize:40, opacity:0.3 }}>⇄</div>
          <div className="empty-text" style={{ marginTop:12 }}>
            No approved parcels available for transfer yet.
          </div>
          <a href="/register" style={{ color:"var(--primary)", fontSize:12,
            display:"block", marginTop:10, textDecoration:"none" }}>
            Register a parcel first →
          </a>
        </div>
      )}

      {/* Stats row */}
      {history.length > 0 && (
        <div className="card-grid-4" style={{ marginBottom:20 }}>
          {[
            { label:"Total Transactions",  value: history.length },
            { label:"Confirmed",           value: history.filter(t=>t.status==="confirmed").length },
            { label:"Pending",             value: history.filter(t=>t.status==="pending").length },
            { label:"Parcels Transferred", value: new Set(history.filter(t=>t.transactionType==="transfer").map(t=>t.parcelId)).size },
          ].map((s,i) => (
            <div key={i} className="stat-card">
              <div className="stat-card-label">{s.label}</div>
              <div className="stat-card-value">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Transaction history table */}
      {history.length > 0 && (
        <div className="card">
          <div className="card-title">Transaction History</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Parcel ID</th>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Value</th>
                  <th>Date</th>
                  <th>Tx Hash</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((tx, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight:500 }}>{tx.parcelId}</td>
                    <td>
                      <span className={`badge ${TYPE_BADGE[tx.transactionType]||"badge-blue"}`}>
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize:11 }}>
                      {tx.fromWallet ? tx.fromWallet.slice(0,10)+"..." : "—"}
                    </td>
                    <td className="mono" style={{ fontSize:11 }}>
                      {tx.toWallet ? tx.toWallet.slice(0,10)+"..." : "—"}
                    </td>
                    <td style={{ fontSize:12 }}>
                      {tx.priceKES
                        ? `KES ${Number(tx.priceKES).toLocaleString()}`
                        : tx.priceWei ? `${(parseFloat(tx.priceWei)/1e18).toFixed(4)} ETH` : "—"}
                    </td>
                    <td style={{ fontSize:12 }}>
                      {new Date(tx.timestamp).toLocaleDateString("en-KE", {
                        year:"numeric", month:"short", day:"numeric"
                      })}
                    </td>
                    <td>
                      {tx.txHash ? (
                        <a href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                          target="_blank" rel="noreferrer"
                          style={{ color:"var(--primary)", fontSize:11 }}
                          className="mono">
                          {tx.txHash.slice(0,12)}...
                        </a>
                      ) : "—"}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[tx.status]||"badge-amber"}`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* How escrow works explainer */}
      <div className="card" style={{ marginTop:16, background:"var(--primary-pale)",
        border:"1px solid #b3d4ec" }}>
        <div className="card-title" style={{ color:"var(--primary)" }}>How Smart Contract Escrow Works</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
          {[
            ["1. Seller creates escrow", "Sets buyer wallet + agreed price. NFT is flagged as locked."],
            ["2. Buyer funds escrow", "Buyer deposits exact ETH amount into the smart contract."],
            ["3. Both parties confirm", "Seller and buyer each digitally sign to confirm the sale."],
            ["4. Atomic execution", "NFT → Buyer. ETH → Seller. All in one transaction. No middleman."],
          ].map(([title, desc]) => (
            <div key={title}>
              <div style={{ fontWeight:600, fontSize:12, color:"var(--primary)", marginBottom:5 }}>{title}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
