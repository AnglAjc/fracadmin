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
  config:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
};

const navItems = [
  { to:"/dashboard",  label:"Resumen",      icon:"dashboard" },
  { to:"/residentes", label:"Residentes",   icon:"residentes" },
  { to:"/morosos",    label:"Morosos",      icon:"morosos",  badge:"morosos" },
  { to:"/pagos",      label:"Pagos",        icon:"pagos",    badge:"pendientes" },
  { to:"/finanzas",   label:"Finanzas",     icon:"finanzas" },
  { to:"/carga",      label:"Cargar datos", icon:"carga" },
  { to:"/config",     label:"Configuración",icon:"config" },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [badges, setBadges] = useState({ morosos:0, pendientes:0 });

  useEffect(()=>{
    api.get("/api/admin/dashboard")
      .then(r=>setBadges({ morosos:r.data.morosos||0, pendientes:r.data.pagosPendientes||0 }))
      .catch(()=>{});
  },[]);

  return (
    <div style={{ display:"flex", minHeight:"100vh" }}>
      <div style={{ width:"var(--sidebar-w)", background:"var(--surface)", borderRight:"0.5px solid var(--border)", display:"flex", flexDirection:"column", flexShrink:0, position:"fixed", top:0, left:0, height:"100vh", zIndex:10 }}>
        <div style={{ padding:"1.5rem 1.25rem 1rem", borderBottom:"0.5px solid var(--border)" }}>
          <h1 style={{ fontSize:18, fontWeight:600, color:"var(--blue)" }}>FracAdmin</h1>
          <p style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>Sistema de gestión</p>
        </div>
        <nav style={{ padding:"0.75rem 0", flex:1, overflowY:"auto" }}>
          {navItems.map(item=>(
            <NavLink key={item.to} to={item.to}
              style={({ isActive })=>({ display:"flex", alignItems:"center", gap:10, padding:"10px 1.25rem", textDecoration:"none", fontSize:13, borderLeft:isActive?"3px solid var(--blue)":"3px solid transparent", color:isActive?"var(--blue)":"var(--text2)", background:isActive?"var(--blue-bg)":"transparent", fontWeight:isActive?500:400 })}>
              {ICONS[item.icon]}
              <span style={{ flex:1 }}>{item.label}</span>
              {item.badge==="morosos"&&badges.morosos>0&&<span style={{ background:"var(--red)",color:"#fff",borderRadius:10,fontSize:10,fontWeight:600,padding:"1px 6px" }}>{badges.morosos}</span>}
              {item.badge==="pendientes"&&badges.pendientes>0&&<span style={{ background:"var(--amber)",color:"#fff",borderRadius:10,fontSize:10,fontWeight:600,padding:"1px 6px" }}>{badges.pendientes}</span>}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding:"1rem 1.25rem", borderTop:"0.5px solid var(--border)" }}>
          <div style={{ fontSize:11, color:"var(--text2)" }}>{admin?.nombre||admin?.email}</div>
        </div>
      </div>
      <div style={{ marginLeft:"var(--sidebar-w)", flex:1, minHeight:"100vh", display:"flex", flexDirection:"column" }}>
        <Outlet />
      </div>
    </div>
  );
}
