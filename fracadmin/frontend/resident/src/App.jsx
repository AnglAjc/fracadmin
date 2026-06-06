import { useState, useRef, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const CALLES = ["AMADA","BALVINA","MARBELLA","MANUELA","VIRGINIA"];
const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// Todos los meses de 2026 (permite adelantar pagos)
function getMeses2026() {
  const opciones = [];
  for (let m = 1; m <= 12; m++) {
    opciones.push({ label:`${MESES_FULL[m-1]} 2026`, mes:m, anio:2026, key:`${m}-2026`, cuota:400 });
  }
  return opciones.reverse();
}

async function fileToBase64(file) {
  return new Promise((res,rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

const DRAFT_KEY = "fracadmin_draft_v3";
const saveDraft  = (d) => { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({...d,ts:Date.now()})); } catch {} };
const loadDraft  = () => { try { const d=JSON.parse(sessionStorage.getItem(DRAFT_KEY)||"null"); if(!d||Date.now()-d.ts>2*60*60*1000){sessionStorage.removeItem(DRAFT_KEY);return null;} return d; } catch{return null;} };
const clearDraft = () => { try{sessionStorage.removeItem(DRAFT_KEY);}catch{} };

const emptyProp = () => ({ id:Date.now(), calle:"", lote:"", mza:"", resident_id:"", residentData:null, mesesSel:[], imagePreview:null, imageBase64:null });

function calcPendientes(rd) {
  if (!rd) return [];
  const now = new Date();
  const maxM26 = now.getFullYear()>=2026 ? now.getMonth() : 0;
  const p25 = rd.pagos25||{}, p26 = rd.pagos26||{};
  const list = [];
  for (let m=0;m<12;m++) if(p25[m]==="pendiente") list.push({mes:m+1,anio:2025,key:`${m+1}-2025`,label:`${MESES_FULL[m]} 2025`,cuota:350});
  for (let m=0;m<maxM26;m++) if(p26[m]==="pendiente") list.push({mes:m+1,anio:2026,key:`${m+1}-2026`,label:`${MESES_FULL[m]} 2026`,cuota:400});
  return list;
}

// ── Iconos ─────────────────────────────────────────────────────
const Check  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>;
const Trash  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
const Copy   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;

const BANCO_DATOS = [
  { label: "Banco",    valor: "BANAMEX" },
  { label: "Titular",  valor: "Ernesto Flores Castañón" },
  { label: "Cuenta",   valor: "002180701208704228" },
];

// ── Paso 1: Datos personales ───────────────────────────────────
function Paso1({ form, setF, searchResults, searching, onSelectResident, onNext, error }) {
  const [copiedIdx, setCopiedIdx] = useState(null);
  const inp = { width:"100%",padding:"11px 13px",borderRadius:10,border:"0.5px solid var(--border2)",fontSize:14,background:"var(--surface)",color:"var(--text)",outline:"none",fontFamily:"inherit",boxSizing:"border-box" };

  const copyDato = (idx, valor) => {
    navigator.clipboard.writeText(valor).then(() => { setCopiedIdx(idx); setTimeout(()=>setCopiedIdx(null),2000); });
  };

  return (
    <div>
      <div style={{ background:"var(--blue-bg)",border:"1px solid var(--blue)",borderRadius:12,padding:"14px 16px",marginBottom:18 }}>
        <div style={{ fontSize:12,fontWeight:700,color:"var(--blue-text)",marginBottom:10 }}>🏦 Datos para transferencia bancaria</div>
        {BANCO_DATOS.map((d,i) => (
          <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:i<BANCO_DATOS.length-1?"0.5px solid rgba(24,95,165,0.15)":"none" }}>
            <div>
              <div style={{ fontSize:10,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.05em" }}>{d.label}</div>
              <div style={{ fontSize:14,fontWeight:700,color:"var(--blue-text)",fontFamily:"monospace",marginTop:1 }}>{d.valor}</div>
            </div>
            <button type="button" onClick={()=>copyDato(i,d.valor)}
                    style={{ display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:7,border:"1px solid var(--blue)",background:copiedIdx===i?"var(--green-bg)":"var(--surface)",color:copiedIdx===i?"var(--green)":"var(--blue)",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s",flexShrink:0 }}>
              {copiedIdx===i ? <><Check/> Copiado</> : <><Copy/> Copiar</>}
            </button>
          </div>
        ))}
      </div>

      {error && <div style={{ background:"var(--red-bg)",color:"var(--red)",borderRadius:9,padding:"10px 13px",fontSize:13,marginBottom:14,display:"flex",gap:8 }}><span>⚠️</span>{error}</div>}

      <div style={{ marginBottom:14,position:"relative" }}>
        <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text2)",marginBottom:7 }}>👤 Nombre completo *</label>
        <input style={inp} value={form.nombre} autoFocus
               onChange={e=>setF("nombre",e.target.value)}
               placeholder="Escribe tu nombre para buscarte..."/>
        {searching && <div style={{ fontSize:11,color:"var(--text3)",marginTop:4 }}>Buscando...</div>}
        {searchResults.length > 0 && (
          <div style={{ position:"absolute",left:0,right:0,top:"100%",marginTop:4,background:"var(--surface)",border:"0.5px solid var(--border2)",borderRadius:10,boxShadow:"0 4px 20px rgba(0,0,0,0.12)",zIndex:20,overflow:"hidden" }}>
            {searchResults.map(r => (
              <button key={r.id} type="button" onClick={() => onSelectResident(r)}
                      style={{ display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"11px 14px",fontSize:13,borderBottom:"0.5px solid var(--border)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",gap:8 }}
                      onMouseOver={e=>e.currentTarget.style.background="var(--blue-bg)"}
                      onMouseOut={e=>e.currentTarget.style.background="none"}>
                <span style={{ fontWeight:600,color:"var(--text)" }}>{r.residente.split("/")[0].trim()}</span>
                <span style={{ fontSize:11,color:"var(--text3)",flexShrink:0 }}>{r.calle} · L{r.lote}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom:0 }}>
        <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text2)",marginBottom:7 }}>📱 Número de WhatsApp *</label>
        <input style={inp} type="tel" value={form.telefono} onChange={e=>setF("telefono",e.target.value)} placeholder="55 1234 5678"/>
        <div style={{ fontSize:11,color:"var(--text3)",marginTop:5 }}>Recibirás la confirmación de tu pago aquí</div>
      </div>

      <button type="button" onClick={onNext}
              style={{ width:"100%",padding:"13px",borderRadius:11,border:"none",background:"var(--blue)",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:20,boxShadow:"0 4px 14px rgba(24,95,165,0.25)" }}>
        Continuar →
      </button>
    </div>
  );
}

// ── Paso 2: Propiedades con meses por propiedad ────────────────
function Paso2({ propiedades, setPropiedades, residenteOpciones, form, onNext, onBack, error }) {
  const opciones2026 = getMeses2026();
  const [propActiva, setPropActiva] = useState(0);
  const fileRefs = useRef({});

  const addProp = () => {
    const propIds = propiedades.map(p=>p.resident_id).filter(Boolean);
    const siguiente = residenteOpciones.find(rd => !propIds.includes(rd.id));
    const nuevaProp = emptyProp();
    if (siguiente) {
      nuevaProp.calle       = siguiente.calle;
      nuevaProp.lote        = siguiente.lote;
      nuevaProp.mza         = siguiente.mza || "";
      nuevaProp.resident_id = siguiente.id;
      nuevaProp.residentData = siguiente;
    }
    setPropiedades(prev => [...prev, nuevaProp]);
    setPropActiva(propiedades.length);
  };
  const removeProp = (idx) => {
    setPropiedades(prev => prev.filter((_,i)=>i!==idx));
    setPropActiva(Math.max(0, propActiva-1));
  };
  const updateProp = (idx,k,v) => setPropiedades(prev=>prev.map((p,i)=>i===idx?{...p,[k]:v}:p));
  const toggleMes  = (idx,op) => setPropiedades(prev=>prev.map((p,i)=>i===idx?{...p,mesesSel:p.mesesSel.find(m=>m.key===op.key)?p.mesesSel.filter(m=>m.key!==op.key):[...p.mesesSel,op]}:p));

  const autofillProp = async (idx, calle, lote, mza) => {
    if (!calle||!lote) return;
    try {
      const p=new URLSearchParams({calle,lote}); if(mza) p.set("mza",mza);
      const {data}=await axios.get(`${API}/api/residents/by-location?${p}`);
      if(data) updateProp(idx,"residentData",data);
    } catch {}
  };

  const handleImage = async (idx, file) => {
    if(!file) return;
    if(file.size>5*1024*1024) return;
    const b64 = await fileToBase64(file);
    setPropiedades(prev=>prev.map((p,i)=>i===idx?{...p,imageBase64:b64,imagePreview:URL.createObjectURL(file)}:p));
  };

  const selectResidentProp = (idx, rd) => {
    setPropiedades(prev=>prev.map((p,i)=>i===idx?{...p,calle:rd.calle,lote:rd.lote,mza:rd.mza||"",resident_id:rd.id,residentData:rd}:p));
  };

  const prop = propiedades[propActiva] || propiedades[0];
  if (!prop) return null;

  // ── Lógica de meses permitidos según deuda ─────────────────
  const pendientes = prop.residentData && !prop.residentData.manual
    ? calcPendientes(prop.residentData)
    : [];
  const esCritico = pendientes.length > 3;
  const pendientesMostrar = esCritico ? pendientes.slice(0, 3) : pendientes;
  // Meses habilitados para seleccionar:
  // - Si crítico: solo los 3 primeros meses de deuda
  // - Si no crítico: meses pendientes + cualquier mes 2026
  const mesesHabilitados = esCritico
    ? pendientesMostrar
    : [...pendientes, ...opciones2026.filter(op => !pendientes.find(p => p.key === op.key))];

  const inp = {width:"100%",padding:"9px 11px",borderRadius:9,border:"0.5px solid var(--border2)",fontSize:13,background:"var(--surface)",color:"var(--text)",outline:"none",fontFamily:"inherit",boxSizing:"border-box"};

  return (
    <div>
      {error && <div style={{background:"var(--red-bg)",color:"var(--red)",borderRadius:9,padding:"10px 13px",fontSize:13,marginBottom:14,display:"flex",gap:8}}><span>⚠️</span>{error}</div>}

      {propiedades.length > 1 && (
        <div style={{ display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4 }}>
          {propiedades.map((p,i) => (
            <button key={p.id} type="button" onClick={()=>setPropActiva(i)}
                    style={{ flexShrink:0,padding:"6px 14px",borderRadius:8,border:`1.5px solid ${i===propActiva?"var(--blue)":"var(--border2)"}`,background:i===propActiva?"var(--blue-bg)":"var(--surface)",color:i===propActiva?"var(--blue-text)":"var(--text2)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5 }}>
              {p.residentData ? <Check/> : null}
              {p.calle||`Propiedad ${i+1}`}{p.lote?` L${p.lote}`:""}
              {p.mesesSel.length>0 && <span style={{background:"var(--blue)",color:"#fff",borderRadius:10,fontSize:10,padding:"1px 5px"}}>{p.mesesSel.length}</span>}
            </button>
          ))}
        </div>
      )}

      <div style={{ background:"var(--surface2)",borderRadius:13,padding:"14px",marginBottom:14,border:`1px solid ${prop.residentData?"var(--green-border)":"var(--border)"}` }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
          <div style={{ fontSize:13,fontWeight:700,color:"var(--text2)" }}>
            🏠 {prop.residentData ? (
              <span style={{color:"var(--green)"}}><Check/> {prop.residentData.residente?.split("/")[0].trim()}</span>
            ) : `Propiedad ${propActiva+1}`}
          </div>
          {propiedades.length>1 && (
            <button type="button" onClick={()=>removeProp(propActiva)}
                    style={{background:"var(--red-bg)",border:"none",color:"var(--red)",borderRadius:7,cursor:"pointer",padding:"4px 8px",display:"flex",alignItems:"center",gap:4,fontSize:11,fontFamily:"inherit"}}>
              <Trash/> Quitar
            </button>
          )}
        </div>

        {residenteOpciones.length > 0 && !prop.residentData && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11,fontWeight:600,color:"var(--text2)",marginBottom:7 }}>Selecciona tu propiedad</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
              {residenteOpciones.map(rd => (
                <button key={rd.id} type="button" onClick={()=>selectResidentProp(propActiva,rd)}
                        style={{ padding:"7px 12px",borderRadius:8,border:"0.5px solid var(--border2)",background:"var(--surface)",color:"var(--text)",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}
                        onMouseOver={e=>e.currentTarget.style.background="var(--blue-bg)"}
                        onMouseOut={e=>e.currentTarget.style.background="var(--surface)"}>
                  {rd.calle} · L{rd.lote} Mza {rd.mza}
                </button>
              ))}
              <button type="button" onClick={()=>updateProp(propActiva,"residentData",{manual:true})}
                      style={{ padding:"7px 12px",borderRadius:8,border:"0.5px dashed var(--border2)",background:"transparent",color:"var(--text3)",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>
                + Otro domicilio
              </button>
            </div>
          </div>
        )}

        {(!prop.residentData || prop.residentData?.manual) && (
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12 }}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:"var(--text2)",marginBottom:4}}>Calle *</div>
              <select style={{...inp,cursor:"pointer"}} value={prop.calle}
                      onChange={e=>{updateProp(propActiva,"calle",e.target.value);autofillProp(propActiva,e.target.value,prop.lote,prop.mza);}}>
                <option value="">Calle...</option>
                {CALLES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:"var(--text2)",marginBottom:4}}>Casa *</div>
              <input style={inp} value={prop.lote} placeholder="Ej: 12"
                     onChange={e=>{updateProp(propActiva,"lote",e.target.value);autofillProp(propActiva,prop.calle,e.target.value,prop.mza);}}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:"var(--text2)",marginBottom:4}}>Manzana</div>
              <input style={inp} value={prop.mza} placeholder="Ej: 3"
                     onChange={e=>{updateProp(propActiva,"mza",e.target.value);autofillProp(propActiva,prop.calle,prop.lote,e.target.value);}}/>
            </div>
          </div>
        )}

        {/* ── Bloque de meses ── */}
        {prop.residentData && !prop.residentData.manual && (
          <>
            {esCritico && (
              <div style={{background:"#fff0f0",border:"1.5px solid var(--red)",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--red)",marginBottom:4}}>🚨 Situación crítica — Contactar al administrador</div>
                <div style={{fontSize:12,color:"var(--red)",lineHeight:1.6}}>
                  Contacta al administrador para conocer el detalle completo de tu adeudo y regularizar tu situación.
                </div>
              </div>
            )}
            {!esCritico && pendientes.length > 0 && (
              <div style={{background:"var(--red-bg)",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--red)",marginBottom:6}}>⚠️ Meses con adeudo detectados:</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {pendientes.map(m=><span key={m.key} style={{fontSize:11,background:"#fff",color:"var(--red)",padding:"2px 8px",borderRadius:5,fontWeight:600}}>{m.label} · ${m.cuota}</span>)}
                </div>
              </div>
            )}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--text2)",marginBottom:8}}>📅 Meses a pagar *</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {mesesHabilitados.map(op=>{
                  const sel=!!prop.mesesSel.find(m=>m.key===op.key);
                  // En crítico: solo los 3 primeros pendientes se marcan rojo; el resto normal
                  const isPend = esCritico
                    ? !!pendientesMostrar.find(p=>p.key===op.key)
                    : !!pendientes.find(p=>p.key===op.key);
                  return (
                    <button key={op.key} type="button" onClick={()=>toggleMes(propActiva,op)}
                            style={{padding:"7px 12px",borderRadius:8,fontSize:12,fontWeight:sel?700:500,cursor:"pointer",display:"flex",alignItems:"center",gap:5,border:`1.5px solid ${sel?"var(--blue)":isPend?"var(--red)":"var(--border2)"}`,background:sel?"var(--blue-bg)":isPend?"var(--red-bg)":"var(--surface)",color:sel?"var(--blue-text)":isPend?"var(--red)":"var(--text2)",fontFamily:"inherit",transition:"all 0.1s"}}>
                      {sel&&<Check/>}{op.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Selector de meses 2026 para propiedades manuales (sin residentData) */}
        {(!prop.residentData || prop.residentData?.manual) && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--text2)",marginBottom:8}}>📅 Meses a pagar (2026) *</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {opciones2026.map(op=>{
                const sel=!!prop.mesesSel.find(m=>m.key===op.key);
                return (
                  <button key={op.key} type="button" onClick={()=>toggleMes(propActiva,op)}
                          style={{padding:"7px 12px",borderRadius:8,fontSize:12,fontWeight:sel?700:500,cursor:"pointer",display:"flex",alignItems:"center",gap:5,border:`1.5px solid ${sel?"var(--blue)":"var(--border2)"}`,background:sel?"var(--blue-bg)":"var(--surface)",color:sel?"var(--blue-text)":"var(--text2)",fontFamily:"inherit",transition:"all 0.1s"}}>
                    {sel&&<Check/>}{op.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Meses seleccionados chips */}
        {prop.mesesSel.length>0&&(
          <div style={{marginBottom:14,display:"flex",flexWrap:"wrap",gap:4}}>
            {prop.mesesSel.sort((a,b)=>a.anio===b.anio?a.mes-b.mes:a.anio-b.anio).map(m=>(
              <span key={m.key} style={{fontSize:11,background:"var(--blue-bg)",color:"var(--blue-text)",padding:"3px 9px",borderRadius:6,display:"inline-flex",alignItems:"center",gap:4,fontWeight:600}}>
                {m.label}
                <button type="button" onClick={()=>toggleMes(propActiva,m)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--blue)",fontSize:12,lineHeight:1,padding:0}}>✕</button>
              </span>
            ))}
          </div>
        )}

        {/* Comprobante OBLIGATORIO */}
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"var(--text2)",marginBottom:7}}>
            📷 Comprobante de pago *{" "}
            <span style={{fontSize:10,fontWeight:500,color:"var(--red)"}}>obligatorio</span>
          </div>
          {!prop.imagePreview ? (
            <div onClick={()=>fileRefs.current[propActiva]?.click()}
                 style={{border:"1.5px dashed var(--border2)",borderRadius:10,padding:"18px",textAlign:"center",cursor:"pointer",background:"var(--surface2)",transition:"all 0.15s"}}
                 onMouseOver={e=>{e.currentTarget.style.borderColor="var(--blue)";e.currentTarget.style.background="var(--blue-bg)";}}
                 onMouseOut={e=>{e.currentTarget.style.borderColor="var(--border2)";e.currentTarget.style.background="var(--surface2)";}}
                 onDrop={e=>{e.preventDefault();handleImage(propActiva,e.dataTransfer.files[0]);}}
                 onDragOver={e=>e.preventDefault()}>
              <div style={{fontSize:24,marginBottom:5}}>📷</div>
              <div style={{fontSize:13,color:"var(--text2)",fontWeight:500,marginBottom:2}}>Toca para adjuntar tu comprobante</div>
              <div style={{fontSize:11,color:"var(--text3)"}}>JPG, PNG o PDF · Máx 5 MB</div>
              <input ref={el=>fileRefs.current[propActiva]=el} type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={e=>handleImage(propActiva,e.target.files[0])}/>
            </div>
          ) : (
            <div style={{position:"relative",borderRadius:10,overflow:"hidden",border:"0.5px solid var(--border2)"}}>
              <img src={prop.imagePreview} alt="Comprobante" style={{width:"100%",maxHeight:160,objectFit:"cover",display:"block"}}/>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.55),transparent)",display:"flex",alignItems:"flex-end",justifyContent:"space-between",padding:"8px 12px"}}>
                <span style={{fontSize:12,color:"#fff",fontWeight:600}}>✓ Comprobante adjunto</span>
                <button type="button" onClick={()=>setPropiedades(prev=>prev.map((p,i)=>i===propActiva?{...p,imagePreview:null,imageBase64:null}:p))}
                        style={{padding:"3px 9px",borderRadius:6,background:"rgba(255,255,255,0.2)",color:"#fff",border:"1px solid rgba(255,255,255,0.4)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                  Cambiar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <button type="button" onClick={addProp}
              style={{width:"100%",padding:"10px",borderRadius:10,border:"1.5px dashed var(--border2)",background:"transparent",color:"var(--blue)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:16}}
              onMouseOver={e=>{e.currentTarget.style.borderColor="var(--blue)";e.currentTarget.style.background="var(--blue-bg)";}}
              onMouseOut={e=>{e.currentTarget.style.borderColor="var(--border2)";e.currentTarget.style.background="transparent";}}>
        + Agregar otra propiedad
      </button>

      <div style={{display:"flex",gap:10}}>
        <button type="button" onClick={onBack} style={{flex:"0 0 auto",padding:"12px 20px",borderRadius:11,border:"0.5px solid var(--border2)",background:"var(--surface)",color:"var(--text2)",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>← Atrás</button>
        <button type="button" onClick={onNext} style={{flex:1,padding:"12px",borderRadius:11,border:"none",background:"var(--blue)",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 14px rgba(24,95,165,0.25)"}}>Revisar y enviar →</button>
      </div>
    </div>
  );
}

// ── Paso 3: Revisión y envío ───────────────────────────────────
function Paso3({ form, propiedades, monto, notas, setMonto, setNotas, onSubmit, onBack, loading, error }) {
  const totalEnvios = propiedades.reduce((s,p)=>s+(p.calle&&p.lote?p.mesesSel.length:0),0);
  const propsValidas = propiedades.filter(p=>p.calle&&p.lote&&p.mesesSel.length>0);
  const inp = {width:"100%",padding:"10px 12px",borderRadius:10,border:"0.5px solid var(--border2)",fontSize:14,background:"var(--surface)",color:"var(--text)",outline:"none",fontFamily:"inherit",boxSizing:"border-box"};

  return (
    <div>
      {error && <div style={{background:"var(--red-bg)",color:"var(--red)",borderRadius:9,padding:"10px 13px",fontSize:13,marginBottom:14,display:"flex",gap:8}}><span>⚠️</span>{error}</div>}

      <div style={{background:"var(--surface2)",borderRadius:13,padding:"14px",marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--text2)",marginBottom:10}}>📋 Resumen de tu pago</div>
        <div style={{fontSize:13,marginBottom:6}}><strong>{form.nombre}</strong> · {form.telefono}</div>
        {propsValidas.map((p,i)=>(
          <div key={p.id} style={{background:"var(--surface)",borderRadius:9,padding:"10px 12px",marginBottom:8,border:"0.5px solid var(--border)"}}>
            <div style={{fontWeight:600,fontSize:12,color:"var(--text2)",marginBottom:5}}>🏠 {p.calle} · L{p.lote}{p.mza?` Mza ${p.mza}`:""}</div>
            {p.mesesSel.sort((a,b)=>a.anio===b.anio?a.mes-b.mes:a.anio-b.anio).map(m=>(
              <div key={m.key} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"2px 0"}}>
                <span>{m.label}</span>
                <span style={{fontWeight:600}}>${Number(monto||0).toLocaleString()}</span>
              </div>
            ))}
            {!p.imageBase64&&<div style={{fontSize:11,color:"var(--red)",marginTop:4}}>⚠️ Sin comprobante adjunto</div>}
          </div>
        ))}
        {totalEnvios>1&&monto&&(
          <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:14,borderTop:"0.5px solid var(--border)",paddingTop:8,marginTop:4,color:"var(--blue)"}}>
            <span>Total</span><span>${(Number(monto)*totalEnvios).toLocaleString()} MXN</span>
          </div>
        )}
      </div>

      <div style={{marginBottom:14}}>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:"var(--text2)",marginBottom:7}}>💰 Monto pagado por mes (MXN) *</label>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--text3)",fontSize:15,fontWeight:500}}>$</span>
          <input style={{...inp,paddingLeft:26}} type="number" min="1" step="1" value={monto} onChange={e=>setMonto(e.target.value)} placeholder="400" autoFocus/>
        </div>
      </div>

      <div style={{marginBottom:20}}>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:"var(--text2)",marginBottom:7}}>📝 Notas adicionales (opcional)</label>
        <textarea style={{...inp,resize:"none",height:64}} value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Ej: Pago en efectivo, referencia del banco..."/>
      </div>

      <div style={{display:"flex",gap:10}}>
        <button type="button" onClick={onBack} style={{flex:"0 0 auto",padding:"12px 20px",borderRadius:11,border:"0.5px solid var(--border2)",background:"var(--surface)",color:"var(--text2)",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>← Atrás</button>
        <button type="button" onClick={onSubmit} disabled={loading}
                style={{flex:1,padding:"13px",borderRadius:11,border:"none",background:loading?"var(--surface2)":"var(--blue)",color:loading?"var(--text3)":"#fff",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:loading?"none":"0 4px 14px rgba(24,95,165,0.25)"}}>
          {loading?"Enviando...":totalEnvios===0?"Selecciona meses para continuar":`Enviar pago${totalEnvios>1?` · ${totalEnvios} registros`:""}`}
        </button>
      </div>
    </div>
  );
}

// ── App principal ──────────────────────────────────────────────
export default function App() {
  const draft = loadDraft();
  const [pasoActual, setPasoActual] = useState(1);
  const [step, setStep]             = useState("form");
  const [form, setForm]             = useState(draft?.form || { nombre:"", telefono:"" });
  const [propiedades, setPropiedades] = useState(draft?.propiedades || [emptyProp()]);
  const [monto, setMonto]           = useState(draft?.monto || "400");
  const [notas, setNotas]           = useState(draft?.notas || "");
  const [residenteOpciones, setResidenteOpciones] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  const searchTimer = useRef(null);
  const setF = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(() => { saveDraft({ form, propiedades, monto, notas }); }, [form, propiedades, monto, notas]);

  const handleNombreChange = (v) => {
    setF("nombre",v);
    clearTimeout(searchTimer.current);
    if(v.length<3){setSearchResults([]);return;}
    setSearching(true);
    searchTimer.current = setTimeout(async()=>{
      try{const{data}=await axios.get(`${API}/api/residents/search?q=${encodeURIComponent(v)}`);setSearchResults(data);}
      catch{setSearchResults([]);}finally{setSearching(false);}
    },400);
  };

  const onSelectResident = async (r) => {
    setSearchResults([]);
    setF("nombre", r.residente.split("/")[0].trim());

    try {
      const params=new URLSearchParams({calle:r.calle,lote:r.lote});
      if(r.mza) params.set("mza",r.mza);
      const{data:full}=await axios.get(`${API}/api/residents/by-location?${params}`);
      const rd = full || r;

      if(rd.telefono && !form.telefono) setF("telefono", rd.telefono);

      try {
        const{data:todos}=await axios.get(`${API}/api/residents/search?q=${encodeURIComponent(r.residente.split("/")[0].trim())}`);
        if(todos.length>1){
          const completos = await Promise.all(todos.map(async t=>{
            try{const p=new URLSearchParams({calle:t.calle,lote:t.lote});if(t.mza)p.set("mza",t.mza);const{data:d}=await axios.get(`${API}/api/residents/by-location?${p}`);return d||t;}catch{return t;}
          }));
          setResidenteOpciones(completos);
        } else {
          setResidenteOpciones([]);
        }
      } catch {}

      setPropiedades(prev=>prev.map((p,i)=>i===0?{...p,calle:rd.calle,lote:rd.lote,mza:rd.mza||"",resident_id:rd.id,residentData:rd}:p));
    } catch {
      setF("nombre", r.residente.split("/")[0].trim());
    }
  };

  const validarPaso1 = () => {
    if(!form.nombre.trim()) return setError("Escribe tu nombre completo"), false;
    if(!form.telefono.trim()) return setError("Escribe tu número de WhatsApp"), false;
    setError(""); return true;
  };

  const validarPaso2 = () => {
    const propsValidas = propiedades.filter(p=>p.calle&&p.lote);
    if(propsValidas.length===0) return setError("Agrega al menos una propiedad con calle y número de casa"), false;
    for(const p of propsValidas){
      if(p.mesesSel.length===0) return setError(`Selecciona al menos un mes para ${p.calle||"tu propiedad"}`), false;
      if(!p.imageBase64) return setError(`El comprobante de pago es obligatorio para ${p.calle} L${p.lote}`), false;
    }
    setError(""); return true;
  };

  const validarPaso3 = () => {
    if(!monto||Number(monto)<=0) return setError("Indica el monto pagado por mes"), false;
    setError(""); return true;
  };

  const handleNext = () => {
    if(pasoActual===1 && validarPaso1()) { setError(""); setPasoActual(2); }
    if(pasoActual===2 && validarPaso2()) { setError(""); setPasoActual(3); }
  };

  const handleSubmit = async () => {
    if(!validarPaso3()) return;
    setLoading(true);
    const propsValidas = propiedades.filter(p=>p.calle&&p.lote&&p.mesesSel.length>0);
    try {
      await Promise.all(
        propsValidas.flatMap(prop =>
          prop.mesesSel.map(op =>
            axios.post(`${API}/api/payments/submit`,{
              resident_id:     prop.resident_id||null,
              nombre:          form.nombre.trim(),
              telefono:        form.telefono.trim(),
              calle:           prop.calle,
              lote:            prop.lote.trim(),
              mza:             prop.mza.trim(),
              mes:             op.mes,
              anio:            op.anio,
              monto:           Number(monto),
              comprobante_b64: prop.imageBase64||null,
              notas:           notas.trim()||null,
            })
          )
        )
      );
      clearDraft();
      setStep("success");
    } catch { setError("Hubo un problema al enviar. Intenta de nuevo."); }
    finally { setLoading(false); }
  };

  const reset = () => {
    clearDraft();
    setStep("form"); setPasoActual(1);
    setForm({nombre:"",telefono:""});
    setPropiedades([emptyProp()]);
    setMonto("400"); setNotas("");
    setResidenteOpciones([]); setError("");
  };

  const propsValidas = propiedades.filter(p=>p.calle&&p.lote&&p.mesesSel.length>0);

  if(step==="success") return (
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
      <div style={{background:"var(--surface)",border:"0.5px solid var(--border)",borderRadius:20,width:"100%",maxWidth:420,padding:"2.5rem 2rem",textAlign:"center",boxShadow:"0 4px 24px rgba(0,0,0,0.08)"}}>
        <div style={{width:72,height:72,borderRadius:"50%",background:"var(--green-bg)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:32}}>✅</div>
        <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>¡Pago registrado!</div>
        <p style={{fontSize:13,color:"var(--text2)",lineHeight:1.7,marginBottom:12}}>
          Tu comprobante fue enviado a la administración.<br/>
          Recibirás confirmación por WhatsApp al <strong>{form.telefono}</strong>.
        </p>
        <div style={{background:"var(--green-bg)",borderRadius:10,padding:"12px 14px",marginBottom:20,textAlign:"left",border:"1px solid var(--green-border)"}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--green)",marginBottom:4}}>✅ ¿Y ahora qué sigue?</div>
          <div style={{fontSize:12,color:"var(--green)"}}>
            Recibirás tu comprobante de pago aprobado a más tardar el <strong>día 12 del mes</strong>.
          </div>
        </div>
        <div style={{background:"var(--surface2)",borderRadius:10,padding:"12px 14px",marginBottom:20,textAlign:"left"}}>
          {propsValidas.map(prop=>(
            <div key={prop.id} style={{marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--text2)",marginBottom:4}}>📍 {prop.calle} · L{prop.lote}</div>
              {prop.mesesSel.sort((a,b)=>a.anio===b.anio?a.mes-b.mes:a.anio-b.anio).map(m=>(
                <div key={m.key} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"2px 0 2px 10px"}}>
                  <span>{m.label}</span><span style={{fontWeight:600}}>${Number(monto).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{borderTop:"0.5px solid var(--border)",marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:13,color:"var(--blue)"}}>
            <span>Total</span><span>${(Number(monto)*propsValidas.reduce((s,p)=>s+p.mesesSel.length,0)).toLocaleString()} MXN</span>
          </div>
        </div>
        <button onClick={reset} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:"var(--blue)",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          Registrar otro pago
        </button>
      </div>
    </div>
  );

  const pasos = ["Tus datos","Propiedades","Confirmar"];
  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",padding:"1.5rem 1rem 5rem"}}>
      <div style={{width:"100%",maxWidth:500,marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <div style={{width:38,height:38,borderRadius:10,background:"var(--blue)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="19" height="19"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div>
            <div style={{fontSize:16,fontWeight:700}}>Fraccionamiento</div>
            <div style={{fontSize:11,color:"var(--text3)"}}>Registro de cuotas mensuales</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:0}}>
          {pasos.map((p,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",flex:i<pasos.length-1?1:"initial"}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0,
                  background:i+1<pasoActual?"var(--green)":i+1===pasoActual?"var(--blue)":"var(--surface2)",
                  color:i+1<=pasoActual?"#fff":"var(--text3)",
                  border:i+1===pasoActual?"2px solid var(--blue)":"2px solid transparent"}}>
                  {i+1<pasoActual?"✓":i+1}
                </div>
                <div style={{fontSize:9,fontWeight:600,color:i+1===pasoActual?"var(--blue)":"var(--text3)",whiteSpace:"nowrap"}}>{p}</div>
              </div>
              {i<pasos.length-1&&<div style={{flex:1,height:2,background:i+1<pasoActual?"var(--green)":"var(--surface2)",margin:"0 4px",marginBottom:14}}/>}
            </div>
          ))}
        </div>
      </div>

      <div style={{width:"100%",maxWidth:500}}>
        <div style={{background:"var(--surface)",border:"0.5px solid var(--border)",borderRadius:16,padding:"20px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
          {pasoActual===1&&(
            <Paso1 form={form} setF={(k,v)=>{if(k==="nombre")handleNombreChange(v);else setF(k,v);}}
                   searchResults={searchResults} searching={searching}
                   onSelectResident={onSelectResident} onNext={handleNext} error={error}/>
          )}
          {pasoActual===2&&(
            <Paso2 propiedades={propiedades} setPropiedades={setPropiedades}
                   residenteOpciones={residenteOpciones} form={form}
                   onNext={handleNext} onBack={()=>{setError("");setPasoActual(1);}} error={error}/>
          )}
          {pasoActual===3&&(
            <Paso3 form={form} propiedades={propsValidas} monto={monto} notas={notas}
                   setMonto={setMonto} setNotas={setNotas}
                   onSubmit={handleSubmit} onBack={()=>{setError("");setPasoActual(2);}}
                   loading={loading} error={error}/>
          )}
        </div>
      </div>
    </div>
  );
}