import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

export default function RegisterLand() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    ownerName:"", county:"", subCounty:"", gpsCoordinates:"",
    sizeAcres:"", landUse:"residential", estimatedValue:""
  });

  const COUNTIES = ["Nairobi","Mombasa","Kisumu","Nakuru","Kiambu","Machakos",
    "Kajiado","Uasin Gishu","Meru","Kilifi","Nyeri","Muranga","Kirinyaga",
    "Nyandarua","Laikipia","Samburu","Trans-Nzoia","West Pokot","Nandi",
    "Baringo","Kericho","Bomet","Kakamega","Vihiga","Bungoma","Busia",
    "Siaya","Kisii","Nyamira","Migori","Homa Bay","Kwale","Taita-Taveta",
    "Tana River","Lamu","Garissa","Wajir","Mandera","Isiolo","Marsabit",
    "Turkana","Embu","Kitui","Makueni","Tharaka-Nithi"];

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.ownerName || !form.county || !form.gpsCoordinates || !form.sizeAcres)
      return toast.error("Please fill in all required fields");
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      const file = document.getElementById("surveyDoc").files[0];
      if (file) fd.append("surveyDocument", file);
      const { data } = await axios.post("/api/parcels/register", fd);
      toast.success(`Parcel ${data.parcelId} submitted!`);
      navigate("/nft-deeds");
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed");
    } finally { setLoading(false); }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Register Land</h1>
        <p className="page-subtitle">Submit your land parcel for blockchain registration.</p>
      </div>
      <div className="card" style={{ maxWidth:600 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Owner Full Name *</label>
            <input className="form-input" value={form.ownerName}
              onChange={e => set("ownerName", e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">County *</label>
              <select className="form-select" value={form.county}
                onChange={e => set("county", e.target.value)}>
                <option value="">Select county</option>
                {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Sub-County *</label>
              <input className="form-input" value={form.subCounty}
                onChange={e => set("subCounty", e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">GPS Coordinates *</label>
            <input className="form-input" value={form.gpsCoordinates}
              onChange={e => set("gpsCoordinates", e.target.value)}
              placeholder="-1.0332, 37.0693" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Size (Acres) *</label>
              <input className="form-input" type="number" step="0.01" value={form.sizeAcres}
                onChange={e => set("sizeAcres", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Land Use</label>
              <select className="form-select" value={form.landUse}
                onChange={e => set("landUse", e.target.value)}>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="agricultural">Agricultural</option>
                <option value="industrial">Industrial</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Estimated Value (KES)</label>
            <input className="form-input" type="number" value={form.estimatedValue}
              onChange={e => set("estimatedValue", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Survey Document (PDF/JPG)</label>
            <input id="surveyDoc" type="file" accept=".pdf,.jpg,.jpeg,.png"
              className="form-input" style={{ padding:"6px 12px" }} />
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Submitting..." : "Submit to Blockchain"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}