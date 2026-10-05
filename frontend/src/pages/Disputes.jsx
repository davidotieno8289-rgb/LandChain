// frontend/src/pages/Disputes.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";

export default function Disputes() {
  const { user }  = useAuth();
  const { t }     = useTranslation();
  const [disputes, setDisputes]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form,     setForm]       = useState({ parcelId:"", description:"", evidenceIPFSHash:"" });
  const [submitting, setSubmitting] = useState(false);
  const [selected,   setSelected]  = useState(null);

  useEffect(() => { loadDisputes(); }, []);

  async function loadDisputes() {
    try {
      const { data } = await axios.get("/api/disputes");
      setDisputes(data.disputes || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function fileDispute(e) {
    e.preventDefault();
    if (!form.parcelId || !form.description)
      return toast.error("Parcel ID and description are required");
    setSubmitting(true);
    try {
      await axios.post("/api/disputes/file", form);
      toast.success("Dispute filed successfully. Arbitrators will be assigned shortly.");
      setShowForm(false);
      setForm({ parcelId:"", description:"", evidenceIPFSHash:"" });
      loadDisputes();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to file dispute");
    } finally { setSubmitting(false); }
  }

  async function castVote(disputeId, forClaimant) {
    try {
      const { data } = await axios.post(`/api/disputes/${disputeId}/vote`, { forClaimant });
      toast.success(`Vote cast. ${data.forClaimant} for claimant, ${data.forRespondent} for respondent.`);
      loadDisputes();
    } catch (err) { toast.error(err.response?.data?.error || "Vote failed"); }
  }

  async function assignArbitrators(disputeId) {
    try {
      await axios.post(`/api/disputes/${disputeId}/assign`);
      toast.success("Arbitrators assigned");
      loadDisputes();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  }

  const statusBadge = s => {
    const map = { filed:"badge-blue", under_review:"badge-amber",
      resolved:"badge-green", dismissed:"badge-red" };
    return <span className={`badge ${map[s]||"badge-blue"}`}>{s.replace("_"," ")}</span>;
  };

  const verdictBadge = v => {
    if (v === "claimant_wins")   return <span className="badge badge-green">Claimant wins</span>;
    if (v === "respondent_wins") return <span className="badge badge-red">Respondent wins</span>;
    return <span className="badge badge-amber">Pending</span>;
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">{t("disputes")}</h1>
          <p className="page-subtitle">File and track land ownership disputes with transparent arbitration.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          {t("fileDispute")}
        </button>
      </div>

      {/* File dispute modal */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }}>
          <div className="card" style={{ width:480, maxWidth:"90vw" }}>
            <div className="card-title">File a New Dispute</div>
            <form onSubmit={fileDispute}>
              <div className="form-group">
                <label className="form-label">Parcel ID under dispute *</label>
                <input className="form-input" value={form.parcelId}
                  onChange={e => setForm(f => ({ ...f, parcelId: e.target.value }))}
                  placeholder="LC-2024-00142" />
              </div>
              <div className="form-group">
                <label className="form-label">Describe your claim *</label>
                <textarea className="form-input" rows={4} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Explain the basis of your claim in detail..." />
              </div>
              <div className="form-group">
                <label className="form-label">Evidence IPFS Hash (optional)</label>
                <input className="form-input" value={form.evidenceIPFSHash}
                  onChange={e => setForm(f => ({ ...f, evidenceIPFSHash: e.target.value }))}
                  placeholder="Qm..." />
              </div>
              <div style={{ background:"var(--warning-pale)", borderRadius:"var(--radius)",
                padding:10, marginBottom:16, fontSize:12, color:"#854F0B" }}>
                A bond of 0.01 ETH is required to file a dispute. This is refunded if you win.
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Dispute"}
                </button>
                <button type="button" className="btn btn-outline"
                  onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {disputes.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">⚖</div>
          <div className="empty-text">No disputes found.</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {disputes.map(d => (
            <div key={d.disputeId} className="card" style={{ cursor:"pointer" }}
              onClick={() => setSelected(selected === d.disputeId ? null : d.disputeId)}>
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <span style={{ fontWeight:600, fontSize:14 }}>
                    Dispute #{d.disputeId} — {d.parcelId}
                  </span>
                  <div className="text-muted text-sm mt-1">
                    Filed: {new Date(d.filedAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {statusBadge(d.status)}
                  {d.verdict !== "pending" && verdictBadge(d.verdict)}
                </div>
              </div>

              <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:8 }}>
                Claimant: <span style={{ color:"var(--text)", fontWeight:500 }}>
                  {d.claimantWallet?.slice(0,10)}...
                </span> vs Respondent: <span style={{ color:"var(--text)", fontWeight:500 }}>
                  {d.respondentWallet?.slice(0,10)}...
                </span>
              </div>

              {/* Vote progress bar */}
              {d.votes?.length > 0 && (
                <div style={{ marginTop:8 }}>
                  <div style={{ height:6, background:"var(--border)", borderRadius:3,
                    overflow:"hidden", marginBottom:4 }}>
                    <div style={{ height:"100%", borderRadius:3, background:"#1A5276",
                      width: `${(d.votes.filter(v=>v.forClaimant).length / 6) * 100}%`,
                      transition:"width 0.3s" }} />
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11,
                    color:"var(--text-muted)" }}>
                    <span>For claimant: {d.votes.filter(v=>v.forClaimant).length}</span>
                    <span>For respondent: {d.votes.filter(v=>!v.forClaimant).length}</span>
                    <span>{d.votes.length}/6 votes</span>
                  </div>
                </div>
              )}

              {/* Expanded detail */}
              {selected === d.disputeId && (
                <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid var(--border)" }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize:13, marginBottom:12 }}>{d.description}</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {user?.role === "admin" && d.status === "filed" && (
                      <button className="btn btn-outline btn-sm"
                        onClick={() => assignArbitrators(d.disputeId)}>
                        Assign Arbitrators
                      </button>
                    )}
                    {user?.role === "arbitrator" && d.status === "under_review" && (
                      <>
                        <button className="btn btn-primary btn-sm"
                          onClick={() => castVote(d.disputeId, true)}>
                          Vote for Claimant
                        </button>
                        <button className="btn btn-danger btn-sm"
                          onClick={() => castVote(d.disputeId, false)}>
                          Vote for Respondent
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
