import { useEffect, useState } from "react";
import api from "../lib/api";
import { fmtMXN } from "../lib/helpers";

export default function MorososPage() {
  const [morosos, setMorosos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending]       = useState(null);
  const [notifyingAll, setNotifyingAll] = useState(false);
  const [toast, setToast]           = useState(null);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const load = () => {
    setLoading(true);
    api.get("/api/admin/morosos")
      .then(r => setMorosos(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const notificarTodos = async () => {
    if (!window.confirm(`¿Enviar recordatorio de pago por WhatsApp a todos los morosos con teléfono registrado?`)) return;
    setNotifyingAll(true);
    try {
      const { data } = await api.post("/api/admin/notify-all-morosos");
      showToast(`✓ Enviadas ${data.enviados} notificaciones${data.fallidos > 0 ? ` · ${data.fallidos} fallidas` : ""}`);
    } catch (err) {
      showToast(err.response?.data?.error || "Error al enviar", false);
    } finally { setNotifyingAll(false); }
  };

  const notificar = async (r) => {
    if (!r.telefono) { showToast("Este residente no tiene teléfono registrado", false); return; }
    setSending(r.id);
    try {
      await api.post("/api/admin/notify-moroso", { residentId: r.id });
      showToast(`✓ Notificación enviada a ${r.residente.split("/")[0].trim()}`);
    } catch (err) {
      showToast(err.response?.data?.error || "Error al enviar", false);
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
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(24, 95, 165);
      doc.text(`Calle ${calle}  ·  ${lista.length} morosos  ·  $${totalCalle.toLocaleString()} MXN`, 14, startY);
      startY += 2;
      doc.autoTable({
        startY: startY + 2,
        head: [["Residente", "Lote / Mza", "Teléfono", "Deuda"]],
        body: lista.map(r => [r.residente.split("/")[0].trim(), `L${r.lote} / Mza ${r.mza}`, r.telefono || "—", `$${Number(r.deuda).toLocaleString()}`]),
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
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(160, 160, 155); doc.setFont("helvetica", "normal");
      doc.text(`FracAdmin · ${fecha}`, 14, 292);
      doc.text(`Página ${i} de ${pages}`, 196, 292, { align: "right" });
    }
    doc.save(`reporte_morosos_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast("✓ PDF descargado");
  };

  const byStreet = [...new Set(morosos.map(r => r.calle))].sort();
  const totalDeuda = morosos.reduce((s, r) => s + Number(r.deuda), 0);
  const graves = morosos.filter(r => r.deuda > 700).length;
  const leve   = morosos.filter(r => r.deuda <= 700).length;

  return (
    <div style={{ padding: "2rem", flex: 1 }}>
      {toast && (
        <div className={`toast ${toast.ok ? "" : "error"}`} style={{ marginBottom: "1rem", borderRadius: "var(--radius)", position: "fixed", top: 16, right: 16, zIndex: 100, padding: "12px 20px" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <div>
          <div className="page-title">Gestión de morosos</div>
          <div className="page-sub">Residentes con pagos pendientes · Notificación directa por WhatsApp</div>
        </div>
        {morosos.length > 0 && (
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button className="btn wa" style={{ gap:6, fontSize:13 }} onClick={notificarTodos} disabled={notifyingAll}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
              {notifyingAll ? "Enviando..." : "Notificar a todos"}
            </button>
            <button className="btn primary" onClick={descargarPDF} style={{ gap: 6 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Descargar PDF
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="empty"><div className="icon">⚠️</div><p>Cargando...</p></div>
      ) : morosos.length === 0 ? (
        <div className="empty">
          <div className="icon">🎉</div>
          <p>¡Sin morosos! Todos los residentes están al corriente.</p>
        </div>
      ) : (
        <>
          <div className="metrics">
            <div className="metric red"><label>Morosos graves</label><div className="val">{graves}</div><div className="sub">Más de $700</div></div>
            <div className="metric amber"><label>Deuda leve</label><div className="val">{leve}</div><div className="sub">Hasta $700</div></div>
            <div className="metric red"><label>Deuda total</label><div className="val" style={{ fontSize: 20 }}>{fmtMXN(totalDeuda)}</div></div>
          </div>

          {byStreet.map(calle => {
            const lista = morosos.filter(r => r.calle === calle).sort((a, b) => b.deuda - a.deuda);
            return (
              <div className="card" key={calle}>
                <div className="card-header">
                  <h3>Calle {calle}</h3>
                  <span>{lista.length} morosos · {fmtMXN(lista.reduce((s, r) => s + Number(r.deuda), 0))}</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Residente</th>
                      <th>Lote</th>
                      <th>Estado</th>
                      <th style={{ textAlign: "right" }}>Deuda</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>{r.residente.split("/")[0].trim()}</td>
                        <td style={{ color: "var(--text2)" }}>L{r.lote}</td>
                        <td><span className={r.deuda > 700 ? "badge red" : "badge amber"}>{r.deuda > 700 ? "Moroso" : "Deuda leve"}</span></td>
                        <td className="right" style={{ fontWeight: 600, color: "var(--red)" }}>{fmtMXN(r.deuda)}</td>
                        <td>
                          <div style={{ display:"flex", gap:4 }}>
                            <button
                              className="btn wa" style={{ fontSize: 12, padding: "5px 10px" }}
                              onClick={() => notificar(r)}
                              disabled={sending === r.id || !r.telefono}
                              title={!r.telefono ? "Sin teléfono registrado" : "Enviar por WhatsApp"}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                              {sending === r.id ? "..." : "WA"}
                            </button>
                            <button
                              className="btn" style={{ fontSize:12, padding:"5px 10px" }}
                              onClick={() => {
                                const d = r.deuda, n = r.residente.split("/")[0].trim();
                                const msg = `Estimado/a *${n}*,\n\nLe recordamos que tiene una deuda pendiente de *$${Number(d).toLocaleString()} MXN*.\n\nPuede registrar su pago en: https://formularioresidentes.onrender.com\n\n_Administración del Fraccionamiento_`;
                                navigator.clipboard.writeText(msg).then(()=>showToast("Mensaje copiado")).catch(()=>showToast("Error al copiar",false));
                              }}
                              title="Copiar mensaje manualmente"
                            >
                              📋
                            </button>
                          </div>
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
