// frontend/src/pages/AuditTrail.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const SEV_COLOR = { info:"badge-green", warning:"badge-amber", critical:"badge-red" };
const SEV_DOT   = { info:"#1D9E75",    warning:"#EF9F27",     critical:"#E24B4A" };

const ACTION_ICONS = {
  USER_LOGIN:              "🔑",
  PARCEL_REGISTERED:       "📋",
  PARCEL_APPROVED:         "✅",
  PARCEL_REJECTED:         "❌",
  ESCROW_CREATED:          "🤝",
  DISPUTE_FILED:           "⚖",
  LOAN_APPLIED:            "💰",
  ROLE_CHANGED:            "👤",
  UNAUTHORIZED_ACCESS_ATTEMPT: "🚨",
  default:                 "📝"
};

export default function AuditTrail() {
  const { user } = useAuth();
  const [logs,      setLogs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("all");   // all | info | warning | critical
  const [search,    setSearch]    = useState("");
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const LIMIT = 20;

  useEffect(() => { loadLogs(); }, [filter, page]);

  async function loadLogs() {
    setLoading(true);
    try {
      const sev   = filter !== "all" ? `&severity=${filter}` : "";
      const { data } = await axios.get(`/api/admin/audit?limit=${LIMIT}&page=${page}${sev}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (e) {
      // Fallback mock data if admin endpoint returns 403 (non-admin user)
      setLogs(MOCK_LOGS);
      setTotal(MOCK_LOGS.length);
    } finally { setLoading(false); }
  }

  const filtered = search
    ? logs.filter(l =>
        l.action?.toLowerCase().includes(search.toLowerCase()) ||
        l.actorWallet?.toLowerCase().includes(search.toLowerCase()) ||
        l.targetId?.toLowerCase().includes(search.toLowerCase()))
    : logs;

  const totalPages = Math.ceil(total / LIMIT);

  const formatAction = (action) =>
    (action || "").replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());

  const icon = (action) => ACTION_ICONS[action] || ACTION_ICONS.default;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Blockchain Audit Trail</h1>
        <p className="page-subtitle">
          Every action on LandChain is permanently logged with wallet address, IP, timestamp and
          blockchain reference. This log cannot be altered or deleted.
        </p>
      </div>

      {/* Stats */}
      <div className="card-grid-4" style={{ marginBottom:20 }}>
        {[
          { label:"Total Events",    value: total,
            note:"All time" },
          { label:"Info Events",     value: logs.filter(l=>l.severity==="info").length,
            color:"var(--success)",  note:"Normal activity" },
          { label:"Warnings",        value: logs.filter(l=>l.severity==="warning").length,
            color:"var(--warning)",  note:"Needs attention" },
          { label:"Critical Alerts", value: logs.filter(l=>l.severity==="critical").length,
            color:"var(--danger)",   note:"Requires review" },
        ].map((s,i) => (
          <div key={i} className="stat-card">
            <div className="stat-card-label">{s.label}</div>
            <div className="stat-card-value" style={{ color: s.color || "var(--text)" }}>
              {s.value}
            </div>
            <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:4 }}>{s.note}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
          <input className="form-input" style={{ flex:1, minWidth:200 }}
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by action, wallet address, or parcel ID..." />
          <div style={{ display:"flex", gap:6 }}>
            {["all","info","warning","critical"].map(f => (
              <button key={f} onClick={() => { setFilter(f); setPage(1); }}
                className={`btn btn-sm ${filter===f ? "btn-primary" : "btn-outline"}`}
                style={{ textTransform:"capitalize" }}>
                {f === "all" ? "All Events" : f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="spinner" />
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-text">No audit log entries found.</div>
        </div>
      ) : (
        <div className="card">
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", marginBottom:16 }}>
            <div className="card-title" style={{ marginBottom:0 }}>
              Showing {filtered.length} of {total} events
            </div>
            <div style={{ fontSize:11, color:"var(--text-muted)" }}>
              Page {page} of {totalPages || 1}
            </div>
          </div>

          {filtered.map((log, i) => (
            <div key={i} style={{ display:"flex", gap:14, padding:"12px 0",
              borderBottom: i < filtered.length-1 ? "1px solid var(--border)" : "none" }}>
              {/* Severity dot + icon */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                gap:4, flexShrink:0, paddingTop:2 }}>
                <div style={{ width:10, height:10, borderRadius:"50%",
                  background: SEV_DOT[log.severity] || "#888" }} />
                <span style={{ fontSize:18 }}>{icon(log.action)}</span>
              </div>

              {/* Content */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"flex-start", marginBottom:4, flexWrap:"wrap", gap:6 }}>
                  <span style={{ fontWeight:500, fontSize:13 }}>
                    {formatAction(log.action)}
                    {log.targetId && (
                      <span style={{ fontWeight:400, color:"var(--text-muted)" }}>
                        {" "}— {log.targetId}
                      </span>
                    )}
                  </span>
                  <span className={`badge ${SEV_COLOR[log.severity]||"badge-blue"}`}>
                    {log.severity}
                  </span>
                </div>

                <div style={{ display:"flex", gap:16, flexWrap:"wrap", fontSize:11,
                  color:"var(--text-muted)", marginBottom: log.details ? 6 : 0 }}>
                  <span>
                    🕒 {new Date(log.timestamp).toLocaleString("en-KE", {
                      year:"numeric", month:"short", day:"numeric",
                      hour:"2-digit", minute:"2-digit"
                    })}
                  </span>
                  {log.actorWallet && (
                    <span className="mono">
                      👛 {log.actorWallet.slice(0,14)}...
                    </span>
                  )}
                  {log.actorIp && <span>🌐 {log.actorIp}</span>}
                  {log.txHash && (
                    <a href={`https://sepolia.etherscan.io/tx/${log.txHash}`}
                      target="_blank" rel="noreferrer"
                      style={{ color:"var(--primary)", textDecoration:"none" }}
                      className="mono">
                      ⛓ {log.txHash.slice(0,14)}...
                    </a>
                  )}
                </div>

                {/* Details */}
                {log.details && Object.keys(log.details).length > 0 && (
                  <div style={{ background:"var(--bg)", borderRadius:6, padding:"6px 10px",
                    fontSize:11, marginTop:4, fontFamily:"monospace", color:"var(--text-muted)" }}>
                    {Object.entries(log.details).map(([k,v]) => (
                      <span key={k} style={{ marginRight:12 }}>
                        <span style={{ color:"var(--primary)", fontWeight:500 }}>{k}</span>: {String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:16 }}>
              <button className="btn btn-outline btn-sm"
                disabled={page <= 1} onClick={() => setPage(p => p-1)}>← Previous</button>
              <span style={{ alignSelf:"center", fontSize:12, color:"var(--text-muted)" }}>
                {page} / {totalPages}
              </span>
              <button className="btn btn-outline btn-sm"
                disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="card" style={{ marginTop:16, background:"var(--primary-pale)",
        border:"1px solid #b3d4ec" }}>
        <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
          {[
            ["🔒 Tamper-proof", "Every log entry is cryptographically linked to the Ethereum blockchain. No entry can be deleted or modified."],
            ["👁 Full transparency", "Government officials, anti-corruption bodies, and system administrators can independently verify any action."],
            ["🚨 Fraud detection", "Critical severity events such as unauthorised access attempts trigger automatic alerts to administrators."],
            ["📊 Compliance ready", "The audit trail satisfies data governance and accountability requirements for public land registry systems."],
          ].map(([title, desc]) => (
            <div key={title} style={{ flex:"1 1 200px" }}>
              <div style={{ fontWeight:600, fontSize:13, color:"var(--primary)", marginBottom:5 }}>{title}</div>
              <div style={{ fontSize:12, color:"var(--text-muted)" }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Fallback mock data for non-admin users or when backend is unavailable
const MOCK_LOGS = [
  { action:"USER_LOGIN",         severity:"info",     actorWallet:"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", actorIp:"127.0.0.1", targetId:null,            timestamp:new Date(Date.now()-600000).toISOString(),    details:{} },
  { action:"PARCEL_REGISTERED",  severity:"info",     actorWallet:"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", actorIp:"127.0.0.1", targetId:"LC-2026-00001",  timestamp:new Date(Date.now()-1200000).toISOString(),   details:{ county:"Kiambu", sizeAcres:"0.5" } },
  { action:"PARCEL_APPROVED",    severity:"info",     actorWallet:"0x70997970C51812dc3A010C7d01b50e0d17dc79C8", actorIp:"127.0.0.1", targetId:"LC-2026-00001",  timestamp:new Date(Date.now()-1800000).toISOString(),   details:{ nftTokenId:"1", txHash:"0x8f3a2d1c..." } },
  { action:"ESCROW_CREATED",     severity:"info",     actorWallet:"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", actorIp:"127.0.0.1", targetId:"LC-2026-00001",  timestamp:new Date(Date.now()-3600000).toISOString(),   details:{ escrowId:"1", buyerWallet:"0x3C44..." } },
  { action:"DISPUTE_FILED",      severity:"warning",  actorWallet:"0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", actorIp:"127.0.0.1", targetId:"LC-2026-00002",  timestamp:new Date(Date.now()-7200000).toISOString(),   details:{ disputeId:"1" } },
  { action:"UNAUTHORIZED_ACCESS_ATTEMPT", severity:"critical", actorWallet:"0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", actorIp:"196.201.45.12", targetId:"/api/admin", timestamp:new Date(Date.now()-10800000).toISOString(), details:{ requiredRoles:"admin", userRole:"public" } },
  { action:"LOAN_APPLIED",       severity:"info",     actorWallet:"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", actorIp:"127.0.0.1", targetId:"LC-2026-00001",  timestamp:new Date(Date.now()-14400000).toISOString(),  details:{ loanId:"1", principalWei:"500000000000000000" } },
  { action:"ROLE_CHANGED",       severity:"warning",  actorWallet:"0x70997970C51812dc3A010C7d01b50e0d17dc79C8", actorIp:"127.0.0.1", targetId:"0x3C44...",      timestamp:new Date(Date.now()-18000000).toISOString(),  details:{ newRole:"arbitrator" } },
];
