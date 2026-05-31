import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]     = useState({ email:"", password:"" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try { await login(form.email, form.password); navigate("/dashboard"); }
    catch (err) { setError(err.response?.data?.error || "Credenciales incorrectas"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg, #0f2744 0%, #185FA5 60%, #2176c7 100%)", padding:"1rem" }}>
      {/* Tarjeta */}
      <div style={{ width:"100%", maxWidth:400, background:"#fff", borderRadius:20, boxShadow:"0 24px 60px rgba(0,0,0,0.25)", overflow:"hidden" }}>

        {/* Header azul */}
        <div style={{ background:"linear-gradient(135deg,#185FA5,#1a7fd4)", padding:"2.5rem 2rem 2rem", textAlign:"center" }}>
          <div style={{ width:64, height:64, borderRadius:16, background:"rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", backdropFilter:"blur(4px)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" width="32" height="32">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h1 style={{ fontSize:24, fontWeight:700, color:"#fff", margin:0, letterSpacing:"-0.3px" }}>FracAdmin</h1>
          <p style={{ fontSize:13, color:"rgba(255,255,255,0.7)", marginTop:6, marginBottom:0 }}>Panel de Administración</p>
        </div>

        {/* Formulario */}
        <div style={{ padding:"2rem" }}>
          {error && (
            <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"#B91C1C", borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
              <span>⚠️</span>{error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:7 }}>
                Correo electrónico
              </label>
              <input
                type="email" required autoFocus
                value={form.email} onChange={e=>set("email",e.target.value)}
                placeholder="admin@fraccionamiento.com"
                style={{ width:"100%", padding:"11px 13px", borderRadius:10, border:"1.5px solid #E5E7EB", fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box", transition:"border-color 0.15s", color:"#111" }}
                onFocus={e=>e.target.style.borderColor="#185FA5"}
                onBlur={e=>e.target.style.borderColor="#E5E7EB"}
              />
            </div>

            <div style={{ marginBottom:24 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:7 }}>
                Contraseña
              </label>
              <input
                type="password" required
                value={form.password} onChange={e=>set("password",e.target.value)}
                placeholder="••••••••"
                style={{ width:"100%", padding:"11px 13px", borderRadius:10, border:"1.5px solid #E5E7EB", fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box", transition:"border-color 0.15s", color:"#111" }}
                onFocus={e=>e.target.style.borderColor="#185FA5"}
                onBlur={e=>e.target.style.borderColor="#E5E7EB"}
              />
            </div>

            <button type="submit" disabled={loading}
                    style={{ width:"100%", padding:"13px", borderRadius:11, border:"none", background:loading?"#93C5FD":"#185FA5", color:"#fff", fontSize:15, fontWeight:700, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit", transition:"background 0.15s", boxShadow:"0 4px 14px rgba(24,95,165,0.3)" }}>
              {loading ? "Entrando..." : "Iniciar sesión"}
            </button>
          </form>

          <p style={{ textAlign:"center", fontSize:11, color:"#9CA3AF", marginTop:20 }}>
            FracAdmin · Sistema de gestión de fraccionamiento
          </p>
        </div>
      </div>
    </div>
  );
}
