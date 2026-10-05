import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("/api/parcels/my")
      .then(r => setParcels(r.data.parcels || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusBadge = (s) => {
    const map = { approved:"badge-green", pending:"badge-amber", rejected:"badge-red", disputed:"badge-red" };
    return <span className={`badge ${map[s]||"badge-blue"}`}>{s}</span>;
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Welcome back, {user?.fullName?.split(" ")[0]}</h1>
        <p className="page-subtitle">Overview of your land records and system activity.</p>
      </div>
      <div className="card-grid-2">
        <div className="card">
          <div className="card-title flex justify-between items-center">
            <span>My Land Parcels</span>
            <span className="badge badge-blue">{parcels.length} parcels</span>
          </div>
          {parcels.length === 0 ? (
            <div className="empty-state">
              <div className="empty-text">No parcels registered yet.</div>
              <a href="/register" className="btn btn-primary btn-sm"
                style={{ display:"inline-flex", textDecoration:"none", marginTop:12 }}>
                Register your first parcel
              </a>
            </div>
          ) : (
            parcels.slice(0,5).map(p => (
              <div key={p.parcelId} style={{ display:"flex", alignItems:"center",
                justifyContent:"space-between", padding:"10px 0",
                borderBottom:"1px solid var(--border)" }}>
                <div>
                  <div className="font-medium" style={{ fontSize:13 }}>{p.parcelId}</div>
                  <div className="text-muted text-sm">{p.county}, {p.subCounty} — {p.sizeAcres} acres</div>
                </div>
                {statusBadge(p.status)}
              </div>
            ))
          )}
        </div>
        <div className="card">
          <div className="card-title">Quick Actions</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[
              { href:"/register",  label:"Register new land parcel",   icon:"+" },
              { href:"/nft-deeds", label:"View your NFT title deeds",  icon:"◈" },
              { href:"/disputes",  label:"File or view disputes",      icon:"⚖" },
              { href:"/loans",     label:"Apply for a collateral loan", icon:"$" },
              { href:"/verify",    label:"Verify any land parcel",      icon:"✓" },
              { href:"/market",    label:"Browse land market prices",   icon:"%" },
            ].map(a => (
              <a key={a.href} href={a.href} style={{ display:"flex", alignItems:"center",
                gap:10, padding:"10px 12px", background:"var(--bg)",
                borderRadius:"var(--radius)", textDecoration:"none",
                color:"var(--text)", fontSize:13, border:"1px solid var(--border)" }}>
                <span style={{ fontSize:16 }}>{a.icon}</span> {a.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}