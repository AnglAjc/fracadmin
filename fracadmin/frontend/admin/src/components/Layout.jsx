import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useState, useEffect } from "react";
import api from "../lib/api";

const ICONS = {
  dashboard:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  residentes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>,
  morosos:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  pagos:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  finanzas:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  carga:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
};

const navItems = [
  { to:"/dashboard",  label:"Resumen",       icon:"dashboard" },
  { to:"/residentes", label:"Residentes",    icon:"residentes" },
  { to:"/morosos",    label:"Morosos",       icon:"morosos",  badge:"morosos" },
  { to:"/pagos",      label:"Pagos",         icon:"pagos",    badge:"pendientes" },
  { to:"/finanzas",   label:"Finanzas",      icon:"finanzas" },
  { to:"/carga",      label:"Cargar datos",  icon:"carga" },
];

const WA_ICON = <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>;

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [badges, setBadges] = useState({ morosos:0, pendientes:0 });

  useEffect(() => {
    api.get("/api/admin/dashboard")
      .then(r => setBadges({ morosos: r.data.morosos||0, pendientes: r.data.pagosPendientes||0 }))
      .catch(()=>{});
  }, []);

  return (
    <div style={{ display:"flex", minHeight:"100vh" }}>
      {/* SIDEBAR */}
      <div style={{ width:"var(--sidebar-w)", background:"var(--surface)", borderRight:"0.5px solid var(--border)", display:"flex", flexDirection:"column", flexShrink:0, position:"fixed", top:0, left:0, height:"100vh", zIndex:10 }}>
        <div style={{ padding:"1.5rem 1.25rem 1rem", borderBottom:"0.5px solid var(--border)" }}>
          <h1 style={{ fontSize:18, fontWeight:600, color:"var(--blue)" }}>FracAdmin</h1>
          <p style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>Sistema de gestión</p>
        </div>

        <nav style={{ padding:"0.75rem 0", flex:1, overflowY:"auto" }}>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to}
              style={({ isActive }) => ({
                display:"flex", alignItems:"center", gap:10,
                padding:"10px 1.25rem", textDecoration:"none", fontSize:13,
                borderLeft: isActive ? "3px solid var(--blue)" : "3px solid transparent",
                color: isActive ? "var(--blue)" : "var(--text2)",
                background: isActive ? "var(--blue-bg)" : "transparent",
                fontWeight: isActive ? 500 : 400,
              })}>
              {ICONS[item.icon]}
              <span style={{ flex:1 }}>{item.label}</span>
              {item.badge==="morosos" && badges.morosos > 0 && (
                <span style={{ background:"var(--red)", color:"#fff", borderRadius:10, fontSize:10, fontWeight:600, padding:"1px 6px" }}>{badges.morosos}</span>
              )}
              {item.badge==="pendientes" && badges.pendientes > 0 && (
                <span style={{ background:"var(--amber)", color:"#fff", borderRadius:10, fontSize:10, fontWeight:600, padding:"1px 6px" }}>{badges.pendientes}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding:"1rem 1.25rem", borderTop:"0.5px solid var(--border)" }}>
          <p style={{ fontSize:11, color:"var(--text3)", marginBottom:4 }}>Registro de pagos vía</p>
          <a href="https://formularioresidentes.onrender.com" target="_blank" rel="noreferrer"
             style={{ fontSize:12, color:"var(--blue)", textDecoration:"none", display:"flex", alignItems:"center", gap:4 }}>
            {WA_ICON} Formulario de residentes
          </a>
          <div style={{ fontSize:11, color:"var(--text2)", marginTop:12 }}>
            {admin?.nombre || admin?.email}
            {" · "}
            <button onClick={() => { logout(); navigate("/login"); }}
                    style={{ fontSize:12, color:"var(--blue)", background:"none", border:"none", cursor:"pointer", padding:0 }}>
              Salir
            </button>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ marginLeft:"var(--sidebar-w)", flex:1, minHeight:"100vh", display:"flex", flexDirection:"column" }}>
        <Outlet />
      </div>
    </div>
  );
}
