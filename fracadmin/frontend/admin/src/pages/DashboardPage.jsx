import { useEffect, useState } from "react";
import api from "../lib/api";
import { fmtMXN } from "../lib/helpers";

function MetricCard({ label, value, sub, color }) {
  const colors = {
    blue:  { bg: "var(--blue-bg)",  val: "var(--blue)" },
    red:   { bg: "var(--red-bg)",   val: "var(--red)" },
    green: { bg: "var(--green-bg)", val: "var(--green)" },
    amber: { bg: "var(--amber-bg)", val: "var(--amber)" },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className="rounded-xl p-4" style={{ background: c.bg }}>
      <p className="text-xs mb-1" style={{ color: "var(--text2)" }}>{label}</p>
      <p className="text-3xl font-semibold" style={{ color: c.val }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/admin/dashboard")
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Cargando métricas...</div>;
  if (!data)   return <div className="p-8 text-red-500">Error al cargar datos</div>;

  const pct = data.totalResidentes ? Math.round(data.morosos / data.totalResidentes * 100) : 0;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text2)" }}>
        Resumen general del fraccionamiento
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <MetricCard label="Total residentes" value={data.totalResidentes} color="blue" />
        <MetricCard label="Morosos" value={data.morosos} sub={`${pct}% del total`} color="red" />
        <MetricCard label="Al corriente" value={data.alCorriente} color="green" />
        <MetricCard label="Deuda total" value={fmtMXN(data.totalDeuda)} sub="MXN acumulado" color="amber" />
        <MetricCard label="Total recaudado" value={fmtMXN(data.totalRecaudado)} sub="Pagos aprobados" color="green" />
        <MetricCard label="Pagos pendientes" value={data.pagosPendientes} sub="Por revisar" color="amber" />
      </div>

      {data.pagosPendientes > 0 && (
        <div className="rounded-xl border p-5 flex items-center gap-4"
             style={{ background: "var(--amber-bg)", borderColor: "#F6D7A3" }}>
          <span className="text-2xl">📋</span>
          <div>
            <p className="font-medium text-sm" style={{ color: "var(--amber)" }}>
              Tienes {data.pagosPendientes} pago{data.pagosPendientes > 1 ? "s" : ""} pendiente{data.pagosPendientes > 1 ? "s" : ""} de revisar
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>
              Ve a la sección <strong>Pagos</strong> para aprobar o rechazar cada comprobante.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
