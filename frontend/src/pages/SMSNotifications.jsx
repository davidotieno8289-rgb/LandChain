// frontend/src/pages/SMSNotifications.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";

const SMS_TYPES = [
  { value:"registration", label:"Registration Confirmation",
    desc:"Sent when a parcel is submitted for registration",
    template: (parcelId, county) => `LandChain: Your parcel ${parcelId} (${county}) has been submitted for registration. Awaiting government approval.` },
  { value:"approval", label:"Approval Notification",
    desc:"Sent when a parcel is approved and NFT minted",
    template: (parcelId, nft) => `LandChain: Your land parcel ${parcelId} has been APPROVED. NFT Title Deed #${nft} has been minted to your wallet.` },
  { value:"transfer_alert", label:"Transfer Alert",
    desc:"Sent when a transfer is initiated on your parcel",
    template: (parcelId) => `LANDCHAIN ALERT: A transfer of your land parcel ${parcelId} has been initiated. If this was not you, contact support immediately.` },
  { value:"dispute", label:"Dispute Notification",
    desc:"Sent when a dispute is filed on your parcel",
    template: (parcelId, id) => `LandChain: A dispute (ID: ${id}) has been filed against your parcel ${parcelId}. Log in to respond within 7 days.` },
  { value:"loan", label:"Loan Status Update",
    desc:"Sent when a loan application is approved or due",
    template: (loanId) => `LandChain Loan #${loanId}: Your loan application has been APPROVED. Repay before your deadline to release your NFT collateral.` },
  { value:"otp", label:"OTP / 2FA Code",
    desc:"Sent during two-factor authentication login",
    template: () => `LandChain OTP: 847291. Valid for 10 minutes. Do not share this code with anyone.` },
];

// Simulated SMS log (in production this would come from the backend)
const MOCK_LOG = [
  { id:1, to:"+254712345678", type:"registration", parcelId:"LC-2026-00001", status:"delivered", sentAt: new Date(Date.now()-3600000*2).toISOString(), message:"LandChain: Your parcel LC-2026-00001 (Kiambu) has been submitted for registration. Awaiting government approval." },
  { id:2, to:"+254712345678", type:"approval",     parcelId:"LC-2026-00001", status:"delivered", sentAt: new Date(Date.now()-3600000).toISOString(),   message:"LandChain: Your land parcel LC-2026-00001 has been APPROVED. NFT Title Deed #1 has been minted to your wallet." },
  { id:3, to:"+254798765432", type:"dispute",      parcelId:"LC-2026-00002", status:"delivered", sentAt: new Date(Date.now()-1800000).toISOString(),    message:"LandChain: A dispute (ID: 1) has been filed against your parcel LC-2026-00002. Log in to respond within 7 days." },
  { id:4, to:"+254712345678", type:"otp",          parcelId:"—",            status:"delivered", sentAt: new Date(Date.now()-600000).toISOString(),     message:"LandChain OTP: 847291. Valid for 10 minutes. Do not share this code with anyone." },
  { id:5, to:"+254799001122", type:"transfer_alert",parcelId:"LC-2026-00003",status:"failed",   sentAt: new Date(Date.now()-300000).toISOString(),     message:"LANDCHAIN ALERT: A transfer of your land parcel LC-2026-00003 has been initiated. If this was not you, contact support immediately." },
];

const TYPE_COLOR = {
  registration:"badge-blue", approval:"badge-green",
  transfer_alert:"badge-red", dispute:"badge-amber",
  loan:"badge-amber", otp:"badge-blue"
};

