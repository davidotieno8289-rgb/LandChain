// frontend/src/components/Layout.jsx
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";

const NAV = [
  { path: "/",          label: "dashboard",    icon: "⊞", roles: ["all"] },
  { path: "/register",  label: "registerLand", icon: "＋", roles: ["owner","admin"] },
  { path: "/nft-deeds", label: "nftDeeds",     icon: "◈", roles: ["all"] },
  { path: "/disputes",  label: "disputes",     icon: "⚖", roles: ["all"] },
  { path: "/loans",     label: "loans",        icon: "💰", roles: ["owner","admin"] },
  { path: "/verify",    label: "verify",       icon: "✓", roles: ["all"] },
  { path: "/market",    label: "market",       icon: "📊", roles: ["all"] },
  { path: "/transfers", label: "Transfers",   icon: "⇄", roles: ["all"] },
{ path: "/sms",       label: "SMS Alerts",  icon: "📱", roles: ["admin","official"] },
{ path: "/audit",     label: "Audit Trail", icon: "🔍", roles: ["admin","official"] },
  { path: "/admin",     label: "admin",        icon: "🛡", roles: ["admin","official"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { t }            = useTranslation();
  const navigate         = useNavigate();

  const visibleNav = NAV.filter(n =>
    n.roles.includes("all") || n.roles.includes(user?.role)
  );

  function changeLanguage(lang) {
    i18n.changeLanguage(lang);
    localStorage.setItem("lc_lang", lang);
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:32, height:32, background:"rgba(255,255,255,0.15)",
              borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center",
              color:"#fff", fontWeight:700, fontSize:14 }}>LC</div>
            <div>
              <div className="sidebar-logo-title">{t("appName")}</div>
              <div className="sidebar-logo-sub">{t("appSub")}</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleNav.map(n => (
            <NavLink key={n.path} to={n.path} end={n.path==="/"} className={({ isActive }) =>
              `nav-item${isActive ? " active" : ""}`}>
              <span style={{ fontSize:16 }}>{n.icon}</span>
              <span>{t(n.label)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {/* Language switcher */}
          <div style={{ display:"flex", gap:6, marginBottom:12 }}>
            {["en","sw"].map(lang => (
              <button key={lang} onClick={() => changeLanguage(lang)}
                style={{ flex:1, padding:"4px 0", borderRadius:6, border:"1px solid rgba(255,255,255,0.2)",
                  background: i18n.language===lang ? "rgba(255,255,255,0.2)" : "transparent",
                  color:"#fff", fontSize:11, cursor:"pointer" }}>
                {lang === "en" ? "English" : "Kiswahili"}
              </button>
            ))}
          </div>
          <button onClick={() => { logout(); navigate("/login"); }}
            style={{ width:"100%", padding:"8px 0", background:"rgba(255,255,255,0.1)",
              border:"1px solid rgba(255,255,255,0.2)", borderRadius:6,
              color:"rgba(255,255,255,0.8)", fontSize:12, cursor:"pointer" }}>
            {t("logout")}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div style={{ fontSize:13, color:"#6b7280" }}>
            {new Date().toLocaleDateString("en-KE", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:12, color:"#6b7280" }}>
              {user?.county || "Global"} · Network: Ethereum Sepolia
            </span>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:32, height:32, borderRadius:"50%", background:"#1A5276",
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"#fff", fontSize:12, fontWeight:600 }}>
                {user?.fullName?.charAt(0) || "?"}
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:500 }}>{user?.fullName}</div>
                <div style={{ fontSize:10, color:"#6b7280", textTransform:"capitalize" }}>{user?.role}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
