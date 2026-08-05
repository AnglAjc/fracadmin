import { useEffect, useState, useCallback, useRef } from "react";
import api from "../lib/api";
import { MESES_FULL, fmtMXN } from "../lib/helpers";

const TABS = [
  { key: "pendiente", label: "Pendientes", icon: "📋" },
  { key: "aprobado",  label: "Aprobados",  icon: "✅" },
  { key: "rechazado", label: "Rechazados", icon: "❌" },
];

export default function PagosPage() {
  const [tab, setTab]           = useState("pendiente");
  const [pagos, setPagos]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [actionId, setActionId] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [imgModal, setImgModal] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [toast, setToast]       = useState(null);
  const [editMonto, setEditMonto] = useState(null); // { id, monto } pago siendo editado

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Cada carga lleva un número de secuencia. Si el usuario cambia de pestaña
  // antes de que llegue la respuesta anterior, esa respuesta se descarta:
  // sin esto, la petición más lenta pintaba su lista sobre la pestaña activa.
  const reqId = useRef(0);

  const load = useCallback(() => {
    const myId = ++reqId.current;
    setLoading(true);
    setPagos([]);
    setTotal(0);
    api.get(`/api/payments?status=${tab}&limit=100`)
      .then(r => {
        if (myId !== reqId.current) return;   // respuesta obsoleta
        setPagos(r.data.data);
        setTotal(r.data.total);
      })
      .catch(err => { if (myId === reqId.current) console.error(err); })
      .finally(() => { if (myId === reqId.current) setLoading(false); });
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id, montoOverride) => {
    setActionId(id);
    try {
      await api.patch(`/api/payments/${id}/approve`, montoOverride ? { monto: montoOverride } : {});
      showToast("✓ Pago aprobado · Notificación WhatsApp enviada");
      setEditMonto(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || "Error al aprobar", false);
    } finally { setActionId(null); }
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) return;
    setActionId(rejectModal.id);
    try {
      await api.patch(`/api/payments/${rejectModal.id}/reject`, { reason: rejectReason });
      showToast("Pago rechazado · Se notificó al residente");
      setRejectModal(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || "Error al rechazar", false);
    } finally { setActionId(null); }
  };

  // Carga el comprobante (base64 o URL) bajo demanda
  const verComprobante = async (pago) => {
    setImgLoading(true);
    setImgModal({ loading: true });
    try {
      const { data } = await api.get(`/api/payments/${pago.id}/comprobante`);
      if (data.comprobante) {
        setImgModal({ src: data.comprobante, nombre: pago.nombre });
      } else {
        setImgModal(null);
        showToast("Este pago no tiene comprobante adjunto", false);
      }
    } catch {
      setImgModal(null);
      showToast("Error al cargar el comprobante", false);
    } finally { setImgLoading(false); }
  };

  const mesLabel = (mes, anio) => `${MESES_FULL[Number(mes) - 1] || mes} ${anio}`;
  // Cuota esperada: enero-marzo 2026 = 350, resto = 400
  const cuotaEsperada = (mes, anio) =>
    (Number(anio) === 2026 && Number(mes) >= 1 && Number(mes) <= 3) ? 350 : 400;

  return (
    <div style={{ padding: "2rem", flex: 1 }}>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.ok ? "" : "error"}`}
             style={{ position:"fixed", top:16, right:16, zIndex:100, padding:"12px 20px",
                      borderRadius:"var(--radius)", boxShadow:"0 4px 16px rgba(0,0,0,0.12)", minWidth:280 }}>
          {toast.msg}
        </div>
      )}

      <div className="page-title">Revisión de Pagos</div>
      <div className="page-sub">Comprobantes enviados por residentes · Aprueba o rechaza cada uno</div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`}
                  onClick={() => setTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty"><div className="icon">💳</div><p>Cargando pagos...</p></div>
      ) : pagos.length === 0 ? (
        <div className="empty">
          <div className="icon">{tab === "pendiente" ? "🎉" : tab === "aprobado" ? "✅" : "❌"}</div>
          <p style={{ fontWeight: 500 }}>
            {tab === "pendiente" ? "No hay pagos pendientes de revisar" :
             tab === "aprobado"  ? "Aún no hay pagos aprobados" :
             "No hay pagos rechazados"}
          </p>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3>{total} resultado{total !== 1 ? "s" : ""}</h3>
            {tab === "pendiente" && (
              <span className="badge amber">{total} por revisar</span>
            )}
          </div>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Residente</th>
                  <th>Ubicación</th>
                  <th>Mes</th>
                  <th style={{ textAlign:"right" }}>Monto</th>
                  <th>Comprobante</th>
                  <th>Estado</th>
                  {tab === "pendiente" && <th>Acciones</th>}
                  {tab === "rechazado" && <th>Motivo</th>}
                </tr>
              </thead>
              <tbody>
                {pagos.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontSize:12, color:"var(--text3)", whiteSpace:"nowrap" }}>
                      {new Date(p.created_at).toLocaleString("es-MX", { dateStyle:"short", timeStyle:"short" })}
                    </td>
                    <td>
                      <div style={{ fontWeight:500 }}>{p.nombre}</div>
                      {p.telefono && <div style={{ fontSize:11, color:"var(--text3)" }}>{p.telefono}</div>}
                    </td>
                    <td style={{ color:"var(--text2)", fontSize:12 }}>
                      {p.calle} · L{p.lote}{p.mza ? ` Mza ${p.mza}` : ""}
                    </td>
                    <td style={{ fontSize:12, whiteSpace:"nowrap" }}>
                      {mesLabel(p.mes, p.anio)}
                    </td>
                    <td style={{ textAlign:"right" }}>
                      <div style={{ fontWeight:600, color: Number(p.monto) !== cuotaEsperada(p.mes, p.anio) ? "var(--amber)" : "var(--blue)" }}>
                        {fmtMXN(p.monto)}
                        {Number(p.monto) !== cuotaEsperada(p.mes, p.anio) && (
                          <span style={{ fontSize:10, marginLeft:4, color:"var(--amber)", fontWeight:500 }}>
                            ≠ ${cuotaEsperada(p.mes, p.anio)}
                          </span>
                        )}
                      </div>
                      {tab === "pendiente" && (
                        <button
                          onClick={() => setEditMonto({ id: p.id, monto: String(p.monto) })}
                          style={{ fontSize:10, color:"var(--text3)", background:"none", border:"none",
                                   cursor:"pointer", padding:"2px 0", textDecoration:"underline",
                                   fontFamily:"inherit", display:"block", marginTop:2 }}>
                          ✏️ Editar monto
                        </button>
                      )}
                    </td>
                    <td>
                      {p.tiene_comprobante ? (
                        <button className="btn" style={{ fontSize:11, padding:"4px 10px" }}
                                onClick={() => verComprobante(p)}>
                          🖼 Ver
                        </button>
                      ) : (
                        <span style={{ color:"var(--text3)", fontSize:12 }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                        p.status === "aprobado"  ? "green" :
                        p.status === "rechazado" ? "red"   : "amber"}`}>
                        {p.status === "pendiente" ? "Pendiente" :
                         p.status === "aprobado"  ? "Aprobado"  : "Rechazado"}
                      </span>
                    </td>
                    {tab === "pendiente" && (
                      <td>
                        <div style={{ display:"flex", gap:6 }}>
                          <button className="btn green" style={{ fontSize:12, padding:"5px 12px" }}
                                  onClick={() => approve(p.id)} disabled={actionId === p.id}>
                            {actionId === p.id ? "..." : "✓ Aprobar"}
                          </button>
                          <button className="btn red" style={{ fontSize:12, padding:"5px 12px" }}
                                  disabled={actionId === p.id}
                                  onClick={() => { setRejectModal({ id:p.id, nombre:p.nombre }); setRejectReason(""); }}>
                            ✗ Rechazar
                          </button>
                        </div>
                      </td>
                    )}
                    {tab === "rechazado" && (
                      <td style={{ fontSize:12, color:"var(--text2)", maxWidth:200 }}>
                        {p.rejection_reason || "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal editar monto ── */}
      {editMonto && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:50,
                      display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
          <div style={{ background:"var(--surface)", borderRadius:"var(--radius-lg)", padding:"1.5rem",
                        width:"100%", maxWidth:380, boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:6 }}>Ajustar monto del pago</div>
            <p style={{ fontSize:13, color:"var(--text2)", marginBottom:14 }}>
              El residente indicó <strong>{fmtMXN(pagos.find(p=>p.id===editMonto.id)?.monto)}</strong>.
              Puedes corregirlo antes de aprobar si el comprobante muestra otra cantidad.
            </p>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:600, color:"var(--text2)", marginBottom:6 }}>
                Monto real (MXN)
              </div>
              <input
                type="number" min="1" step="1"
                value={editMonto.monto}
                onChange={e => setEditMonto(prev => ({ ...prev, monto: e.target.value }))}
                autoFocus
                style={{ width:"100%", padding:"9px 12px", borderRadius:"var(--radius)",
                         border:"1.5px solid var(--blue)", fontSize:16, fontWeight:600,
                         outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
              />
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                {[350, 375, 400].map(v => (
                  <button key={v} type="button"
                    onClick={() => setEditMonto(prev => ({ ...prev, monto: String(v) }))}
                    style={{ flex:1, padding:"6px 0", borderRadius:7, border:"1px solid var(--border2)",
                             background: String(editMonto.monto)===String(v) ? "var(--blue)" : "var(--surface2)",
                             color: String(editMonto.monto)===String(v) ? "#fff" : "var(--text2)",
                             cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit" }}>
                    ${v}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn" style={{ flex:1, justifyContent:"center" }}
                      onClick={() => setEditMonto(null)}>
                Cancelar
              </button>
              <button className="btn green" style={{ flex:1, justifyContent:"center" }}
                      disabled={!editMonto.monto || Number(editMonto.monto) <= 0 || actionId === editMonto.id}
                      onClick={() => approve(editMonto.id, Number(editMonto.monto))}>
                {actionId === editMonto.id ? "Aprobando..." : "✓ Aprobar con este monto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal rechazo ── */}
      {rejectModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:50,
                      display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
          <div style={{ background:"var(--surface)", borderRadius:"var(--radius-lg)", padding:"1.5rem",
                        width:"100%", maxWidth:440, boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:6 }}>Rechazar pago</div>
            <p style={{ fontSize:13, color:"var(--text2)", marginBottom:14 }}>
              Indica el motivo para <strong>{rejectModal.nombre}</strong>.
              Se enviará una notificación por WhatsApp.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Ej: El comprobante está borroso, no se puede verificar el monto..."
              autoFocus rows={3}
              style={{ width:"100%", padding:"8px 11px", borderRadius:"var(--radius)",
                       border:"0.5px solid var(--border2)", fontSize:13, resize:"none",
                       outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
            />
            <div style={{ display:"flex", gap:8, marginTop:12 }}>
              <button className="btn" style={{ flex:1, justifyContent:"center" }}
                      onClick={() => setRejectModal(null)}>
                Cancelar
              </button>
              <button className="btn red" style={{ flex:1, justifyContent:"center" }}
                      disabled={!rejectReason.trim() || actionId === rejectModal.id}
                      onClick={confirmReject}>
                {actionId === rejectModal.id ? "Enviando..." : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal comprobante ── */}
      {imgModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:50,
                      display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
             onClick={() => setImgModal(null)}>
          <div style={{ background:"var(--surface)", borderRadius:"var(--radius-lg)", overflow:"hidden",
                        maxWidth:"90vw", maxHeight:"92vh", boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
                        display:"flex", flexDirection:"column" }}
               onClick={e => e.stopPropagation()}>

            {/* Header modal */}
            <div style={{ padding:"10px 16px", borderBottom:"0.5px solid var(--border)",
                          display:"flex", justifyContent:"space-between", alignItems:"center",
                          flexShrink:0 }}>
              <span style={{ fontWeight:500, fontSize:13 }}>
                Comprobante — {imgModal.nombre || ""}
              </span>
              <button className="btn" style={{ padding:"4px 10px", fontSize:12 }}
                      onClick={() => setImgModal(null)}>
                Cerrar ✕
              </button>
            </div>

            {/* Contenido */}
            <div style={{ overflow:"auto", display:"flex", alignItems:"center", justifyContent:"center",
                          padding:"1rem", background:"var(--surface2)" }}>
              {imgModal.loading ? (
                <div style={{ padding:"3rem", color:"var(--text2)", fontSize:13 }}>Cargando comprobante...</div>
              ) : imgModal.src?.startsWith("data:application/pdf") ? (
                <iframe src={imgModal.src} style={{ width:"75vw", height:"75vh", border:"none" }}
                        title="Comprobante PDF" />
              ) : (
                <img src={imgModal.src} alt="Comprobante"
                     style={{ maxWidth:"75vw", maxHeight:"75vh", objectFit:"contain",
                              borderRadius:"var(--radius)", boxShadow:"0 2px 12px rgba(0,0,0,0.15)" }} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}