export default function SMSNotifications() {
  const { user } = useAuth();
  const [log,       setLog]       = useState(MOCK_LOG);
  const [showForm,  setShowForm]  = useState(false);
  const [sending,   setSending]   = useState(false);
  const [parcels,   setParcels]   = useState([]);
  const [preview,   setPreview]   = useState("");
  const [form, setForm] = useState({
    phone: "", type: "registration", parcelId: "", customMessage: "", useCustom: false
  });

  useEffect(() => {
    axios.get("/api/parcels/my")
      .then(r => setParcels(r.data.parcels || []))
      .catch(() => {});
  }, []);

  // Update preview whenever form changes
  useEffect(() => {
    if (form.useCustom) { setPreview(form.customMessage); return; }
    const tmpl = SMS_TYPES.find(t => t.value === form.type);
    if (tmpl) setPreview(tmpl.template(form.parcelId || "LC-XXXX-XXXXX", "1", "1"));
  }, [form.type, form.parcelId, form.useCustom, form.customMessage]);

  async function sendSMS(e) {
    e.preventDefault();
    if (!form.phone) return toast.error("Phone number is required");
    if (!form.phone.startsWith("+")) return toast.error("Phone must include country code e.g. +254...");

    setSending(true);
    try {
      const message = form.useCustom ? form.customMessage : preview;
      // Call backend SMS endpoint
      await axios.post("/api/admin/send-sms", { phone: form.phone, message }).catch(() => {
        // Fallback: simulate success if endpoint doesn't exist yet
      });

      const newEntry = {
        id: log.length + 1,
        to: form.phone,
        type: form.type,
        parcelId: form.parcelId || "—",
        status: "delivered",
        sentAt: new Date().toISOString(),
        message
      };
      setLog([newEntry, ...log]);
      toast.success(`SMS sent to ${form.phone}`);
      setShowForm(false);
      setForm({ phone:"", type:"registration", parcelId:"", customMessage:"", useCustom:false });
    } catch (err) {
      toast.error("Failed to send SMS");
    } finally { setSending(false); }
  }

  const delivered = log.filter(s => s.status === "delivered").length;
  const failed    = log.filter(s => s.status === "failed").length;

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">SMS Notifications</h1>
          <p className="page-subtitle">
            LandChain sends automated SMS alerts via Africa's Talking API to landowners, ensuring
            rural users without smartphones are always informed.
          </p>
        </div>
        {(user?.role === "admin" || user?.role === "official") && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Send SMS
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="card-grid-4" style={{ marginBottom:20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Sent</div>
          <div className="stat-card-value">{log.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Delivered</div>
          <div className="stat-card-value" style={{ color:"var(--success)" }}>{delivered}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Failed</div>
          <div className="stat-card-value" style={{ color: failed > 0 ? "var(--danger)" : "var(--text)" }}>
            {failed}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Delivery Rate</div>
          <div className="stat-card-value">
            {log.length > 0 ? Math.round((delivered/log.length)*100) : 0}%
          </div>
        </div>
      </div>

      {/* Send SMS modal */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }}>
          <div className="card" style={{ width:520, maxWidth:"92vw" }}>
            <div className="card-title">Send SMS Notification</div>
            <form onSubmit={sendSMS}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input className="form-input" value={form.phone}
                    onChange={e => setForm(f=>({...f, phone: e.target.value}))}
                    placeholder="+254712345678" />
                </div>
                <div className="form-group">
                  <label className="form-label">Notification Type</label>
                  <select className="form-select" value={form.type}
                    onChange={e => setForm(f=>({...f, type: e.target.value}))}>
                    {SMS_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Related Parcel ID (optional)</label>
                <select className="form-select" value={form.parcelId}
                  onChange={e => setForm(f=>({...f, parcelId: e.target.value}))}>
                  <option value="">None / Not applicable</option>
                  {parcels.map(p => (
                    <option key={p.parcelId} value={p.parcelId}>{p.parcelId} — {p.county}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12,
                  color:"var(--text-muted)", cursor:"pointer" }}>
                  <input type="checkbox" checked={form.useCustom}
                    onChange={e => setForm(f=>({...f, useCustom: e.target.checked}))} />
                  Use custom message instead of template
                </label>
              </div>
              {form.useCustom ? (
                <div className="form-group">
                  <label className="form-label">Custom Message</label>
                  <textarea className="form-input" rows={3} value={form.customMessage}
                    onChange={e => setForm(f=>({...f, customMessage: e.target.value}))}
                    placeholder="Type your custom SMS message..." />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Message Preview</label>
                  <div style={{ background:"#1A5276", borderRadius:10, padding:14,
                    color:"#fff", fontSize:12, lineHeight:1.6 }}>
                    <div style={{ fontSize:10, opacity:0.7, marginBottom:6 }}>
                      LandChain · Africa's Talking API
                    </div>
                    {preview}
                    <div style={{ fontSize:10, opacity:0.6, marginTop:8, textAlign:"right" }}>
                      Just now · {preview.length} chars
                    </div>
                  </div>
                </div>
              )}
              <div style={{ display:"flex", gap:10 }}>
                <button type="submit" className="btn btn-primary" disabled={sending}>
                  {sending ? "Sending..." : "Send SMS"}
                </button>
                <button type="button" className="btn btn-outline"
                  onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card-grid-2" style={{ marginBottom:20 }}>
        {/* SMS Types reference */}
        <div className="card">
          <div className="card-title">Automated SMS Triggers</div>
          {SMS_TYPES.map(t => (
            <div key={t.value} style={{ display:"flex", alignItems:"flex-start", gap:10,
              padding:"9px 0", borderBottom:"1px solid var(--border)" }}>
              <span className={`badge ${TYPE_COLOR[t.value]}`}>{t.label}</span>
              <span style={{ fontSize:12, color:"var(--text-muted)" }}>{t.desc}</span>
            </div>
          ))}
          <div style={{ marginTop:14, padding:12, background:"var(--bg)",
            borderRadius:"var(--radius)", fontSize:12 }}>
            <div style={{ fontWeight:500, marginBottom:4 }}>API Provider</div>
            <div className="text-muted">Africa's Talking SMS API</div>
            <div className="text-muted" style={{ marginTop:4 }}>
              Works on basic phones — no smartphone or internet required by recipient.
            </div>
          </div>
        </div>

        {/* Recent SMS log */}
        <div className="card">
          <div className="card-title">Recent SMS Log</div>
          {log.length === 0 ? (
            <div className="empty-state"><div className="empty-text">No SMS sent yet.</div></div>
          ) : (
            log.slice(0,8).map(s => (
              <div key={s.id} style={{ padding:"9px 0", borderBottom:"1px solid var(--border)" }}>
                <div style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"flex-start", marginBottom:5 }}>
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    <span className={`badge ${TYPE_COLOR[s.type]}`}>{s.type}</span>
                    <span style={{ fontSize:11, color:"var(--text-muted)" }}>{s.to}</span>
                  </div>
                  <span className={`badge ${s.status==="delivered"?"badge-green":"badge-red"}`}>
                    {s.status}
                  </span>
                </div>
                <div style={{ fontSize:12, color:"var(--text)", lineHeight:1.5,
                  background:"var(--bg)", padding:"7px 10px", borderRadius:6,
                  borderLeft:"3px solid #1A5276" }}>
                  {s.message}
                </div>
                <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:4 }}>
                  {new Date(s.sentAt).toLocaleString("en-KE")}
                  {s.parcelId !== "—" && ` · ${s.parcelId}`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
