import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { MESES_FULL, fmtMXN } from "../lib/helpers";

const STATUS_TABS = [
  { key: "pendiente", label: "Pendientes" },
  { key: "aprobado",  label: "Aprobados" },
  { key: "rechazado", label: "Rechazados" },
];

const STATUS_BADGE = {
  pendiente: "bg-amber-100 text-amber-700",
  aprobado:  "bg-green-100 text-green-700",
  rechazado: "bg-red-100 text-red-700",
};

export default function PagosPage() {
  const [tab, setTab]         = useState("pendiente");
  const [pagos, setPagos]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // { id, nombre }
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast]     = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/api/payments?status=${tab}&limit=100`)
      .then(r => { setPagos(r.data.data); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    setActionId(id);
    try {
      await api.patch(`/api/payments/${id}/approve`);
      showToast("✓ Pago aprobado y notificación enviada por WhatsApp");
      load();
    } catch (err) {
      showToast(err.response?.data?.error || "Error al aprobar", false);
    } finally {
      setActionId(null);
    }
  };

  const openReject = (pago) => {
    setRejectModal({ id: pago.id, nombre: pago.nombre });
    setRejectReason("");
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) return;
    setActionId(rejectModal.id);
    try {
      await api.patch(`/api/payments/${rejectModal.id}/reject`, { reason: rejectReason });
      showToast("Pago rechazado. Se notificó al residente.");
      setRejectModal(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || "Error al rechazar", false);
    } finally {
      setActionId(null);
    }
  };

  const mesLabel = (mes, anio) => {
    const m = Number(mes);
    return `${MESES_FULL[m - 1] || mes} ${anio}`;
  };

  return (
    <div className="p-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg
          ${toast.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {toast.msg}
        </div>
      )}

      <h1 className="text-2xl font-semibold mb-1">Revisión de Pagos</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text2)" }}>
        Comprobantes enviados por residentes · Aprueba o rechaza cada uno
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${tab === t.key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400 py-8">Cargando...</div>
      ) : pagos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">
            {tab === "pendiente" ? "🎉" : tab === "aprobado" ? "✅" : "❌"}
          </p>
          <p className="font-medium text-gray-500">
            {tab === "pendiente" ? "No hay pagos pendientes de revisar" :
             tab === "aprobado"  ? "Aún no hay pagos aprobados" :
             "No hay pagos rechazados"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor: "var(--border)" }}>
            <span className="text-sm font-medium">{total} resultado{total !== 1 ? "s" : ""}</span>
          </div>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Residente</th>
                  <th>Calle / Lote</th>
                  <th>Mes</th>
                  <th className="text-right">Monto</th>
                  <th>Comprobante</th>
                  <th>Estado</th>
                  {tab === "pendiente" && <th>Acciones</th>}
                  {tab === "rechazado" && <th>Motivo</th>}
                </tr>
              </thead>
              <tbody>
                {pagos.map(p => (
                  <tr key={p.id}>
                    <td className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(p.created_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td>
                      <div className="font-medium text-sm">{p.nombre}</div>
                      {p.telefono && <div className="text-xs text-gray-400">{p.telefono}</div>}
                    </td>
                    <td className="text-sm text-gray-500">
                      {p.calle} · L{p.lote}{p.mza ? ` Mza ${p.mza}` : ""}
                    </td>
                    <td className="text-sm whitespace-nowrap">{mesLabel(p.mes, p.anio)}</td>
                    <td className="text-right font-semibold" style={{ color: "var(--blue)" }}>
                      {fmtMXN(p.monto)}
                    </td>
                    <td>
                      {p.comprobante_url
                        ? <a href={p.comprobante_url} target="_blank" rel="noreferrer"
                             className="text-blue-600 text-sm hover:underline">Ver 🖼</a>
                        : <span className="text-gray-300 text-sm">—</span>
                      }
                    </td>
                    <td>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[p.status]}`}>
                        {p.status === "pendiente" ? "Pendiente" :
                         p.status === "aprobado"  ? "Aprobado" : "Rechazado"}
                      </span>
                    </td>
                    {tab === "pendiente" && (
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => approve(p.id)}
                            disabled={actionId === p.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity disabled:opacity-50"
                            style={{ background: "var(--green)" }}
                          >
                            {actionId === p.id ? "..." : "✓ Aprobar"}
                          </button>
                          <button
                            onClick={() => openReject(p)}
                            disabled={actionId === p.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50"
                            style={{ background: "var(--red-bg)", color: "var(--red)" }}
                          >
                            ✗ Rechazar
                          </button>
                        </div>
                      </td>
                    )}
                    {tab === "rechazado" && (
                      <td className="text-xs text-gray-400 max-w-xs truncate">
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

      {/* Modal de rechazo */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-semibold text-lg mb-1">Rechazar pago</h3>
            <p className="text-sm text-gray-500 mb-4">
              Indica el motivo para <strong>{rejectModal.nombre}</strong>.
              Se enviará una notificación por WhatsApp.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Ej: El comprobante está borroso, no se puede verificar el monto..."
              className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-400 resize-none"
              style={{ borderColor: "var(--border2)" }}
              rows={3}
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectModal(null)}
                      className="flex-1 py-2 rounded-xl border text-sm font-medium text-gray-600"
                      style={{ borderColor: "var(--border2)" }}>
                Cancelar
              </button>
              <button onClick={confirmReject}
                      disabled={!rejectReason.trim() || actionId === rejectModal.id}
                      className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                      style={{ background: "var(--red)" }}>
                {actionId === rejectModal.id ? "Enviando..." : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
