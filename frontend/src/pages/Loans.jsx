// frontend/src/pages/Loans.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

export default function Loans() {
  const { t } = useTranslation();
  const [loans,    setLoans]    = useState([]);
  const [parcels,  setParcels]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ parcelId:"", principalKES:"", principalWei:"", durationDays:"" });

  useEffect(() => {
    Promise.all([
      axios.get("/api/loans/my"),
      axios.get("/api/parcels/my")
    ]).then(([lr, pr]) => {
      setLoans(lr.data.loans || []);
      setParcels((pr.data.parcels || []).filter(p => p.status === "approved" && !p.isCollateral));
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, []);

  async function applyForLoan(e) {
    e.preventDefault();
    if (!form.parcelId || !form.principalWei || !form.durationDays)
      return toast.error("All fields are required");
    setSubmitting(true);
    try {
      await axios.post("/api/loans/apply", form);
      toast.success("Loan application submitted! Awaiting lender approval.");
      setShowForm(false);
      const { data } = await axios.get("/api/loans/my");
      setLoans(data.loans || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "Application failed");
    } finally { setSubmitting(false); }
  }

  async function makeRepayment(loanId, amount) {
    try {
      const { data } = await axios.post(`/api/loans/${loanId}/repay`, { amountWei: amount });
      toast.success(data.fullyRepaid ? "Loan fully repaid! Collateral released." : "Repayment recorded.");
      const { data: lr } = await axios.get("/api/loans/my");
      setLoans(lr.loans || []);
    } catch (err) { toast.error(err.response?.data?.error || "Repayment failed"); }
  }

  const statusBadge = s => {
    const map = { applied:"badge-blue", active:"badge-green",
      repaid:"badge-green", defaulted:"badge-red", rejected:"badge-red" };
    return <span className={`badge ${map[s]||"badge-amber"}`}>{s}</span>;
  };

  const progressPct = l => {
    if (!l.totalRepayable || l.totalRepayable === "0") return 0;
    return Math.min(100, Math.round(
      (BigInt(l.amountRepaid || "0") * 100n) / BigInt(l.totalRepayable)
    ));
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">{t("loans")}</h1>
          <p className="page-subtitle">Use your land NFT as collateral to access micro-loans without a bank.</p>
        </div>
        {parcels.length > 0 && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            {t("applyLoan")}
          </button>
        )}
      </div>

      {/* How it works banner */}
      <div className="card" style={{ marginBottom:20, background:"var(--primary-pale)",
        border:"1px solid #b3d4ec" }}>
        <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
          {[
            ["1. Apply", "Select your land parcel as collateral and set loan amount"],
            ["2. Lender approves", "Admin/lender reviews and funds the loan to your wallet"],
            ["3. NFT locked", "Your title deed NFT is locked until loan is repaid"],
            ["4. Repay & release", "Repay principal + interest to unlock your NFT"],
          ].map(([title, desc]) => (
            <div key={title} style={{ flex:"1 1 160px" }}>
              <div style={{ fontWeight:600, fontSize:13, color:"var(--primary)",
                marginBottom:4 }}>{title}</div>
              <div style={{ fontSize:12, color:"var(--text-muted)" }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Apply modal */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }}>
          <div className="card" style={{ width:460, maxWidth:"90vw" }}>
            <div className="card-title">Apply for Collateral Loan</div>
            <form onSubmit={applyForLoan}>
              <div className="form-group">
                <label className="form-label">Select Collateral Parcel *</label>
                <select className="form-select" value={form.parcelId}
                  onChange={e => setForm(f => ({ ...f, parcelId: e.target.value }))}>
                  <option value="">Choose an approved parcel</option>
                  {parcels.map(p => (
                    <option key={p.parcelId} value={p.parcelId}>
                      {p.parcelId} — {p.county}, {p.sizeAcres} acres
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Loan Amount (KES)</label>
                  <input className="form-input" type="number" value={form.principalKES}
                    onChange={e => setForm(f => ({ ...f, principalKES: e.target.value }))}
                    placeholder="500000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (Wei) *</label>
                  <input className="form-input" value={form.principalWei}
                    onChange={e => setForm(f => ({ ...f, principalWei: e.target.value }))}
                    placeholder="500000000000000000" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Loan Duration (days) *</label>
                <select className="form-select" value={form.durationDays}
                  onChange={e => setForm(f => ({ ...f, durationDays: e.target.value }))}>
                  <option value="">Select duration</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                  <option value="180">6 months</option>
                  <option value="365">1 year</option>
                </select>
              </div>
              <div style={{ background:"var(--warning-pale)", borderRadius:"var(--radius)",
                padding:10, marginBottom:16, fontSize:12, color:"#854F0B" }}>
                Your land NFT will be locked as collateral until full repayment. 
                Failure to repay by the deadline transfers ownership to the lender.
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Application"}
                </button>
                <button type="button" className="btn btn-outline"
                  onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loans list */}
      {loans.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">💰</div>
          <div className="empty-text">
            {parcels.length === 0
              ? "You need at least one approved parcel to apply for a loan."
              : "No loan applications yet."}
          </div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {loans.map(l => {
            const pct = progressPct(l);
            const daysLeft = l.deadline
              ? Math.max(0, Math.ceil((new Date(l.deadline) - Date.now()) / 86400000))
              : null;
            return (
              <div key={l.loanId} className="card">
                <div style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"flex-start", marginBottom:12 }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14 }}>
                      Loan #{l.loanId} — {l.parcelId}
                    </div>
                    <div className="text-muted text-sm mt-1">
                      Applied: {new Date(l.appliedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {statusBadge(l.status)}
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)",
                  gap:12, marginBottom:12 }}>
                  <div>
                    <div className="text-muted text-sm">Principal</div>
                    <div style={{ fontWeight:500, fontSize:13 }}>
                      KES {Number(l.principalKES || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-sm">Interest Rate</div>
                    <div style={{ fontWeight:500, fontSize:13 }}>
                      {l.interestRateBps ? `${l.interestRateBps / 100}% p.a.` : "Pending"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-sm">Days Remaining</div>
                    <div style={{ fontWeight:500, fontSize:13,
                      color: daysLeft !== null && daysLeft < 7 ? "var(--danger)" : "var(--text)" }}>
                      {daysLeft !== null ? `${daysLeft} days` : "—"}
                    </div>
                  </div>
                </div>

                {l.status === "active" && (
                  <>
                    <div style={{ marginBottom:6 }}>
                      <div style={{ height:8, background:"var(--border)",
                        borderRadius:4, overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:4,
                          background:"var(--success)", width:`${pct}%`,
                          transition:"width 0.3s" }} />
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between",
                        fontSize:11, color:"var(--text-muted)", marginTop:4 }}>
                        <span>{pct}% repaid</span>
                        <span>Deadline: {l.deadline
                          ? new Date(l.deadline).toLocaleDateString() : "—"}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8, marginTop:12 }}>
                      <button className="btn btn-primary btn-sm"
                        onClick={() => {
                          const amt = prompt("Enter repayment amount in Wei:");
                          if (amt) makeRepayment(l.loanId, amt);
                        }}>
                        Make Repayment
                      </button>
                    </div>
                  </>
                )}

                {l.status === "repaid" && (
                  <div style={{ display:"flex", alignItems:"center", gap:8,
                    color:"var(--success)", fontSize:13 }}>
                    <span>✓</span> Fully repaid — NFT collateral released
                    {l.repaidAt && ` on ${new Date(l.repaidAt).toLocaleDateString()}`}
                  </div>
                )}

                {l.status === "defaulted" && (
                  <div style={{ color:"var(--danger)", fontSize:13 }}>
                    Loan defaulted — NFT transferred to lender
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
