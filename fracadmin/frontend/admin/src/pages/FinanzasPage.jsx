import { useEffect, useState, useCallback, useRef } from "react";
import api from "../lib/api";
import { fmtMXN } from "../lib/helpers";

const TABS = [
  { key: "movimientos", label: "Movimientos", icon: "📊" },
  { key: "cuentas",     label: "Cuentas",     icon: "🏦" },
  { key: "categorias",  label: "Categorías",  icon: "🏷️" },
];

const IS   = { width:"100%", padding:"8px 10px", borderRadius:6, border:"0.5px solid var(--border2)", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
const LS   = { display:"block", fontSize:11, fontWeight:500, color:"var(--text2)", marginBottom:5 };
const MDAL = { position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" };
const BOX  = { background:"var(--surface)", borderRadius:"var(--radius-lg)", padding:"1.5rem", width:"100%", boxShadow:"0 8px 32px rgba(0,0,0,0.18)", maxHeight:"90vh", overflowY:"auto" };

// ── Menú contextual ────────────────────────────────────────────
function RowMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position:"relative", display:"inline-block" }}>
      <button className="btn" style={{ padding:"3px 10px", fontSize:12 }} onClick={()=>setOpen(o=>!o)}>
        ⋯
      </button>
      {open && (
        <div style={{ position:"absolute", right:0, top:"100%", marginTop:4, background:"var(--surface)", border:"0.5px solid var(--border2)", borderRadius:"var(--radius)", boxShadow:"0 4px 16px rgba(0,0,0,0.12)", zIndex:10, minWidth:130, overflow:"hidden" }}>
          <button onClick={()=>{setOpen(false);onEdit();}} style={{ display:"block", width:"100%", textAlign:"left", padding:"9px 14px", fontSize:13, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", color:"var(--text)" }}
                  onMouseOver={e=>e.currentTarget.style.background="var(--surface2)"}
                  onMouseOut={e=>e.currentTarget.style.background="none"}>
            ✏️ Editar
          </button>
          <button onClick={()=>{setOpen(false);onDelete();}} style={{ display:"block", width:"100%", textAlign:"left", padding:"9px 14px", fontSize:13, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", color:"var(--red)" }}
                  onMouseOver={e=>e.currentTarget.style.background="var(--red-bg)"}
                  onMouseOut={e=>e.currentTarget.style.background="none"}>
            🗑 Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Modal movimiento ───────────────────────────────────────────
function MovModal({ mov, categorias, cuentas, onClose, onSaved }) {
  const isEdit = !!mov?.id;
  const [form, setForm] = useState({
    fecha:       mov?.fecha?.slice(0,10) || new Date().toISOString().slice(0,10),
    tipo:        mov?.tipo        || "gasto",
    concepto:    mov?.concepto    || "",
    monto:       mov?.monto       || "",
    categoria_id: String(mov?.categoria_id||""),
    cuenta_id:   String(mov?.cuenta_id||""),
    notas:       mov?.notas       || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.concepto || !form.monto) return setError("Concepto y monto son requeridos");
    setLoading(true); setError("");
    try {
      if (isEdit) await api.patch(`/api/finanzas/movimientos/${mov.id}`, form);
      else        await api.post("/api/finanzas/movimientos", form);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || "Error al guardar");
    } finally { setLoading(false); }
  };

  return (
    <div style={MDAL}>
      <div style={{ ...BOX, maxWidth:490 }}>
        <div style={{ fontSize:16, fontWeight:600, marginBottom:16 }}>{isEdit?"Editar movimiento":"Nuevo movimiento"}</div>
        {error && <div className="alert error" style={{ marginBottom:12 }}>{error}</div>}

        <div style={{ marginBottom:14 }}>
          <label style={LS}>Tipo</label>
          <div style={{ display:"flex", gap:6 }}>
            {["gasto","ingreso"].map(t=>(
              <button key={t} type="button" onClick={()=>set("tipo",t)}
                      style={{ flex:1, padding:"8px", borderRadius:6, fontSize:13, fontFamily:"inherit", cursor:"pointer", fontWeight:form.tipo===t?600:400, border:`0.5px solid ${form.tipo===t?(t==="gasto"?"var(--red)":"var(--green)"):"var(--border2)"}`, background:form.tipo===t?(t==="gasto"?"var(--red-bg)":"var(--green-bg)"):"var(--surface)", color:form.tipo===t?(t==="gasto"?"var(--red)":"var(--green)"):"var(--text2)" }}>
                {t==="gasto"?"💸 Gasto":"💰 Ingreso"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
          <div><label style={LS}>Fecha</label><input style={IS} type="date" value={form.fecha} onChange={e=>set("fecha",e.target.value)}/></div>
          <div><label style={LS}>Monto (MXN) *</label>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--text3)", fontSize:13 }}>$</span>
              <input style={{ ...IS, paddingLeft:22 }} type="number" min="0" step="0.01" value={form.monto} onChange={e=>set("monto",e.target.value)} placeholder="0"/>
            </div>
          </div>
        </div>
        <div style={{ marginBottom:12 }}><label style={LS}>Concepto *</label><input style={IS} value={form.concepto} onChange={e=>set("concepto",e.target.value)} placeholder="Ej: Vigilancia Junio 1/2"/></div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
          <div><label style={LS}>Categoría</label>
            <select style={{ ...IS, cursor:"pointer" }} value={form.categoria_id} onChange={e=>set("categoria_id",e.target.value)}>
              <option value="">Sin categoría</option>
              {categorias.filter(c=>c.tipo===form.tipo).map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div><label style={LS}>Cuenta</label>
            <select style={{ ...IS, cursor:"pointer" }} value={form.cuenta_id} onChange={e=>set("cuenta_id",e.target.value)}>
              <option value="">Sin especificar</option>
              {cuentas.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom:16 }}><label style={LS}>Notas</label><textarea style={{ ...IS, resize:"none", height:56 }} value={form.notas} onChange={e=>set("notas",e.target.value)} placeholder="Detalles..."/></div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn" style={{ flex:1, justifyContent:"center" }} onClick={onClose}>Cancelar</button>
          <button className={`btn ${form.tipo==="gasto"?"red":"primary"}`} style={{ flex:1, justifyContent:"center" }} onClick={handleSave} disabled={loading}>
            {loading?"Guardando...":isEdit?"Guardar":"Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal cuenta ───────────────────────────────────────────────
function CuentaModal({ cuenta, onClose, onSaved }) {
  const isEdit = !!cuenta?.id;
  const [form, setForm] = useState({ nombre:cuenta?.nombre||"", tipo:cuenta?.tipo||"efectivo", saldo_inicial:cuenta?.saldo_inicial||"0" });
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const handleSave = async () => {
    if (!form.nombre) return;
    setLoading(true);
    try {
      if (isEdit) await api.patch(`/api/finanzas/cuentas/${cuenta.id}`, form);
      else        await api.post("/api/finanzas/cuentas", form);
      onSaved();
    } catch { setLoading(false); }
  };
  return (
    <div style={MDAL}>
      <div style={{ ...BOX, maxWidth:380 }}>
        <div style={{ fontSize:16, fontWeight:600, marginBottom:16 }}>{isEdit?"Editar cuenta":"Nueva cuenta"}</div>
        <div style={{ marginBottom:12 }}><label style={LS}>Nombre *</label><input style={IS} value={form.nombre} onChange={e=>set("nombre",e.target.value)} placeholder="Ej: Cuenta Bancaria"/></div>
        <div style={{ marginBottom:12 }}><label style={LS}>Tipo</label>
          <select style={{ ...IS, cursor:"pointer" }} value={form.tipo} onChange={e=>set("tipo",e.target.value)}>
            <option value="efectivo">Efectivo</option>
            <option value="debito">Tarjeta débito</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>
        {!isEdit && <div style={{ marginBottom:16 }}><label style={LS}>Saldo inicial (MXN)</label><input style={IS} type="number" value={form.saldo_inicial} onChange={e=>set("saldo_inicial",e.target.value)}/></div>}
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn" style={{ flex:1, justifyContent:"center" }} onClick={onClose}>Cancelar</button>
          <button className="btn primary" style={{ flex:1, justifyContent:"center" }} onClick={handleSave} disabled={loading}>{loading?"Guardando...":isEdit?"Guardar":"Crear"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal categoría ────────────────────────────────────────────
function CatModal({ cat, onClose, onSaved }) {
  const isEdit = !!cat?.id;
  const [form, setForm] = useState({ nombre:cat?.nombre||"", tipo:cat?.tipo||"gasto", color:cat?.color||"#854F0B" });
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const handleSave = async () => {
    if (!form.nombre) return;
    setLoading(true);
    try {
      if (isEdit) await api.patch(`/api/finanzas/categorias/${cat.id}`, form);
      else        await api.post("/api/finanzas/categorias", form);
      onSaved();
    } catch { setLoading(false); }
  };
  return (
    <div style={MDAL}>
      <div style={{ ...BOX, maxWidth:360 }}>
        <div style={{ fontSize:16, fontWeight:600, marginBottom:16 }}>{isEdit?"Editar categoría":"Nueva categoría"}</div>
        <div style={{ marginBottom:12 }}><label style={LS}>Nombre *</label><input style={IS} value={form.nombre} onChange={e=>set("nombre",e.target.value)} placeholder="Ej: Fumigación"/></div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12, marginBottom:16 }}>
          <div><label style={LS}>Tipo</label>
            <select style={{ ...IS, cursor:"pointer" }} value={form.tipo} onChange={e=>set("tipo",e.target.value)}>
              <option value="gasto">Gasto</option>
              <option value="ingreso">Ingreso</option>
            </select>
          </div>
          <div><label style={LS}>Color</label><input type="color" value={form.color} onChange={e=>set("color",e.target.value)} style={{ width:42, height:36, borderRadius:6, border:"0.5px solid var(--border2)", cursor:"pointer", padding:2 }}/></div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn" style={{ flex:1, justifyContent:"center" }} onClick={onClose}>Cancelar</button>
          <button className="btn primary" style={{ flex:1, justifyContent:"center" }} onClick={handleSave} disabled={loading}>{loading?"Guardando...":isEdit?"Guardar":"Crear"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal confirmar eliminación ────────────────────────────────
function ConfirmModal({ msg, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  return (
    <div style={MDAL}>
      <div style={{ ...BOX, maxWidth:380 }}>
        <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>Confirmar eliminación</div>
        <p style={{ fontSize:13, color:"var(--text2)", marginBottom:16 }}>{msg}</p>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn" style={{ flex:1, justifyContent:"center" }} onClick={onClose}>Cancelar</button>
          <button className="btn red" style={{ flex:1, justifyContent:"center" }} disabled={loading}
                  onClick={async()=>{ setLoading(true); await onConfirm(); }}>
            {loading?"Eliminando...":"Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────
export default function FinanzasPage() {
  const [tab, setTab]             = useState("movimientos");
  const [movimientos, setMov]     = useState([]);
  const [cuentas, setCuentas]     = useState([]);
  const [categorias, setCats]     = useState([]);
  const [resumen, setResumen]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [tipoFilter, setTipoFilter] = useState("");
  const [movModal, setMovModal]   = useState(null);   // null | "new" | obj
  const [cuentaModal, setCuentaModal] = useState(null); // null | "new" | obj
  const [catModal, setCatModal]   = useState(null);   // null | "new" | obj
  const [confirmModal, setConfirm] = useState(null);  // { msg, action }
  const [toast, setToast]         = useState(null);

  const showToast = (msg, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3000); };

  // Aviso día 5
  const hoy = new Date().getDate();
  const esDiaCobro = hoy >= 1 && hoy <= 7;
  const mes = new Date().toLocaleDateString("es-MX",{month:"long"});

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [mv, ct, ca, rs] = await Promise.all([
        api.get(`/api/finanzas/movimientos?limit=300${tipoFilter?`&tipo=${tipoFilter}`:""}`),
        api.get("/api/finanzas/cuentas"),
        api.get("/api/finanzas/categorias"),
        api.get("/api/finanzas/resumen"),
      ]);
      setMov(mv.data.data);
      setCuentas(ct.data);
      setCats(ca.data);
      setResumen(rs.data);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [tipoFilter]);

  useEffect(()=>{ loadAll(); }, [loadAll]);

  const balance = resumen ? Number(resumen.total_ingresos||0) - Number(resumen.total_gastos||0) : 0;

  return (
    <div style={{ padding:"2rem", flex:1 }}>
      {toast && (
        <div className={`toast ${toast.ok?"":"error"}`} style={{ position:"fixed", top:16, right:16, zIndex:100, padding:"12px 20px", borderRadius:"var(--radius)", boxShadow:"0 4px 16px rgba(0,0,0,0.12)", minWidth:260 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4, flexWrap:"wrap", gap:12 }}>
        <div>
          <div className="page-title">Finanzas del Fraccionamiento</div>
          <div className="page-sub">Gestión de gastos, ingresos y cuentas</div>
        </div>
        <button className="btn primary" onClick={()=>setMovModal("new")}>+ Nuevo movimiento</button>
      </div>

      {/* Aviso día de cobro */}
      {esDiaCobro && (
        <div className="alert amber" style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"1.5rem" }}>
          <span style={{ fontSize:20 }}>📅</span>
          <div>
            <strong>Fecha de cobro mensual</strong> — El día 5 de {mes} es la fecha de pago de los residentes.
            Recuerda enviar recordatorios a los morosos.
          </div>
        </div>
      )}

      {/* Métricas */}
      {resumen && (
        <div className="metrics">
          <div className="metric green"><label>Total ingresos</label><div className="val" style={{ fontSize:18 }}>{fmtMXN(resumen.total_ingresos||0)}</div></div>
          <div className="metric red"><label>Total gastos</label><div className="val" style={{ fontSize:18 }}>{fmtMXN(resumen.total_gastos||0)}</div></div>
          <div className={`metric ${balance>=0?"blue":"red"}`}><label>Balance</label><div className="val" style={{ fontSize:18 }}>{fmtMXN(Math.abs(balance))}</div><div className="sub">{balance>=0?"Superávit":"Déficit"}</div></div>
          {cuentas.map(c=>(
            <div key={c.id} className={`metric ${Number(c.saldo_actual)>=0?"blue":"red"}`}>
              <label>{c.nombre}</label>
              <div className="val" style={{ fontSize:18 }}>{fmtMXN(c.saldo_actual||0)}</div>
              <div className="sub">{c.tipo}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {TABS.map(t=>(
          <button key={t.key} className={`tab ${tab===t.key?"active":""}`} onClick={()=>setTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── MOVIMIENTOS ── */}
      {tab==="movimientos" && (
        <>
          <div className="filters">
            <select value={tipoFilter} onChange={e=>setTipoFilter(e.target.value)}>
              <option value="">Todos los movimientos</option>
              <option value="gasto">Solo gastos</option>
              <option value="ingreso">Solo ingresos</option>
            </select>
          </div>
          {loading ? (
            <div className="empty"><div className="icon">📊</div><p>Cargando...</p></div>
          ) : movimientos.length===0 ? (
            <div className="empty"><div className="icon">📊</div><p>Sin movimientos registrados.</p><button className="btn primary" onClick={()=>setMovModal("new")}>+ Agregar primero</button></div>
          ) : (
            <div className="card" style={{ marginBottom:0 }}>
              <div className="card-header">
                <h3>{movimientos.length} movimientos</h3>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:12, color:"var(--green)", fontWeight:500 }}>
                    ↑ {fmtMXN(movimientos.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+Number(m.monto),0))}
                  </span>
                  <span style={{ fontSize:12, color:"var(--red)", fontWeight:500 }}>
                    ↓ {fmtMXN(movimientos.filter(m=>m.tipo==="gasto").reduce((s,m)=>s+Number(m.monto),0))}
                  </span>
                </div>
              </div>
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Cuenta</th><th>Tipo</th>
                      <th style={{ textAlign:"right" }}>Monto</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map(m=>(
                      <tr key={m.id}>
                        <td style={{ fontSize:12, color:"var(--text3)", whiteSpace:"nowrap" }}>
                          {new Date(m.fecha+"T12:00:00").toLocaleDateString("es-MX")}
                        </td>
                        <td>
                          <div style={{ fontWeight:500, fontSize:13 }}>{m.concepto}</div>
                          {m.notas && <div style={{ fontSize:11, color:"var(--text3)" }}>{m.notas}</div>}
                        </td>
                        <td>
                          {m.categoria_nombre
                            ? <span className="badge" style={{ background:(m.categoria_color||"#854F0B")+"22", color:m.categoria_color||"#854F0B" }}>{m.categoria_nombre}</span>
                            : <span style={{ color:"var(--text3)", fontSize:12 }}>—</span>}
                        </td>
                        <td style={{ fontSize:12, color:"var(--text2)" }}>{m.cuenta_nombre||"—"}</td>
                        <td><span className={`badge ${m.tipo==="ingreso"?"green":"red"}`}>{m.tipo==="ingreso"?"💰 Ingreso":"💸 Gasto"}</span></td>
                        <td style={{ textAlign:"right", fontWeight:600, color:m.tipo==="ingreso"?"var(--green)":"var(--red)" }}>
                          {m.tipo==="gasto"?"–":"+"}  {fmtMXN(m.monto)}
                        </td>
                        <td>
                          <RowMenu
                            onEdit={()=>setMovModal(m)}
                            onDelete={()=>setConfirm({ msg:`¿Eliminar "${m.concepto}"? Esta acción no se puede deshacer.`, action: async()=>{ await api.delete(`/api/finanzas/movimientos/${m.id}`); setConfirm(null); loadAll(); showToast("Movimiento eliminado"); }})}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── CUENTAS ── */}
      {tab==="cuentas" && (
        <>
          <div style={{ marginBottom:"1rem" }}>
            <button className="btn" onClick={()=>setCuentaModal("new")}>+ Nueva cuenta</button>
          </div>
          <div className="two-col">
            {cuentas.map(c=>(
              <div className="card" key={c.id} style={{ marginBottom:0 }}>
                <div className="card-header">
                  <h3>{c.nombre}</h3>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span className="badge">{c.tipo}</span>
                    <RowMenu
                      onEdit={()=>setCuentaModal(c)}
                      onDelete={()=>setConfirm({ msg:`¿Eliminar la cuenta "${c.nombre}"? Los movimientos quedarán sin cuenta asignada.`, action: async()=>{ await api.delete(`/api/finanzas/cuentas/${c.id}`); setConfirm(null); loadAll(); showToast("Cuenta eliminada"); }})}
                    />
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ fontSize:11, color:"var(--text2)", marginBottom:4 }}>Saldo actual</div>
                  <div style={{ fontSize:28, fontWeight:600, color:Number(c.saldo_actual)>=0?"var(--blue)":"var(--red)" }}>{fmtMXN(c.saldo_actual||0)}</div>
                  <div style={{ fontSize:11, color:"var(--text3)", marginTop:4 }}>Saldo inicial: {fmtMXN(c.saldo_inicial||0)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── CATEGORÍAS ── */}
      {tab==="categorias" && (
        <>
          <div style={{ marginBottom:"1rem" }}>
            <button className="btn" onClick={()=>setCatModal("new")}>+ Nueva categoría</button>
          </div>
          <div className="two-col">
            {["gasto","ingreso"].map(tipo=>(
              <div className="card" key={tipo} style={{ marginBottom:0 }}>
                <div className="card-header"><h3>{tipo==="gasto"?"💸 Gastos":"💰 Ingresos"}</h3></div>
                <div style={{ padding:"0.25rem 0" }}>
                  {categorias.filter(c=>c.tipo===tipo).map(c=>(
                    <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 16px", borderBottom:"0.5px solid var(--border)" }}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:c.color, flexShrink:0 }}/>
                      <span style={{ fontSize:13, flex:1 }}>{c.nombre}</span>
                      <RowMenu
                        onEdit={()=>setCatModal(c)}
                        onDelete={()=>setConfirm({ msg:`¿Eliminar la categoría "${c.nombre}"?`, action: async()=>{ await api.delete(`/api/finanzas/categorias/${c.id}`); setConfirm(null); loadAll(); showToast("Categoría eliminada"); }})}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modales */}
      {movModal    && <MovModal    mov={movModal==="new"?null:movModal}       categorias={categorias} cuentas={cuentas} onClose={()=>setMovModal(null)}    onSaved={()=>{ setMovModal(null);    loadAll(); showToast(movModal==="new"?"Movimiento agregado":"Cambios guardados"); }}/>}
      {cuentaModal && <CuentaModal cuenta={cuentaModal==="new"?null:cuentaModal}                                        onClose={()=>setCuentaModal(null)} onSaved={()=>{ setCuentaModal(null); loadAll(); showToast(cuentaModal==="new"?"Cuenta creada":"Cuenta actualizada"); }}/>}
      {catModal    && <CatModal    cat={catModal==="new"?null:catModal}                                                  onClose={()=>setCatModal(null)}    onSaved={()=>{ setCatModal(null);    loadAll(); showToast(catModal==="new"?"Categoría creada":"Categoría actualizada"); }}/>}
      {confirmModal && <ConfirmModal msg={confirmModal.msg} onClose={()=>setConfirm(null)} onConfirm={confirmModal.action}/>}
    </div>
  );
}
