import { useEffect, useState, useCallback, useRef } from "react";
import api from "../lib/api";
import { calcDeuda, fmtMXN, CALLES, MESES } from "../lib/helpers";

const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const statusOf   = d => d<=0?"corriente":d<=700?"leve":"moroso";
const badgeCls   = st => st==="corriente"?"badge green":st==="leve"?"badge amber":"badge red";
const badgeLbl   = st => st==="corriente"?"Al corriente":st==="leve"?"Deuda leve":"Moroso";

function RowMenu({ onEdit, onDelete, onHistory }) {
  const [open,setOpen] = useState(false);
  const ref = useRef();
  useEffect(()=>{ const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);}; document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h); },[]);
  return (
    <div ref={ref} style={{ position:"relative",display:"inline-block" }} onClick={e=>e.stopPropagation()}>
      <button className="btn" style={{ padding:"3px 10px",fontSize:12 }} onClick={()=>setOpen(o=>!o)}>⋯</button>
      {open&&(
        <div style={{ position:"absolute",right:0,top:"100%",marginTop:4,background:"var(--surface)",border:"0.5px solid var(--border2)",borderRadius:"var(--radius)",boxShadow:"0 4px 16px rgba(0,0,0,0.12)",zIndex:20,minWidth:150,overflow:"hidden" }}>
          <button onClick={()=>{setOpen(false);onHistory();}} style={{ display:"block",width:"100%",textAlign:"left",padding:"9px 14px",fontSize:13,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",color:"var(--text)" }} onMouseOver={e=>e.currentTarget.style.background="var(--surface2)"} onMouseOut={e=>e.currentTarget.style.background="none"}>📋 Historial de pagos</button>
          <button onClick={()=>{setOpen(false);onEdit();}} style={{ display:"block",width:"100%",textAlign:"left",padding:"9px 14px",fontSize:13,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",color:"var(--text)" }} onMouseOver={e=>e.currentTarget.style.background="var(--surface2)"} onMouseOut={e=>e.currentTarget.style.background="none"}>✏️ Editar</button>
          <button onClick={()=>{setOpen(false);onDelete();}} style={{ display:"block",width:"100%",textAlign:"left",padding:"9px 14px",fontSize:13,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",color:"var(--red)" }} onMouseOver={e=>e.currentTarget.style.background="var(--red-bg)"} onMouseOut={e=>e.currentTarget.style.background="none"}>🗑 Eliminar</button>
        </div>
      )}
    </div>
  );
}

function PayGrid({ r, onRefresh }) {
  const [data, setData]       = useState(r);
  const [confirm, setConfirm] = useState(null);
  const [monto, setMonto]     = useState("400");
  const [metodo, setMetodo]   = useState("efectivo");
  const [saving, setSaving]   = useState(false);
  const now    = new Date();
  const maxM26 = now.getFullYear() >= 2026 ? now.getMonth() : 0;

  useEffect(() => { setData(r); }, [r]);

  const p25 = data.pagos25 || {};
  const p26 = data.pagos26 || {};

  const cls = (v, y, m) => {
    if (y === 2026 && m >= maxM26) return "empty";
    if (v === "vacio") return "empty";
    if (v === "pendiente" || v === null || v === undefined) return "pending";
    if (typeof v === "number" && v > 0) return "paid";
    return "empty";
  };
  const txt = (v, y, m) => {
    if (y === 2026 && m >= maxM26) return "—";
    if (v === "vacio") return "—";
    if (v === "pendiente" || v === null || v === undefined) return "✗";
    if (typeof v === "number" && v > 0) return "✓";
    return "—";
  };

  const handleCellClick = (anio, mes) => {
    if (anio === 2026 && mes >= maxM26) return;
    const p   = anio === 2025 ? p25 : p26;
    const val = p[mes];
    if (val === "vacio") return;
    const isPaid = typeof val === "number" && val > 0;
    setMonto(isPaid ? String(val) : "400");
    setMetodo("efectivo");
    setConfirm({
      anio, mes,
      accion: isPaid ? "deshacer" : "pagar",
      label:  `${MESES_FULL[mes]} ${anio}`,
      isPaid,
    });
  };

  const doToggle = async () => {
    if (!confirm) return;
    setSaving(true);
    try {
      const { data: updated } = await api.patch(
        `/api/residents/${data.id}/toggle-pago`,
        { anio: confirm.anio, mes: confirm.mes, accion: confirm.accion, monto: Number(monto) || 400, metodo }
      );
      setData(updated);
      if (onRefresh) onRefresh(updated);
      setConfirm(null);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const Cell = ({ val, anio, mes }) => {
    const isFuture = anio === 2026 && mes >= maxM26;
    const isVacio  = val === "vacio";
    const c = cls(val, anio, mes);
    const isPaid = typeof val === "number" && val > 0;
    return (
      <td className={c}
          style={{ cursor: (isFuture || isVacio) ? "default" : "pointer" }}
          title={isFuture || isVacio ? "" : isPaid ? "Clic para deshacer pago" : "Clic para registrar pago"}
          onClick={() => !isFuture && !isVacio && handleCellClick(anio, mes)}>
        {txt(val, anio, mes)}
      </td>
    );
  };

  const inp  = { width:"100%", padding:"9px 10px", borderRadius:8, border:"0.5px solid var(--border2)", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box", background:"var(--surface)", color:"var(--text)" };
  const btnM = (v, label) => (
    <button type="button" onClick={() => setMetodo(v)}
            style={{ flex:1, padding:"8px", borderRadius:8, fontSize:12, fontWeight:metodo===v?700:400, cursor:"pointer", fontFamily:"inherit", border:`1.5px solid ${metodo===v?"var(--blue)":"var(--border2)"}`, background:metodo===v?"var(--blue-bg)":"var(--surface)", color:metodo===v?"var(--blue-text)":"var(--text2)" }}>
      {label}
    </button>
  );

  return (
    <>
      <div className="pay-grid scroll-x" style={{ marginTop:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div className="pay-year">2025</div>
          <div style={{ fontSize:10, color:"var(--text3)" }}>Toca ✗ para registrar · ✓ para deshacer</div>
        </div>
        <table>
          <thead><tr>{MESES.map(m => <th key={m}>{m}</th>)}</tr></thead>
          <tbody><tr>{MESES.map((_,i) => <Cell key={i} val={p25[i]} anio={2025} mes={i}/>)}</tr></tbody>
        </table>
        <div className="pay-year" style={{ marginTop:8 }}>2026</div>
        <table>
          <thead><tr>{MESES.map(m => <th key={m}>{m}</th>)}</tr></thead>
          <tbody><tr>{MESES.map((_,i) => <Cell key={i} val={p26[i]} anio={2026} mes={i}/>)}</tr></tbody>
        </table>
      </div>

      {confirm && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:60,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem" }}>
          <div style={{ background:"var(--surface)",borderRadius:"var(--radius-lg)",padding:"1.5rem",width:"100%",maxWidth:380,boxShadow:"0 8px 32px rgba(0,0,0,0.2)" }}>
            {confirm.accion === "pagar" ? (
              <>
                <div style={{ fontSize:15,fontWeight:700,marginBottom:6 }}>✅ Registrar pago — {confirm.label}</div>
                <div style={{ fontSize:13,color:"var(--text2)",marginBottom:14,lineHeight:1.5 }}>
                  Pago de <strong>{data.residente.split("/")[0].trim()}</strong> · <strong>{confirm.label}</strong>.
                  Se registrará en Finanzas automáticamente.
                </div>
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:"block",fontSize:11,fontWeight:600,color:"var(--text2)",marginBottom:6 }}>Monto pagado (MXN)</label>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--text3)",fontSize:14 }}>$</span>
                    <input autoFocus type="number" min="1" step="1" value={monto}
                           onChange={e => setMonto(e.target.value)}
                           onKeyDown={e => e.key==="Enter" && doToggle()}
                           style={{ ...inp, paddingLeft:26 }}/>
                  </div>
                  <div style={{ fontSize:11,color:"var(--text3)",marginTop:4 }}>Mensualidad estándar: $400 MXN</div>
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ display:"block",fontSize:11,fontWeight:600,color:"var(--text2)",marginBottom:6 }}>Método de pago</label>
                  <div style={{ display:"flex",gap:6 }}>
                    {btnM("efectivo","💵 Efectivo")}
                    {btnM("debito",  "💳 Débito")}
                    {btnM("transferencia","📱 Transferencia")}
                  </div>
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  <button className="btn" style={{ flex:1,justifyContent:"center" }} onClick={() => setConfirm(null)}>Cancelar</button>
                  <button className="btn primary" style={{ flex:1,justifyContent:"center" }} onClick={doToggle} disabled={saving || !monto}>
                    {saving ? "Guardando..." : "✓ Confirmar pago"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize:15,fontWeight:700,marginBottom:6 }}>↩ Deshacer pago — {confirm.label}</div>
                <div style={{ fontSize:13,color:"var(--text2)",marginBottom:16,lineHeight:1.5 }}>
                  ¿Marcar <strong>{confirm.label}</strong> como <strong>pendiente</strong> nuevamente?
                  Se eliminará el registro en Finanzas.
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  <button className="btn" style={{ flex:1,justifyContent:"center" }} onClick={() => setConfirm(null)}>Cancelar</button>
                  <button className="btn red" style={{ flex:1,justifyContent:"center" }} onClick={doToggle} disabled={saving}>
                    {saving ? "Deshaciendo..." : "↩ Deshacer pago"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Modal Historial de Pagos ───────────────────────────────────
function HistorialModal({ residentId, onClose }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [imgModal, setImgModal] = useState(null);

  useEffect(() => {
    api.get(`/api/residents/${residentId}/historial`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [residentId]);

  const verComprobante = async (pagoId) => {
    try {
      const { data: d } = await api.get(`/api/payments/${pagoId}/comprobante`);
      if (d.comprobante) setImgModal(d.comprobante);
      else alert("Este pago no tiene comprobante adjunto");
    } catch { alert("Error al cargar comprobante"); }
  };

  const STATUS_BADGE = {
    aprobado:  { cls:"badge green", label:"Aprobado" },
    rechazado: { cls:"badge red",   label:"Rechazado" },
    pendiente: { cls:"badge amber", label:"Pendiente" },
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem" }}>
      <div style={{ background:"var(--surface)",borderRadius:"var(--radius-lg)",width:"100%",maxWidth:680,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",maxHeight:"88vh",display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"16px 20px",borderBottom:"0.5px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:600,fontSize:15 }}>
              Historial de pagos — {data?.resident?.residente?.split("/")[0].trim() || "…"}
            </div>
            {data?.resident && (
              <div style={{ fontSize:12,color:"var(--text2)",marginTop:2 }}>
                {data.resident.calle} · L{data.resident.lote} · Mza {data.resident.mza}
              </div>
            )}
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {/* Contenido */}
        <div style={{ overflowY:"auto",flex:1 }}>
          {loading ? (
            <div style={{ padding:"3rem",textAlign:"center",color:"var(--text2)" }}>Cargando historial...</div>
          ) : data?.pagos?.length === 0 ? (
            <div style={{ padding:"3rem",textAlign:"center",color:"var(--text2)" }}>
              <div style={{ fontSize:36,marginBottom:12 }}>📭</div>
              <p>Este residente aún no tiene pagos registrados en el sistema.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha envío</th>
                  <th>Mes pagado</th>
                  <th style={{ textAlign:"right" }}>Monto</th>
                  <th>Estado</th>
                  <th>Revisado</th>
                  <th>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {data.pagos.map(p => {
                  const sb = STATUS_BADGE[p.status] || STATUS_BADGE.pendiente;
                  const mesNombre = MESES_FULL[Number(p.mes)-1] || p.mes;
                  return (
                    <tr key={p.id}>
                      <td style={{ fontSize:12,color:"var(--text3)",whiteSpace:"nowrap" }}>{p.fecha_envio}</td>
                      <td style={{ fontWeight:500,fontSize:13 }}>{mesNombre} {p.anio}</td>
                      <td style={{ textAlign:"right",fontWeight:600,color:"var(--blue)" }}>{fmtMXN(p.monto)}</td>
                      <td>
                        <span className={sb.cls}>{sb.label}</span>
                        {p.rejection_reason && (
                          <div style={{ fontSize:11,color:"var(--text3)",marginTop:3,maxWidth:160 }} title={p.rejection_reason}>
                            {p.rejection_reason.slice(0,40)}{p.rejection_reason.length>40?"…":""}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize:12,color:"var(--text2)" }}>
                        {p.fecha_revision ? (
                          <div>
                            <div>{p.fecha_revision}</div>
                            <div style={{ fontSize:11,color:"var(--text3)" }}>{p.revisado_por}</div>
                          </div>
                        ) : "—"}
                        {p.whatsapp_sent && <div style={{ fontSize:10,color:"#25D366",marginTop:2 }}>✓ WA enviado</div>}
                      </td>
                      <td>
                        {p.comprobante_url ? (
                          <button className="btn" style={{ fontSize:11,padding:"3px 8px" }} onClick={() => verComprobante(p.id)}>
                            🖼 Ver
                          </button>
                        ) : <span style={{ color:"var(--text3)",fontSize:12 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer resumen */}
        {data?.pagos?.length > 0 && (
          <div style={{ padding:"12px 20px",borderTop:"0.5px solid var(--border)",background:"var(--surface2)",display:"flex",gap:16,flexShrink:0,flexWrap:"wrap" }}>
            {["aprobado","pendiente","rechazado"].map(st => {
              const count = data.pagos.filter(p=>p.status===st).length;
              if (count === 0) return null;
              const sb = STATUS_BADGE[st];
              return <span key={st} className={sb.cls} style={{ fontSize:12 }}>{sb.label}: {count}</span>;
            })}
            <span style={{ marginLeft:"auto",fontSize:12,fontWeight:600,color:"var(--blue)" }}>
              Total aprobado: {fmtMXN(data.pagos.filter(p=>p.status==="aprobado").reduce((s,p)=>s+Number(p.monto),0))}
            </span>
          </div>
        )}
      </div>

      {/* Modal imagen comprobante */}
      {imgModal && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:60,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem" }} onClick={()=>setImgModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"var(--surface)",borderRadius:"var(--radius-lg)",overflow:"hidden",maxWidth:"85vw",maxHeight:"88vh",display:"flex",flexDirection:"column" }}>
            <div style={{ padding:"10px 16px",borderBottom:"0.5px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <span style={{ fontWeight:500,fontSize:13 }}>Comprobante de pago</span>
              <button className="btn" style={{ padding:"4px 10px",fontSize:12 }} onClick={()=>setImgModal(null)}>Cerrar ✕</button>
            </div>
            <div style={{ overflow:"auto",padding:"1rem",background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center" }}>
              {imgModal.startsWith("data:application/pdf")
                ? <iframe src={imgModal} style={{ width:"70vw",height:"72vh",border:"none" }} title="Comprobante"/>
                : <img src={imgModal} alt="Comprobante" style={{ maxWidth:"70vw",maxHeight:"72vh",objectFit:"contain",borderRadius:"var(--radius)" }}/>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal crear/editar ─────────────────────────────────────────
function ResidentModal({ resident, onClose, onSaved }) {
  const isEdit=!!resident?.id;
  const [form,setForm]=useState({ calle:resident?.calle||"",lote:resident?.lote||"",mza:resident?.mza||"",residente:resident?.residente||"",telefono:resident?.telefono||"",deuda_extra:resident?.deuda_extra!=null?String(resident.deuda_extra):"0",pausado:resident?.pausado||false });
  const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const IS={ width:"100%",padding:"8px 10px",borderRadius:6,border:"0.5px solid var(--border2)",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box" };
  const LS={ display:"block",fontSize:11,fontWeight:500,color:"var(--text2)",marginBottom:5 };
  const handleSave=async()=>{
    if(!form.calle||!form.lote||!form.mza||!form.residente) return setError("Calle, lote, manzana y nombre son requeridos");
    setLoading(true); setError("");
    try {
      if(isEdit) await api.patch(`/api/residents/${resident.id}`,{...form,deuda_extra:Number(form.deuda_extra)||0});
      else await api.post("/api/residents",{...form,deuda_extra:Number(form.deuda_extra)||0,pagos25:{},pagos26:{}});
      onSaved();
    } catch(err){ setError(err.response?.data?.error||"Error al guardar"); } finally{setLoading(false);}
  };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem" }}>
      <div style={{ background:"var(--surface)",borderRadius:"var(--radius-lg)",padding:"1.5rem",width:"100%",maxWidth:480,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",maxHeight:"90vh",overflowY:"auto" }}>
        <div style={{ fontSize:16,fontWeight:600,marginBottom:16 }}>{isEdit?"Editar residente":"Agregar residente"}</div>
        {error&&<div className="alert error" style={{marginBottom:12}}>{error}</div>}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12 }}>
          <div><label style={LS}>Calle *</label><select value={form.calle} onChange={e=>set("calle",e.target.value)} style={{...IS,cursor:"pointer"}}><option value="">Selecciona...</option>{CALLES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><label style={LS}>Lote *</label><input style={IS} value={form.lote} onChange={e=>set("lote",e.target.value)} placeholder="Ej: 12"/></div>
          <div><label style={LS}>Manzana *</label><input style={IS} value={form.mza} onChange={e=>set("mza",e.target.value)} placeholder="Ej: 3"/></div>
          <div><label style={LS}>Teléfono</label><input style={IS} value={form.telefono} onChange={e=>set("telefono",e.target.value)} placeholder="55 1234 5678"/></div>
        </div>
        <div style={{marginBottom:12}}><label style={LS}>Nombre del residente *</label><input style={IS} value={form.residente} onChange={e=>set("residente",e.target.value)} placeholder="Nombre completo"/></div>
        <div style={{marginBottom:12}}><label style={LS}>Deuda extra (MXN)</label><input style={IS} type="number" min="0" value={form.deuda_extra} onChange={e=>set("deuda_extra",e.target.value)}/></div>
        <div style={{marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:"var(--surface2)",borderRadius:8}}>
          <div>
            <div style={{fontSize:13,fontWeight:500}}>⏸ Pausar propiedad</div>
            <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>Detiene el conteo de deuda (propiedad desocupada)</div>
          </div>
          <button type="button" onClick={()=>set("pausado",!form.pausado)}
                  style={{width:46,height:26,borderRadius:13,border:"none",cursor:"pointer",position:"relative",background:form.pausado?"var(--amber)":"var(--surface)",border:"1px solid var(--border2)",transition:"background 0.2s",flexShrink:0}}>
            <div style={{position:"absolute",top:2,left:form.pausado?22:2,width:20,height:20,borderRadius:"50%",background:form.pausado?"#fff":"var(--text3)",transition:"left 0.2s"}}/>
          </button>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn" style={{flex:1,justifyContent:"center"}} onClick={onClose}>Cancelar</button>
          <button className="btn primary" style={{flex:1,justifyContent:"center"}} onClick={handleSave} disabled={loading}>{loading?"Guardando...":isEdit?"Guardar cambios":"Agregar residente"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────
export default function ResidentesPage() {
  const [residents,setResidents]       = useState([]);
  const [loading,setLoading]           = useState(true);
  const [calle,setCalle]               = useState("");
  const [search,setSearch]             = useState("");
  const [statusFilter,setStatus]       = useState("");
  const [selected,setSelected]         = useState(null);
  const [editModal,setEditModal]       = useState(null);
  const [deleteTarget,setDelete]       = useState(null);
  const [multiPropFilter,setMultiPropFilter] = useState("");
  const [historialId,setHistorial]     = useState(null);
  const [toast,setToast]               = useState(null);
  const [delLoading,setDelLoading]     = useState(false);

  const showToast=(msg,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),3000);};

  const load=useCallback(()=>{
    setLoading(true);
    const p=new URLSearchParams();
    if(calle) p.set("calle",calle);
    if(search) p.set("search",search);
    api.get(`/api/residents?${p}`).then(r=>setResidents(r.data)).catch(console.error).finally(()=>setLoading(false));
  },[calle,search]);

  useEffect(()=>{load();},[load]);

  // Detectar residentes con múltiples propiedades (mismo nombre)
  const nombreCount = {};
  residents.forEach(r => {
    const n = r.residente.split("/")[0].trim().toLowerCase();
    nombreCount[n] = (nombreCount[n]||0)+1;
  });

  const filtered = residents.filter(r=>{
    const d = calcDeuda(r);
    if(statusFilter==="moroso")      { if(r.pausado||d<=700) return false; }
    else if(statusFilter==="leve")   { if(r.pausado||d<=0||d>700) return false; }
    else if(statusFilter==="corriente") { if(r.pausado||d>0) return false; }
    else if(statusFilter==="pausado")   { if(!r.pausado) return false; }
    if(multiPropFilter==="multi") {
      const n = r.residente.split("/")[0].trim().toLowerCase();
      if((nombreCount[n]||0)<2) return false;
    }
    return true;
  });

  const copyWA=r=>{
    const d=calcDeuda(r),n=r.residente.split("/")[0].trim();
    const msg=`Estimado/a *${n}*,\n\nLe recordamos que tiene una deuda pendiente de *$${d.toLocaleString()} MXN*.\n\nPuede registrar su pago en: https://formularioresidentes.onrender.com\n\n_Administración del Fraccionamiento_`;
    navigator.clipboard.writeText(msg).then(()=>showToast("Mensaje copiado")).catch(()=>showToast("Error al copiar",false));
  };

  const handleDelete=async()=>{
    setDelLoading(true);
    try{await api.delete(`/api/residents/${deleteTarget.id}`);setDelete(null);setSelected(null);load();showToast("Residente eliminado");}
    catch(err){showToast(err.response?.data?.error||"Error",false);}
    finally{setDelLoading(false);}
  };

  return (
    <div style={{padding:"2rem",flex:1}}>
      {toast&&<div className={`toast ${toast.ok?"":"error"}`} style={{position:"fixed",top:16,right:16,zIndex:100,padding:"12px 20px",borderRadius:"var(--radius)",boxShadow:"0 4px 16px rgba(0,0,0,0.12)"}}>{toast.msg}</div>}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4,flexWrap:"wrap",gap:12}}>
        <div><div className="page-title">Residentes</div><div className="page-sub">{filtered.length} residente{filtered.length!==1?"s":""}</div></div>
        <button className="btn primary" onClick={()=>setEditModal("new")}>+ Agregar residente</button>
      </div>

      {/* Panel detalle */}
      {selected&&(
        <div className="detail-panel">
          <div className="detail-header">
            <div>
              <div className="name">{selected.residente.split("/")[0].trim()}</div>
              <div className="meta">{selected.calle} · Lote {selected.lote} · Mza {selected.mza}{selected.telefono?` · ${selected.telefono}`:""}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span className={badgeCls(statusOf(calcDeuda(selected)))}>{badgeLbl(statusOf(calcDeuda(selected)))}</span>
              {calcDeuda(selected)>0&&<span className="detail-deuda">{fmtMXN(calcDeuda(selected))}</span>}
              <button className="btn" style={{fontSize:12,padding:"4px 10px"}} onClick={()=>setHistorial(selected.id)}>📋 Historial</button>
              <button className="btn" style={{fontSize:12,padding:"4px 10px"}} onClick={()=>setEditModal(selected)}>✏️ Editar</button>
              <button className="btn-close" onClick={()=>setSelected(null)}>✕</button>
            </div>
          </div>
          <PayGrid r={selected} onRefresh={(updated)=>{ setSelected(updated); setResidents(prev=>prev.map(r=>r.id===updated.id?updated:r)); }}/>
          {calcDeuda(selected)>0&&(
            <div className="detail-actions">
              <button className="btn green" onClick={()=>copyWA(selected)}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                Copiar notificación WhatsApp
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="filters">
        <input type="text" placeholder="Buscar nombre, lote..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select value={calle} onChange={e=>setCalle(e.target.value)}>
          <option value="">Todas las calles</option>
          {CALLES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="moroso">Morosos</option>
          <option value="leve">Deuda leve</option>
          <option value="corriente">Al corriente</option>
          <option value="pausado">Pausados</option>
        </select>
        <select value={multiPropFilter} onChange={e=>setMultiPropFilter(e.target.value)}>
          <option value="">Todas las propiedades</option>
          <option value="multi">Con múltiples propiedades</option>
        </select>
      </div>

      <div className="card" style={{marginBottom:0}}>
        <table>
          <thead><tr><th>Residente</th><th>Calle</th><th>Lote / Mza</th><th>Teléfono</th><th>Estado</th><th style={{textAlign:"right"}}>Deuda</th><th></th></tr></thead>
          <tbody>
            {loading?<tr><td colSpan="7" style={{textAlign:"center",padding:"3rem",color:"var(--text2)"}}>Cargando...</td></tr>
            :filtered.length===0?<tr><td colSpan="7" style={{textAlign:"center",padding:"3rem",color:"var(--text2)"}}>Sin resultados</td></tr>
            :filtered.map(r=>{
              const d=calcDeuda(r); const st=statusOf(d);
              return (
                <tr key={r.id} onClick={()=>setSelected(r)} style={{cursor:"pointer"}}>
                  <td style={{fontWeight:500}}>{r.residente.split("/")[0].trim()}</td>
                  <td style={{color:"var(--text2)"}}>{r.calle}</td>
                  <td style={{color:"var(--text3)"}}>L{r.lote} · Mza {r.mza}</td>
                  <td style={{color:"var(--text3)",fontSize:12}}>{r.telefono||"—"}</td>
                  <td>{r.pausado?<span className="badge" style={{background:"var(--surface2)",color:"var(--text3)"}}>⏸ Pausado</span>:<span className={badgeCls(st)}>{badgeLbl(st)}</span>}</td>
                  <td style={{textAlign:"right",fontWeight:600,color:d>0?"var(--red)":"var(--green)"}}>{d>0?fmtMXN(d):"—"}</td>
                  <td>
                    <RowMenu
                      onHistory={()=>setHistorial(r.id)}
                      onEdit={()=>setEditModal(r)}
                      onDelete={()=>setDelete(r)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editModal&&<ResidentModal resident={editModal==="new"?null:editModal} onClose={()=>setEditModal(null)} onSaved={()=>{setEditModal(null);setSelected(null);load();showToast(editModal==="new"?"Residente agregado":"Cambios guardados");}}/>}

      {deleteTarget&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
          <div style={{background:"var(--surface)",borderRadius:"var(--radius-lg)",padding:"1.5rem",width:"100%",maxWidth:400,boxShadow:"0 8px 32px rgba(0,0,0,0.18)"}}>
            <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>Eliminar residente</div>
            <p style={{fontSize:13,color:"var(--text2)",marginBottom:16}}>¿Eliminar a <strong>{deleteTarget.residente.split("/")[0].trim()}</strong>? No se puede deshacer.</p>
            <div style={{display:"flex",gap:8}}>
              <button className="btn" style={{flex:1,justifyContent:"center"}} onClick={()=>setDelete(null)}>Cancelar</button>
              <button className="btn red" style={{flex:1,justifyContent:"center"}} onClick={handleDelete} disabled={delLoading}>{delLoading?"Eliminando...":"Sí, eliminar"}</button>
            </div>
          </div>
        </div>
      )}

      {historialId && <HistorialModal residentId={historialId} onClose={()=>setHistorial(null)}/>}
    </div>
  );
}
