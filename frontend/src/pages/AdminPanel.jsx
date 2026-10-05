// frontend/src/pages/AdminPanel.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

const TABS = ["Overview","Pending Approvals","Users","Audit Trail"];

export default function AdminPanel() {
  const { t }    = useTranslation();
  const [tab,    setTab]    = useState("Overview");
  const [stats,  setStats]  = useState(null);
  const [pending, setPending] = useState([]);
  const [users,  setUsers]  = useState([]);
  const [audit,  setAudit]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [sr, pr, ur, ar] = await Promise.all([
        axios.get("/api/admin/stats"),
        axios.get("/api/admin/pending"),
        axios.get("/api/admin/users"),
        axios.get("/api/admin/audit?limit=30")
      ]);
      setStats(sr.data.stats);
      setPending(pr.data.parcels || []);
      setUsers(ur.data.users || []);
      setAudit(ar.data.logs || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function approveParcel(parcelId) {
    try {
      await axios.post(`/api/parcels/${parcelId}/approve`);
      toast.success(`Parcel ${parcelId} approved and NFT minted!`);
      loadAll();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  }

  async function rejectParcel(parcelId) {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    try {
      await axios.post(`/api/parcels/${parcelId}/reject`, { reason });
      toast.success("Parcel rejected");
      loadAll();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  }

  async function changeRole(wallet, role) {
    try {
      await axios.patch(`/api/admin/users/${wallet}/role`, { role });
      toast.success("Role updated");
      loadAll();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  }

  const severityDot = sev => {
    const col = { info:"#1D9E75", warning:"#EF9F27", critical:"#E24B4A" }[sev] || "#888";
    return <span style={{ width:8, height:8, borderRadius:"50%", background:col,
      display:"inline-block", marginRight:8, flexShrink:0 }} />;
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t("admin")}</h1>
        <p className="page-subtitle">System control panel — manage approvals, users, and monitor security.</p>
      </div>

      {/* Tab navigation */}
      <div style={{ display:"flex", gap:4, marginBottom:20,
        borderBottom:"1px solid var(--border)", paddingBottom:0 }}>
        {TABS.map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            style={{ padding:"8px 16px", background:"transparent", border:"none",
              borderBottom: tab === tb ? "2px solid #1A5276" : "2px solid transparent",
              color: tab === tb ? "#1A5276" : "var(--text-muted)",
              fontWeight: tab === tb ? 600 : 400, cursor:"pointer", fontSize:13 }}>
            {tb}
            {tb === "Pending Approvals" && pending.length > 0 && (
              <span style={{ marginLeft:6, background:"var(--danger)", color:"#fff",
                borderRadius:"50%", width:18, height:18, display:"inline-flex",
                alignItems:"center", justifyContent:"center", fontSize:10 }}>
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "Overview" && stats && (
        <div>
          <div className="card-grid-4" style={{ marginBottom:20 }}>
            {[
              { label:"Total Users",         value: stats.totalUsers },
              { label:"Total Parcels",        value: stats.totalParcels },
              { label:"Pending Approvals",    value: stats.pendingApprovals, alert: stats.pendingApprovals > 0 },
              { label:"Active Disputes",      value: stats.activeDisputes, alert: stats.activeDisputes > 0 },
              { label:"Active Loans",         value: stats.activeLoans },
              { label:"Fraud Attempts Blocked",value: stats.fraudAttempts, alert: stats.fraudAttempts > 0 },
              { label:"Approved Parcels",     value: stats.approvedParcels },
              { label:"NFTs on Chain",        value: stats.chainStats?.totalNFTs || "—" },
            ].map((s, i) => (
              <div key={i} className="stat-card">
                <div className="stat-card-label">{s.label}</div>
                <div className="stat-card-value"
                  style={{ color: s.alert ? "var(--danger)" : "var(--text)" }}>
                  {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Role breakdown */}
          <div className="card">
            <div className="card-title">User Role Distribution</div>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              {["public","owner","official","arbitrator","admin"].map(role => {
                const count = users.filter(u => u.role === role).length;
                const colors = { public:"#1A5276", owner:"#1D9E75", official:"#EF9F27",
                  arbitrator:"#E24B4A", admin:"#534AB7" };
                return (
                  <div key={role} style={{ flex:"1 1 120px", padding:14,
                    background:"var(--bg)", borderRadius:"var(--radius)",
                    border:"1px solid var(--border)", textAlign:"center" }}>
                    <div style={{ width:36, height:36, borderRadius:"50%",
                      background:colors[role], margin:"0 auto 8px",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      color:"#fff", fontWeight:700, fontSize:14 }}>
                      {role.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ fontWeight:600, fontSize:18 }}>{count}</div>
                    <div style={{ fontSize:11, color:"var(--text-muted)",
                      textTransform:"capitalize" }}>{role}s</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pending approvals tab */}
      {tab === "Pending Approvals" && (
        <div>
          {pending.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-icon">✓</div>
              <div className="empty-text">All parcels reviewed — no pending approvals.</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Parcel ID</th><th>Owner</th><th>County</th>
                    <th>Size</th><th>Submitted</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map(p => (
                    <tr key={p.parcelId}>
                      <td style={{ fontWeight:500 }}>{p.parcelId}</td>
                      <td>{p.ownerName}</td>
                      <td>{p.county}, {p.subCounty}</td>
                      <td>{p.sizeAcres} acres</td>
                      <td>{new Date(p.registeredAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display:"flex", gap:6 }}>
                          <button className="btn btn-primary btn-sm"
                            onClick={() => approveParcel(p.parcelId)}>
                            Approve
                          </button>
                          <button className="btn btn-danger btn-sm"
                            onClick={() => rejectParcel(p.parcelId)}>
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Users tab */}
      {tab === "Users" && (
        <div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Wallet</th><th>Phone</th>
                  <th>Current Role</th><th>Verified</th><th>Change Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.walletAddress}>
                    <td style={{ fontWeight:500 }}>{u.fullName}</td>
                    <td className="mono" style={{ fontSize:11 }}>
                      {u.walletAddress?.slice(0,14)}...
                    </td>
                    <td>{u.phone || "—"}</td>
                    <td>
                      <span className="badge badge-blue" style={{ textTransform:"capitalize" }}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {u.isVerified
                        ? <span className="text-success">✓ Yes</span>
                        : <span className="text-muted">No</span>}
                    </td>
                    <td>
                      <select className="form-select" style={{ width:130, padding:"4px 8px",
                        fontSize:12 }}
                        value={u.role}
                        onChange={e => changeRole(u.walletAddress, e.target.value)}>
                        {["public","owner","official","arbitrator","admin"].map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit trail tab */}
      {tab === "Audit Trail" && (
        <div className="card">
          <div className="card-title">Blockchain Audit Trail</div>
          {audit.length === 0 ? (
            <div className="empty-state"><div className="empty-text">No audit logs yet.</div></div>
          ) : (
            <div>
              {audit.map((log, i) => (
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10,
                  padding:"10px 0", borderBottom: i < audit.length-1
                    ? "1px solid var(--border)" : "none" }}>
                  {severityDot(log.severity)}
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13 }}>
                      <span style={{ fontWeight:500 }}>
                        {log.action.replace(/_/g," ").toLowerCase()
                          .replace(/^\w/, c => c.toUpperCase())}
                      </span>
                      {log.targetId && (
                        <span className="text-muted"> — {log.targetId}</span>
                      )}
                    </div>
                    <div style={{ display:"flex", gap:16, marginTop:3 }}>
                      <span className="text-muted text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      {log.actorWallet && (
                        <span className="mono text-sm text-muted">
                          {log.actorWallet.slice(0,12)}...
                        </span>
                      )}
                      {log.actorIp && (
                        <span className="text-muted text-sm">IP: {log.actorIp}</span>
                      )}
                    </div>
                  </div>
                  <span className={`badge ${
                    log.severity==="critical" ? "badge-red" :
                    log.severity==="warning"  ? "badge-amber" : "badge-green"
                  }`}>{log.severity}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
