import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";

export default function NFTDeeds() {
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("/api/parcels/my")
      .then(r => setParcels(r.data.parcels || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusBadge = s => {
    const map = { approved:"badge-green", pending:"badge-amber", rejected:"badge-red", disputed:"badge-red" };
    return <span className={`badge ${map[s]||"badge-blue"}`}>{s}</span>;
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">NFT Title Deeds</h1>
        <p className="page-subtitle">Each approved parcel is minted as a unique ERC-721 NFT.</p>
      </div>
      {parcels.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-text">No parcels found. Register land first.</div>
        </div>
      ) : (
        <div className="card-grid-3">
          {parcels.map(p => (
            <div key={p.parcelId} className="card">
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"flex-start", marginBottom:12 }}>
                {statusBadge(p.status)}
                <span className="mono" style={{ color:"var(--text-muted)" }}>
                  {p.nftTokenId ? `NFT #${p.nftTokenId}` : "Pending"}
                </span>
              </div>
              <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>
                {p.county} — {p.subCounty}
              </div>
              <div className="text-muted text-sm">{p.sizeAcres} acres · {p.landUse}</div>
              <div className="text-muted text-sm mt-1">{p.ownerName}</div>
              <div style={{ margin:"12px 0", paddingTop:12, borderTop:"1px solid var(--border)" }}>
                <div className="text-muted text-sm" style={{ marginBottom:4 }}>Document Hash</div>
                <div className="mono truncate" style={{ color:"var(--primary)", fontSize:10 }}>
                  {p.documentHash || "—"}
                </div>
              </div>
              {p.status === "approved" && (
                <a href={`/verify/${p.parcelId}`} className="btn btn-outline btn-sm"
                  style={{ textDecoration:"none", justifyContent:"center", width:"100%" }}>
                  Verify on Blockchain
                </a>
              )}
              {p.isCollateral && (
                <div className="badge badge-amber" style={{ marginTop:8, width:"100%",
                  justifyContent:"center" }}>Locked as collateral</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}