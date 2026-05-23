import { useEffect, useState } from "react";
import api from "../lib/api";
import { fmtMXN, MESES_FULL } from "../lib/helpers";

export default function MorososPage() {
  const [morosos, setMorosos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);
  const [toast, setToast]    = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    api.get("/api/admin/morosos")
      .then(r => setMorosos(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const notificar = async (r) => {
    if (!r.telefono) {
      showToast("Este residente no tiene teléfono registrado", false);
      return;
    }
    setSending(r.id);
    try {
      await api.post("/api/admin/notify-moroso", { residentId: r.id });
      showToast(`✓ Notificación enviada a ${r.residente.split("/")[0].trim()}`);
    } catch (err) {
      showToast(err.response?.data?.error || "Error al enviar notificación", false);
    } finally {
      setSending(null);
    }
  };

  const descargarPDF = async () => {
    const { jsPDF } = await import("jspdf");
    await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const fecha = new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    const totalDeuda = morosos.reduce((s, r) => s + Number(r.deuda), 0);

    doc.setFillColor(24, 95, 165);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text("FracAdmin — Reporte de Morosos", 14, 12);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Generado el ${fecha}`, 14, 20);
    doc.text(`${morosos.length} deudores · Deuda total: $${totalDeuda.toLocaleString()} MXN`, 14, 25);

    const calles = [...new Set(morosos.map(r => r.calle))].sort();
    let startY = 36;

    calles.forEach(calle => {
      const lista = morosos.filter(r => r.calle === calle);
      const totalCalle = lista.reduce((s, r) => s + Number(r.deuda), 0);

      doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.setTextColor(24, 95, 165);
      doc.text(`Calle ${calle}  ·  ${lista.length} morosos  ·  $${totalCalle.toLocaleString()} MXN`, 14, startY);
      startY += 2;

      doc.autoTable({
        startY: startY + 2,
        head: [["Residente", "Lote / Mza", "Teléfono", "Deuda"]],
        body: lista.map(r => [
          r.residente.split("/")[0].trim(),
          `L${r.lote} / Mza ${r.mza}`,
          r.telefono || "—",
          `$${Number(r.deuda).toLocaleString()}`,
        ]),
        theme: "grid",
        headStyles: { fillColor: [230, 241, 251], textColor: [12, 68, 124], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 3: { halign: "right", textColor: [163, 45, 45], fontStyle: "bold" } },
        margin: { left: 14, right: 14 },
      });
      startY = doc.lastAutoTable.finalY + 8;
    });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(160, 160, 155); doc.setFont("helvetica", "normal");
      doc.text(`FracAdmin · ${fecha}`, 14, 292);
      doc.text(`Página ${i} de ${pages}`, 196, 292, { align: "right" });
    }

    doc.save(`reporte_morosos_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast("✓ PDF descargado");
  };

  const byStreet = [...new Set(morosos.map(r => r.calle))].sort();

  return (
    <div className="p-8">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg
          ${toast.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Morosos</h1>
          <p className="text-sm" style={{ color: "var(--text2)" }}>
            Residentes con pagos pendientes · Notificación directa por WhatsApp
          </p>
        </div>
        {morosos.length > 0 && (
          <button onClick={descargarPDF}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ background: "var(--blue)" }}>
            ↓ Descargar PDF
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-gray-400">Cargando...</div>
      ) : morosos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">🎉</p>
          <p className="font-medium">¡Sin morosos! Todos los residentes están al corriente.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl p-4" style={{ background: "var(--red-bg)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--text2)" }}>Morosos graves</p>
              <p className="text-3xl font-semibold" style={{ color: "var(--red)" }}>
                {morosos.filter(r => r.deuda > 700).length}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>Más de $700</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "var(--amber-bg)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--text2)" }}>Deuda leve</p>
              <p className="text-3xl font-semibold" style={{ color: "var(--amber)" }}>
                {morosos.filter(r => r.deuda <= 700).length}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>Hasta $700</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "var(--red-bg)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--text2)" }}>Deuda total</p>
              <p className="text-3xl font-semibold" style={{ color: "var(--red)" }}>
                {fmtMXN(morosos.reduce((s, r) => s + Number(r.deuda), 0))}
              </p>
            </div>
          </div>

          {byStreet.map(calle => {
            const lista = morosos.filter(r => r.calle === calle).sort((a, b) => b.deuda - a.deuda);
            return (
              <div key={calle} className="bg-white rounded-2xl border overflow-hidden mb-4"
                   style={{ borderColor: "var(--border)" }}>
                <div className="px-4 py-3 border-b flex justify-between items-center"
                     style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
                  <span className="font-medium text-sm">Calle {calle}</span>
                  <span className="text-xs text-gray-400">
                    {lista.length} morosos · {fmtMXN(lista.reduce((s, r) => s + Number(r.deuda), 0))}
                  </span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Residente</th>
                      <th>Lote</th>
                      <th>Estado</th>
                      <th className="text-right">Deuda</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map(r => (
                      <tr key={r.id}>
                        <td className="font-medium text-sm">{r.residente.split("/")[0].trim()}</td>
                        <td className="text-sm text-gray-400">L{r.lote}</td>
                        <td>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium
                            ${r.deuda > 700 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            {r.deuda > 700 ? "Moroso" : "Deuda leve"}
                          </span>
                        </td>
                        <td className="text-right font-semibold text-sm" style={{ color: "var(--red)" }}>
                          {fmtMXN(r.deuda)}
                        </td>
                        <td>
                          <button
                            onClick={() => notificar(r)}
                            disabled={sending === r.id || !r.telefono}
                            title={!r.telefono ? "Sin teléfono registrado" : "Enviar recordatorio por WhatsApp"}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-opacity"
                            style={{ background: "#25D366" }}
                          >
                            {sending === r.id ? "Enviando..." : "WhatsApp"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
