import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function ConfigPage() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [resetStep, setResetStep]  = useState(0); // 0=idle 1=confirm 2=typing
  const [resetInput, setResetInput] = useState("");
  const [loading, setLoading]      = useState(false);
  const [toast, setToast]          = useState(null);

  const showToast = (msg, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),4000); };

  const handleReset = async () => {
    if (resetInput !== "REINICIAR") return;
    setLoading(true);
    try {
      await api.post("/api/admin/reset", { confirmacion: "REINICIAR" });
      showToast("✓ Aplicación reiniciada. Todos los datos fueron eliminados.");
      setResetStep(0);
      setResetInput("");
    } catch (err) {
      showToast(err.response?.data?.error || "Error al reiniciar", false);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding:"2rem", flex:1, maxWidth:640 }}>
      {toast && (
        <div className={`toast ${toast.ok?"":"error"}`} style={{ position:"fixed", top:16, right:16, zIndex:100, padding:"12px 20px", borderRadius:"var(--radius)", boxShadow:"0 4px 16px rgba(0,0,0,0.12)", minWidth:300 }}>
          {toast.msg}
        </div>
      )}

      <div className="page-title">Configuración</div>
      <div className="page-sub">Ajustes de la cuenta y datos del sistema</div>

      {/* Info cuenta */}
      <div className="card">
        <div className="card-header"><h3>Cuenta de administrador</h3></div>
        <div className="card-body">
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:44, height:44, borderRadius:"50%", background:"var(--blue-bg)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
              👤
            </div>
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>{admin?.nombre || "Administrador"}</div>
              <div style={{ fontSize:12, color:"var(--text2)" }}>{admin?.email}</div>
            </div>
          </div>
          <div style={{ marginTop:16, paddingTop:16, borderTop:"0.5px solid var(--border)" }}>
            <button className="btn" onClick={()=>{ logout(); navigate("/login"); }}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      {/* Día de cobro */}
      <div className="card">
        <div className="card-header"><h3>📅 Fecha de cobro mensual</h3></div>
        <div className="card-body">
          <p style={{ fontSize:13, color:"var(--text2)", lineHeight:1.6, marginBottom:12 }}>
            El <strong>día 5 de cada mes</strong> es la fecha establecida para el pago de la cuota mensual de los residentes.
            Los pagos aprobados se registran automáticamente con esa fecha en el módulo de Finanzas.
          </p>
          <div className="alert amber" style={{ fontSize:12 }}>
            Cuando un residente envíe su pago y sea aprobado, el ingreso aparecerá en Finanzas con fecha día 5 del mes correspondiente.
          </div>
        </div>
      </div>

      {/* Formulario de residentes */}
      <div className="card">
        <div className="card-header"><h3>🔗 Formulario de residentes</h3></div>
        <div className="card-body">
          <p style={{ fontSize:13, color:"var(--text2)", marginBottom:12 }}>Comparte este enlace con los residentes para que registren sus pagos:</p>
          <div className="format-box" style={{ marginBottom:12, wordBreak:"break-all" }}>
            https://formularioresidentes.onrender.com
          </div>
          <a href="https://formularioresidentes.onrender.com" target="_blank" rel="noreferrer" className="btn wa">
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
            Abrir formulario
          </a>
        </div>
      </div>

      {/* Zona de peligro */}
      <div className="card" style={{ border:"1px solid var(--red-bg)" }}>
        <div className="card-header" style={{ background:"var(--red-bg)" }}>
          <h3 style={{ color:"var(--red)" }}>⚠️ Zona de peligro</h3>
        </div>
        <div className="card-body">
          <p style={{ fontSize:13, color:"var(--text2)", lineHeight:1.6, marginBottom:16 }}>
            <strong>Reiniciar la aplicación</strong> eliminará permanentemente todos los residentes, pagos y movimientos financieros.
            Las cuentas y categorías se conservan. Esta acción <strong>no se puede deshacer</strong>.
          </p>

          {resetStep === 0 && (
            <button className="btn red" onClick={()=>setResetStep(1)}>
              🗑 Reiniciar aplicación
            </button>
          )}

          {resetStep === 1 && (
            <div>
              <div className="alert error" style={{ marginBottom:12 }}>
                ¿Estás completamente seguro? Se eliminarán <strong>todos los residentes, pagos y movimientos</strong>.
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn" onClick={()=>setResetStep(0)}>Cancelar</button>
                <button className="btn red" onClick={()=>setResetStep(2)}>Sí, continuar</button>
              </div>
            </div>
          )}

          {resetStep === 2 && (
            <div>
              <div className="alert error" style={{ marginBottom:12 }}>
                Escribe <strong>REINICIAR</strong> para confirmar la eliminación total de datos.
              </div>
              <input
                style={{ width:"100%", padding:"8px 11px", borderRadius:"var(--radius)", border:"1.5px solid var(--red)", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:10 }}
                value={resetInput}
                onChange={e=>setResetInput(e.target.value)}
                placeholder="Escribe REINICIAR"
                autoFocus
              />
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn" onClick={()=>{ setResetStep(0); setResetInput(""); }}>Cancelar</button>
                <button className="btn red" disabled={resetInput !== "REINICIAR" || loading} onClick={handleReset}>
                  {loading ? "Reiniciando..." : "Confirmar y reiniciar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
