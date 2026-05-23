import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useState, useEffect } from "react";
import api from "../lib/api";

const navItems = [
  { to: "/dashboard",  label: "Dashboard",   icon: "⊞" },
  { to: "/residentes", label: "Residentes",  icon: "👥" },
  { to: "/morosos",    label: "Morosos",     icon: "⚠️", badge: "morosos" },
  { to: "/pagos",      label: "Pagos",       icon: "💳", badge: "pendientes" },
  { to: "/carga",      label: "Cargar Excel",icon: "📂" },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [badges, setBadges] = useState({ morosos: 0, pendientes: 0 });

  useEffect(() => {
    api.get("/api/admin/dashboard")
      .then(r => setBadges({
        morosos: r.data.morosos || 0,
        pendientes: r.data.pagosPendientes || 0,
      }))
      .catch(() => {});
  }, []);

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r flex flex-col flex-shrink-0 fixed top-0 left-0 h-screen z-10"
             style={{ borderColor: "var(--border)" }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <h1 className="text-lg font-semibold" style={{ color: "var(--blue)" }}>FracAdmin</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>Panel de Administración</p>
        </div>

        <nav className="flex-1 py-3">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-5 py-2.5 text-sm border-l-[3px] transition-colors ` +
                (isActive
                  ? "border-blue-600 bg-blue-50 text-blue-700 font-medium"
                  : "border-transparent text-gray-500 hover:bg-gray-50")
              }
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge === "morosos" && badges.morosos > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                  {badges.morosos}
                </span>
              )}
              {item.badge === "pendientes" && badges.pendientes > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                  {badges.pendientes}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs font-medium text-gray-700 truncate">{admin?.nombre || admin?.email}</p>
          <button onClick={handleLogout}
                  className="text-xs mt-1 text-blue-600 hover:underline">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-56 flex-1 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
