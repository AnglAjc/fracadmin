import { useEffect, useState, useCallback, useRef } from "react";
import api from "../lib/api";
import { calcDeuda, fmtMXN, CALLES, MESES } from "../lib/helpers";

const statusOf  = d => d<=0?"corriente":d<=700?"leve":"moroso";
const badgeCls  = st => st==="corriente"?"badge green":st==="leve"?"badge amber":"badge red";
const badgeLbl  = st => st==="corriente"?"Al corriente":st==="leve"?"Deuda leve":"Moroso";

// ── Menú ⋯ contextual ─────────────────────────────────────────
function RowMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(()=>{
    const h = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return ()=>document.removeEventListener("mousedown", h);
  },[]);
  return (
    <div ref={ref} style={{ position:"relative", display:"inline-block" }} onClick={e=>e.stopPropagation()}>
      <button className="btn" style={{ padding:"3px 10px", fontSize:12 }} onClick={()=>setOpen(o=>!o)}>⋯</button>
      {open && (
        <div style={{ position:"absolute", right:0, top:"100%", marginTop:4, background:"var(--surface)", border:"0.5px solid var(--border2)", borderRadius:"var(--radius)", boxShadow:"0 4px 16px rgba(0,0,0,0.12)", zIndex:20, minWidth:130, overflow:"hidden" }}>
          <button onClick={()=>{setOpen(false);onEdit();}} style={{ display:"block",width:"100%",textAlign:"left",padding:"9px 14px",fontSize:13,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",color:"var(--text)" }}
                  onMouseOver={e=>e.currentTarget.style.background="var(--surface2)"}
                  onMouseOut={e=>e.currentTarget.style.background="none"}>✏️ Editar</button>
          <button onClick={()=>{setOpen(false);onDelete();}} style={{ display:"block",width:"100%",textAlign:"left",padding:"9px 14px",fontSize:13,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",color:"var(--red)" }}
                  onMouseOver={e=>e.currentTarget.style.background="var(--red-bg)"}
                  onMouseOut={e=>e.currentTarget.style.background="none"}>🗑 Eliminar</button>
        </div>
      )}
    </div>
  );
}

// ── Grilla de pagos ────────────────────────────────────────────
function PayGrid({ r }) {
  const p25=r.pagos25||{}, p26=r.pagos26||{};
  const now=new Date(); const maxM26=now.getFullYear()>=2026?now.getMonth():0;
  const cls=(v,y,m)=>{ if(y===2026&&m>=maxM26)return"empty"; if(v==="pendiente")return"pending"; if(typeof v==="number"&&v>0)return"paid"; return"empty"; };
  const txt=(v,y,m)=>{ if(y===2026&&m>=maxM26)return"—"; if(v==="pendiente")return"✗"; if(typeof v==="number"&&v>0)return"✓"; return"—"; };
  return (
    <div className="pay-grid scroll-x" style={{ marginTop:12 }}>
      <div className="pay-year">2025</div>
      <table><thead><tr>{MESES.map(m=><th key={m}>{m}</th>)}</tr></thead>
        <tbody><tr>{MESES.map((_,i)=><td key={i} className={cls(p25[i],2025,i)}>{txt(p25[i],2025,i)}</td>)}</tr></tbody>
      </table>
      <div className="pay-year">2026</div>
      <table><thead><tr>{MESES.map(m=><th key={m}>{m}</th>)}</tr></thead>
        <tbody><tr>{MESES.map((_,i)=><td key={i} className={cls(p26[i],2026,i)}>{txt(p26[i],2026,i)}</td>)}</tr></tbody>
      </table>
    </div>
  );
}

// ── Modal crear/editar ─────────────────────────────────────────
function ResidentModal({ resident, onClose, onSaved }) {
  const isEdit = !!resident?.id;
  const [form, setForm] = useState({ calle:resident?.calle||"", lote:resident?.lote||"", mza:resident?.mza||"", residente:resident?.residente||"", telefono:resident?.telefono||"", deuda_extra:resident?.deuda_extra!=null?String(resident.deuda_extra):"0" });
  const [loading, setLoading]=useState(false); const [error, setError]=useState("");
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const IS={ width:"100%", padding:"8px 10px", borderRadius:6, border:"0.5px solid var(--border2)", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const LS={ display:"block", fontSize:11, fontWeight:500, color:"var(--text2)", marginBottom:5 };
  const handleSave=async()=>{
    if(!form.calle||!form.lote||!form.mza||!form.residente) return setError("Calle, lote, manzana y nombre son requeridos");
    setLoading(true); setError("");
    try {
      if(isEdit) await api.patch(`/api/residents/${resident.id}`,{...form,deuda_extra:Number(form.deuda_extra)||0});
      else       await api.post("/api/residents",{...form,deuda_extra:Number(form.deuda_extra)||0,pagos25:{},pagos26:{}});
      onSaved();
    } catch(err){ setError(err.response?.data?.error||"Error al guardar"); }
    finally{ setLoading(false); }
  };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem" }}>
      <div style={{ background:"var(--surface)",borderRadius:"var(--radius-lg)",padding:"1.5rem",width:"100%",maxWidth:480,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",maxHeight:"90vh",overflowY:"auto" }}>
        <div style={{ fontSize:16,fontWeight:600,marginBottom:16 }}>{isEdit?"Editar residente":"Agregar residente"}</div>
        {error&&<div className="alert error" style={{ marginBottom:12 }}>{error}</div>}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12 }}>
          <div><label style={LS}>Calle *</label><select value={form.calle} onChange={e=>set("calle",e.target.value)} style={{ ...IS,cursor:"pointer" }}><option value="">Selecciona...</option>{CALLES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><label style={LS}>Lote *</label><input style={IS} value={form.lote} onChange={e=>set("lote",e.target.value)} placeholder="Ej: 12"/></div>
          <div><label style={LS}>Manzana *</label><input style={IS} value={form.mza} onChange={e=>set("mza",e.target.value)} placeholder="Ej: 3"/></div>
          <div><label style={LS}>Teléfono</label><input style={IS} value={form.telefono} onChange={e=>set("telefono",e.target.value)} placeholder="55 1234 5678"/></div>
        </div>
        <div style={{ marginBottom:12 }}><label style={LS}>Nombre del residente *</label><input style={IS} value={form.residente} onChange={e=>set("residente",e.target.value)} placeholder="Nombre completo"/></div>
        <div style={{ marginBottom:16 }}><label style={LS}>Deuda extra (MXN)</label><input style={IS} type="number" min="0" value={form.deuda_extra} onChange={e=>set("deuda_extra",e.target.value)}/></div>
        <div style={{ display:"flex",gap:8 }}>
          <button className="btn" style={{ flex:1,justifyContent:"center" }} onClick={onClose}>Cancelar</button>
          <button className="btn primary" style={{ flex:1,justifyContent:"center" }} onClick={handleSave} disabled={loading}>{loading?"Guardando...":isEdit?"Guardar cambios":"Agregar residente"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────
export default function ResidentesPage() {
  const [residents, setResidents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [calle, setCalle]         = useState("");
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("");
  const [selected, setSelected]   = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast]         = useState(null);
  const [delLoading, setDelLoading] = useState(false);

  const showToast = (msg,ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3000); };

  const load = useCallback(()=>{
    setLoading(true);
    const p=new URLSearchParams();
    if(calle) p.set("calle",calle);
    if(search) p.set("search",search);
    api.get(`/api/residents?${p}`).then(r=>setResidents(r.data)).catch(console.error).finally(()=>setLoading(false));
  },[calle,search]);

  useEffect(()=>{ load(); },[load]);

  const filtered = residents.filter(r=>{
    if(!statusFilter) return true;
    const d=calcDeuda(r);
    if(statusFilter==="moroso")    return d>700;
    if(statusFilter==="leve")      return d>0&&d<=700;
    if(statusFilter==="corriente") return d===0;
    return true;
  });

  const copyWA = r => {
    const d=calcDeuda(r), n=r.residente.split("/")[0].trim();
    const msg=`Estimado/a *${n}*,\n\nLe recordamos que tiene una deuda pendiente de *$${d.toLocaleString()} MXN*.\n\nPuede registrar su pago en: https://formularioresidentes.onrender.com\n\n_Administración del Fraccionamiento_`;
    navigator.clipboard.writeText(msg).then(()=>showToast("Mensaje copiado")).catch(()=>showToast("Error al copiar",false));
  };

  const handleDelete = async () => {
    setDelLoading(true);
    try { await api.delete(`/api/residents/${deleteTarget.id}`); setDeleteTarget(null); setSelected(null); load(); showToast("Residente eliminado"); }
    catch(err){ showToast(err.response?.data?.error||"Error al eliminar",false); }
    finally{ setDelLoading(false); }
  };

  return (
    <div style={{ padding:"2rem", flex:1 }}>
      {toast&&<div className={`toast ${toast.ok?"":"error"}`} style={{ position:"fixed",top:16,right:16,zIndex:100,padding:"12px 20px",borderRadius:"var(--radius)",boxShadow:"0 4px 16px rgba(0,0,0,0.12)" }}>{toast.msg}</div>}

      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4,flexWrap:"wrap",gap:12 }}>
        <div>
          <div className="page-title">Residentes</div>
          <div className="page-sub">{filtered.length} residente{filtered.length!==1?"s":""} · Gestión y seguimiento de pagos</div>
        </div>
        <button className="btn primary" onClick={()=>setEditModal("new")}>+ Agregar residente</button>
      </div>

      {/* Panel de detalle */}
      {selected && (
        <div className="detail-panel">
          <div className="detail-header">
            <div>
              <div className="name">{selected.residente.split("/")[0].trim()}</div>
              <div className="meta">{selected.calle} · Lote {selected.lote} · Mza {selected.mza}{selected.telefono?` · ${selected.telefono}`:""}</div>
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
              <span className={badgeCls(statusOf(calcDeuda(selected)))}>{badgeLbl(statusOf(calcDeuda(selected)))}</span>
              {calcDeuda(selected)>0&&<span className="detail-deuda">{fmtMXN(calcDeuda(selected))}</span>}
              <RowMenu onEdit={()=>setEditModal(selected)} onDelete={()=>setDeleteTarget(selected)} />
              <button className="btn-close" onClick={()=>setSelected(null)}>✕</button>
            </div>
          </div>
          <PayGrid r={selected} />
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
        </select>
      </div>

      <div className="card" style={{ marginBottom:0 }}>
        <table>
          <thead><tr><th>Residente</th><th>Calle</th><th>Lote / Mza</th><th>Teléfono</th><th>Estado</th><th style={{ textAlign:"right" }}>Deuda</th><th></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ textAlign:"center",padding:"3rem",color:"var(--text2)" }}>Cargando...</td></tr>
            ) : filtered.length===0 ? (
              <tr><td colSpan="7" style={{ textAlign:"center",padding:"3rem",color:"var(--text2)" }}>Sin resultados</td></tr>
            ) : filtered.map(r=>{
              const d=calcDeuda(r); const st=statusOf(d);
              return (
                <tr key={r.id} onClick={()=>setSelected(r)} style={{ cursor:"pointer" }}>
                  <td style={{ fontWeight:500 }}>{r.residente.split("/")[0].trim()}</td>
                  <td style={{ color:"var(--text2)" }}>{r.calle}</td>
                  <td style={{ color:"var(--text3)" }}>L{r.lote} · Mza {r.mza}</td>
                  <td style={{ color:"var(--text3)",fontSize:12 }}>{r.telefono||"—"}</td>
                  <td><span className={badgeCls(st)}>{badgeLbl(st)}</span></td>
                  <td style={{ textAlign:"right",fontWeight:600,color:d>0?"var(--red)":"var(--green)" }}>{d>0?fmtMXN(d):"—"}</td>
                  <td>
                    <RowMenu onEdit={()=>setEditModal(r)} onDelete={()=>setDeleteTarget(r)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal editar/crear */}
      {editModal&&(
        <ResidentModal resident={editModal==="new"?null:editModal} onClose={()=>setEditModal(null)}
          onSaved={()=>{ setEditModal(null); setSelected(null); load(); showToast(editModal==="new"?"Residente agregado":"Cambios guardados"); }}/>
      )}

      {/* Modal confirmar eliminación */}
      {deleteTarget&&(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem" }}>
          <div style={{ background:"var(--surface)",borderRadius:"var(--radius-lg)",padding:"1.5rem",width:"100%",maxWidth:400,boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize:16,fontWeight:600,marginBottom:8 }}>Eliminar residente</div>
            <p style={{ fontSize:13,color:"var(--text2)",marginBottom:16 }}>¿Estás seguro de eliminar a <strong>{deleteTarget.residente.split("/")[0].trim()}</strong>? Esta acción no se puede deshacer.</p>
            <div style={{ display:"flex",gap:8 }}>
              <button className="btn" style={{ flex:1,justifyContent:"center" }} onClick={()=>setDeleteTarget(null)}>Cancelar</button>
              <button className="btn red" style={{ flex:1,justifyContent:"center" }} onClick={handleDelete} disabled={delLoading}>{delLoading?"Eliminando...":"Sí, eliminar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
