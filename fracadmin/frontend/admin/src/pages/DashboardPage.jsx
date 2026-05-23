import { useEffect, useState } from "react";
import api from "../lib/api";
import { fmtMXN } from "../lib/helpers";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const [data, setData] = useState(null);
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
    <div style={{ padding: "2rem" }}>
      <div className="empty">
        <div className="icon">📊</div>
        <p>Aún no hay datos cargados.<br />Importa tu Excel para ver el resumen del fraccionamiento.</p>
        <button className="btn primary" onClick={() => navigate("/carga")}>Cargar datos →</button>
      </div>
    </div>
  );

  // Deuda por calle
  const calles = [...new Set(morosos.map(r => r.calle))].sort();
  const deudaPorCalle = calles.map(c => ({
    calle: c,
    total: morosos.filter(r => r.calle === c).reduce((s, r) => s + Number(r.deuda), 0),
  })).sort((a, b) => b.total - a.total);
  const maxDeuda = deudaPorCalle[0]?.total || 1;

  // Top 5 morosos
  const top5 = [...morosos].sort((a, b) => b.deuda - a.deuda).slice(0, 5);

  const pct = data.totalResidentes ? Math.round(data.morosos / data.totalResidentes * 100) : 0;

  return (
    <div style={{ padding: "2rem", flex: 1 }}>
      <div className="page-title">Resumen general</div>
      <div className="page-sub">
        {data.totalResidentes} residentes · {data.morosos} morosos ({pct}%) · Deuda total {fmtMXN(data.totalDeuda)}
      </div>

      <div className="metrics">
        <div className="metric blue">
          <label>Total residentes</label>
          <div className="val">{data.totalResidentes}</div>
        </div>
        <div className="metric red">
          <label>Morosos</label>
          <div className="val">{data.morosos}</div>
          <div className="sub">{pct}% del total</div>
        </div>
        <div className="metric green">
          <label>Al corriente</label>
          <div className="val">{data.alCorriente}</div>
        </div>
        <div className="metric amber">
          <label>Deuda total</label>
          <div className="val" style={{ fontSize: 20 }}>{fmtMXN(data.totalDeuda)}</div>
        </div>
        <div className="metric green">
          <label>Recaudado</label>
          <div className="val" style={{ fontSize: 20 }}>{fmtMXN(data.totalRecaudado)}</div>
          <div className="sub">Pagos aprobados</div>
        </div>
        {data.pagosPendientes > 0 && (
          <div className="metric amber">
            <label>Pagos por revisar</label>
            <div className="val">{data.pagosPendientes}</div>
            <div className="sub">Pendientes de aprobación</div>
          </div>
        )}
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-header"><h3>Deuda por calle</h3></div>
          <div className="card-body">
            {deudaPorCalle.map(({ calle, total }) => (
              <div className="bar-row" key={calle}>
                <div className="bar-label">
                  <span>{calle}</span>
                  <span>{fmtMXN(total)}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(total / maxDeuda) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Top morosos</h3></div>
          <div style={{ overflow: "hidden", borderRadius: "0 0 12px 12px" }}>
            {top5.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text2)", fontSize: 13 }}>
                🎉 Sin morosos
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Residente</th>
                    <th>Calle</th>
                    <th style={{ textAlign: "right" }}>Deuda</th>
                  </tr>
                </thead>
                <tbody>
                  {top5.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500 }}>{r.residente.split("/")[0].trim()}</td>
                      <td style={{ color: "var(--text2)" }}>{r.calle}</td>
                      <td className="right" style={{ fontWeight: 600, color: "var(--red)" }}>{fmtMXN(r.deuda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {data.pagosPendientes > 0 && (
        <div className="alert amber" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>📋</span>
          <div>
            Tienes <strong>{data.pagosPendientes}</strong> pago{data.pagosPendientes > 1 ? "s" : ""} pendiente{data.pagosPendientes > 1 ? "s" : ""} de revisar.{" "}
            <button onClick={() => navigate("/pagos")} style={{ color: "var(--amber)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}>
              Ir a Pagos →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
