// frontend/src/pages/Market.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

export default function Market() {
  const { t } = useTranslation();
  const [data,    setData]    = useState(null);
  const [trends,  setTrends]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [county,  setCounty]  = useState("");

  useEffect(() => { loadMarket(); }, [county]);

  async function loadMarket() {
    setLoading(true);
    try {
      const [mr, tr] = await Promise.all([
        axios.get(`/api/market${county ? `?county=${county}` : ""}`),
        axios.get(`/api/market/trends${county ? `?county=${county}` : ""}`)
      ]);
      setData(mr.data);
      setTrends(tr.data.trends || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // Simple bar chart rendered in pure CSS/HTML
  const BarChart = ({ items, maxVal, labelKey, valueKey, color }) => (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {items.slice(0,8).map((item, i) => {
        const pct = maxVal > 0 ? Math.round((item[valueKey] / maxVal) * 100) : 0;
        return (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:120, fontSize:12, color:"var(--text-muted)",
              textAlign:"right", flexShrink:0 }}>{item[labelKey]}</div>
            <div style={{ flex:1, height:22, background:"var(--bg)",
              borderRadius:4, overflow:"hidden", border:"1px solid var(--border)" }}>
              <div style={{ height:"100%", width:`${pct}%`, background:color || "#1A5276",
                borderRadius:4, display:"flex", alignItems:"center", paddingLeft:8,
                transition:"width 0.5s", minWidth: pct > 0 ? 2 : 0 }} />
            </div>
            <div style={{ width:80, fontSize:12, fontWeight:500, flexShrink:0 }}>
              {typeof item[valueKey] === "number"
                ? item[valueKey] > 1000
                  ? `${(item[valueKey]/1000000).toFixed(1)}M`
                  : item[valueKey].toLocaleString()
                : item[valueKey]}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (loading) return <div className="spinner" />;

  const byCounty = data?.parcelsByCounty || [];
  const maxCount = Math.max(...byCounty.map(c => c.count || 0), 1);
  const maxValue = Math.max(...byCounty.map(c => c.avgValue || 0), 1);

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">{t("market")}</h1>
          <p className="page-subtitle">Transparent land market price data — powered by blockchain transaction records.</p>
        </div>
        <select className="form-select" style={{ width:180 }}
          value={county} onChange={e => setCounty(e.target.value)}>
          <option value="">All Counties</option>
          {byCounty.map(c => (
            <option key={c._id} value={c._id}>{c._id}</option>
          ))}
        </select>
      </div>

      {/* Summary stats */}
      <div className="card-grid-4" style={{ marginBottom:20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Approved Parcels</div>
          <div className="stat-card-value">{data?.summary?.totalApprovedParcels?.toLocaleString() || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Counties with Parcels</div>
          <div className="stat-card-value">{data?.summary?.totalCounties || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Most Active County</div>
          <div className="stat-card-value" style={{ fontSize:16 }}>
            {byCounty[0]?._id || "—"}
          </div>
          <div className="stat-card-change text-muted">
            {byCounty[0]?.count || 0} parcels
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Highest Avg Value</div>
          <div className="stat-card-value" style={{ fontSize:16 }}>
            {byCounty.sort((a,b)=>(b.avgValue||0)-(a.avgValue||0))[0]?._id || "—"}
          </div>
          <div className="stat-card-change text-muted">
            KES {((byCounty[0]?.avgValue || 0)/1000000).toFixed(1)}M avg
          </div>
        </div>
      </div>

      <div className="card-grid-2" style={{ marginBottom:20 }}>
        {/* Parcels by county */}
        <div className="card">
          <div className="card-title">Registered Parcels by County</div>
          {byCounty.length === 0 ? (
            <div className="empty-state"><div className="empty-text">No data available</div></div>
          ) : (
            <BarChart items={byCounty} maxVal={maxCount}
              labelKey="_id" valueKey="count" color="#1A5276" />
          )}
        </div>

        {/* Avg value by county */}
        <div className="card">
          <div className="card-title">Average Estimated Value per County (KES)</div>
          {byCounty.filter(c => c.avgValue).length === 0 ? (
            <div className="empty-state"><div className="empty-text">No valuation data yet</div></div>
          ) : (
            <BarChart
              items={byCounty.filter(c => c.avgValue).sort((a,b) => b.avgValue - a.avgValue)}
              maxVal={maxValue} labelKey="_id" valueKey="avgValue" color="#1D9E75" />
          )}
        </div>
      </div>

      {/* Price trends over time */}
      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-title">Monthly Price Trends</div>
        {trends.length === 0 ? (
          <div style={{ textAlign:"center", padding:"32px 0", color:"var(--text-muted)", fontSize:13 }}>
            Price trend data builds up as land transfers are completed on the platform.
          </div>
        ) : (
          <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:120,
            padding:"0 8px" }}>
            {trends.map((t, i) => {
              const maxPrice = Math.max(...trends.map(x => x.avgPrice || 0), 1);
              const h = Math.max(4, Math.round(((t.avgPrice || 0) / maxPrice) * 100));
              return (
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column",
                  alignItems:"center", gap:6 }}>
                  <div style={{ fontSize:10, color:"var(--text-muted)" }}>
                    {t.sales}
                  </div>
                  <div style={{ width:"100%", height:`${h}px`, background:"#1A5276",
                    borderRadius:"4px 4px 0 0", minHeight:4 }} />
                  <div style={{ fontSize:9, color:"var(--text-muted)", textAlign:"center",
                    transform:"rotate(-35deg)", transformOrigin:"center", marginTop:4 }}>
                    {t._id}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* County breakdown table */}
      {byCounty.length > 0 && (
        <div className="card">
          <div className="card-title">Full County Breakdown</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>County</th>
                  <th>Registered Parcels</th>
                  <th>Avg Size (Acres)</th>
                  <th>Avg Estimated Value (KES)</th>
                </tr>
              </thead>
              <tbody>
                {byCounty.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight:500 }}>{c._id}</td>
                    <td>{c.count}</td>
                    <td>{c.avgSize ? c.avgSize.toFixed(2) : "—"}</td>
                    <td>{c.avgValue
                      ? `KES ${Number(c.avgValue).toLocaleString("en-KE",
                          { maximumFractionDigits:0 })}`
                      : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
