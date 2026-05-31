import { useEffect, useState } from "react";
import api from "../lib/api";
import { fmtMXN } from "../lib/helpers";
import { useNavigate } from "react-router-dom";

function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="bar-row">
      <div className="bar-label">
        <span>{label}</span>
        <span style={{ color }}>{fmtMXN(value)}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width:`${pct}%`, background:color }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data,    setData]    = useState(null);
  const [morosos, setMorosos] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get("/api/admin/dashboard"),
      api.get("/api/admin/morosos"),
    ]).then(([d, m]) => {
      setData(d.data);
      setMorosos(m.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty"><div className="icon">📊</div><p>Cargando datos...</p></div>;
  if (!data) return (
    <div style={{ padding:"2rem" }}>
      <div className="empty">
        <div className="icon">📊</div>
        <p>Aún no hay datos cargados.<br/>Importa tu Excel para ver el resumen.</p>
        <button className="btn primary" onClick={() => navigate("/carga")}>Cargar datos →</button>
      </div>
    </div>
  );

  const pct      = data.totalResidentes ? Math.round(data.morosos / data.totalResidentes * 100) : 0;
  const top5     = [...morosos].sort((a,b) => b.deuda - a.deuda).slice(0, 5);
  const calles   = [...new Set(morosos.map(r => r.calle))].sort();
  const deudaCalle = calles.map(c => ({
    calle: c,
    total: morosos.filter(r => r.calle === c).reduce((s,r) => s + Number(r.deuda), 0),
  })).sort((a,b) => b.total - a.total);
  const maxDeuda = deudaCalle[0]?.total || 1;

  const balanceMes   = data.balanceMes   || 0;
  const balanceTotal = data.balanceTotal || 0;

  return (
    <div style={{ padding:"2rem", flex:1 }}>
      <div className="page-title">Resumen general</div>
      <div className="page-sub">
        {data.totalResidentes} residentes · {data.morosos} morosos ({pct}%) · Deuda {fmtMXN(data.totalDeuda)}
      </div>

      {/* ── Fila 1: Residentes ── */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
        <div style={{ fontSize:12,fontWeight:600,color:"var(--text2)",textTransform:"uppercase",letterSpacing:"0.06em" }}>Residentes</div>
        <div style={{ flex:1, height:1, background:"var(--border)" }}/>
      </div>
      <div className="metrics" style={{ marginBottom:"1.5rem" }}>
        <div className="metric blue"><label>Total</label><div className="val">{data.totalResidentes}</div></div>
        <div className="metric green"><label>Al corriente</label><div className="val">{data.alCorriente}</div></div>
        <div className="metric red"><label>Morosos</label><div className="val">{data.morosos}</div><div className="sub">{pct}%</div></div>
        <div className="metric amber"><label>Deuda acumulada</label><div className="val" style={{ fontSize:18 }}>{fmtMXN(data.totalDeuda)}</div></div>
      </div>

      {/* ── Fila 2: Finanzas del mes ── */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
        <div style={{ fontSize:12,fontWeight:600,color:"var(--text2)",textTransform:"uppercase",letterSpacing:"0.06em" }}>
          Finanzas — {data.mesActual || "Este mes"}
        </div>
        <div style={{ flex:1, height:1, background:"var(--border)" }}/>
        <button onClick={() => navigate("/finanzas")} style={{ fontSize:12,color:"var(--blue)",background:"none",border:"none",cursor:"pointer",padding:0 }}>
          Ver todo →
        </button>
      </div>
      <div className="metrics" style={{ marginBottom:"1.5rem" }}>
        <div className="metric green">
          <label>Ingresos del mes</label>
          <div className="val" style={{ fontSize:18 }}>{fmtMXN(data.ingresosMes)}</div>
        </div>
        <div className="metric red">
          <label>Gastos del mes</label>
          <div className="val" style={{ fontSize:18 }}>{fmtMXN(data.gastosMes)}</div>
        </div>
        <div className={`metric ${balanceMes >= 0 ? "blue" : "red"}`}>
          <label>Balance del mes</label>
          <div className="val" style={{ fontSize:18 }}>{fmtMXN(Math.abs(balanceMes))}</div>
          <div className="sub">{balanceMes >= 0 ? "Superávit" : "Déficit"}</div>
        </div>
        <div className={`metric ${balanceTotal >= 0 ? "blue" : "red"}`}>
          <label>Balance histórico</label>
          <div className="val" style={{ fontSize:18 }}>{fmtMXN(Math.abs(balanceTotal))}</div>
          <div className="sub">{balanceTotal >= 0 ? "Superávit total" : "Déficit total"}</div>
        </div>
      </div>

      {/* ── Fila 3: Pagos ── */}
      {data.pagosPendientes > 0 && (
        <>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <div style={{ fontSize:12,fontWeight:600,color:"var(--text2)",textTransform:"uppercase",letterSpacing:"0.06em" }}>Pagos</div>
            <div style={{ flex:1, height:1, background:"var(--border)" }}/>
          </div>
          <div className="metrics" style={{ marginBottom:"1.5rem" }}>
            <div className="metric amber">
              <label>Por revisar</label>
              <div className="val">{data.pagosPendientes}</div>
              <div className="sub">Comprobantes pendientes</div>
            </div>
            <div className="metric green">
              <label>Total recaudado</label>
              <div className="val" style={{ fontSize:18 }}>{fmtMXN(data.totalRecaudado)}</div>
              <div className="sub">Pagos aprobados</div>
            </div>
          </div>
        </>
      )}

      {/* ── Gráficas ── */}
      <div className="two-col">
        <div className="card">
          <div className="card-header"><h3>Deuda por calle</h3></div>
          <div className="card-body">
            {deudaCalle.length === 0
              ? <p style={{ color:"var(--text3)",fontSize:13 }}>Sin morosos</p>
              : deudaCalle.map(({ calle, total }) => (
                <MiniBar key={calle} label={calle} value={total} max={maxDeuda} color="var(--blue)" />
              ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Top morosos</h3>
            {morosos.length > 0 && (
              <button onClick={() => navigate("/morosos")} style={{ fontSize:12,color:"var(--blue)",background:"none",border:"none",cursor:"pointer" }}>
                Ver todos →
              </button>
            )}
          </div>
          <div style={{ overflow:"hidden" }}>
            {top5.length === 0 ? (
              <div style={{ padding:"2rem",textAlign:"center",color:"var(--text2)",fontSize:13 }}>🎉 Sin morosos</div>
            ) : (
              <table>
                <thead>
                  <tr><th>Residente</th><th>Calle</th><th style={{ textAlign:"right" }}>Deuda</th></tr>
                </thead>
                <tbody>
                  {top5.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight:500,fontSize:13 }}>{r.residente.split("/")[0].trim()}</td>
                      <td style={{ color:"var(--text2)",fontSize:12 }}>{r.calle}</td>
                      <td className="right" style={{ fontWeight:600,color:"var(--red)" }}>{fmtMXN(r.deuda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Aviso pagos pendientes */}
      {data.pagosPendientes > 0 && (
        <div className="alert amber" style={{ display:"flex",alignItems:"center",gap:12,marginTop:"1rem" }}>
          <span style={{ fontSize:20 }}>📋</span>
          <div>
            Tienes <strong>{data.pagosPendientes}</strong> pago{data.pagosPendientes>1?"s":""} pendiente{data.pagosPendientes>1?"s":""} de revisar.{" "}
            <button onClick={() => navigate("/pagos")} style={{ color:"var(--amber)",fontWeight:600,background:"none",border:"none",cursor:"pointer",textDecoration:"underline",fontSize:13 }}>
              Ir a Pagos →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
