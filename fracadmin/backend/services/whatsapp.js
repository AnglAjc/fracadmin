const axios = require("axios");

const MESES_FULL = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

function formatTelefono(tel) {
  // Limpia el número y asegura formato internacional (52 + 10 dígitos para México)
  let clean = tel.replace(/\D/g, "");
  if (clean.startsWith("52") && clean.length === 12) return clean;
  if (clean.length === 10) return "52" + clean;
  return clean;
}

async function sendMessage(telefono, message) {
  const token   = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  // Si aún no se configura la API, solo logueamos
  if (!token || !phoneId) {
    console.log("[WhatsApp SIMULADO]", telefono, "→", message.substring(0, 80));
    return false;
  }

  const to = formatTelefono(telefono);

  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${phoneId}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    console.log(`[WhatsApp] ✓ Mensaje enviado a ${to}`);
    return true;
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    console.error(`[WhatsApp] ✗ Error enviando a ${to}:`, detail);
    return false;
  }
}

async function sendApprovalNotification({ telefono, nombre, mes, anio, monto, submissionId }) {
  const mesNombre = MESES_FULL[Number(mes) - 1] || mes;
  const montoFmt  = Number(monto).toLocaleString("es-MX");

  const message =
    `✅ *Pago aprobado — Fraccionamiento*\n\n` +
    `Estimado/a *${nombre}*,\n\n` +
    `Su pago correspondiente a *${mesNombre} ${anio}* por *$${montoFmt} MXN* ` +
    `ha sido revisado y *aprobado* por la administración.\n\n` +
    `Folio: #${submissionId}\n\n` +
    `Gracias por mantener sus pagos al corriente. 🏘️\n\n` +
    `_Administración del Fraccionamiento_`;

  return sendMessage(telefono, message);
}

async function sendRejectionNotification({ telefono, nombre, mes, anio, monto, reason }) {
  const mesNombre = MESES_FULL[Number(mes) - 1] || mes;
  const montoFmt  = Number(monto).toLocaleString("es-MX");

  const message =
    `⚠️ *Pago no aprobado — Fraccionamiento*\n\n` +
    `Estimado/a *${nombre}*,\n\n` +
    `Su comprobante de pago de *${mesNombre} ${anio}* por *$${montoFmt} MXN* ` +
    `no pudo ser aprobado por la siguiente razón:\n\n` +
    `_${reason}_\n\n` +
    `Por favor vuelva a enviar su pago con el comprobante correcto en:\n` +
    `https://whatsform.com/lg3dyj\n\n` +
    `_Administración del Fraccionamiento_`;

  return sendMessage(telefono, message);
}

async function sendDebtReminder({ telefono, nombre, deuda }) {
  const deudaFmt = Number(deuda).toLocaleString("es-MX");

  const message =
    `📋 *Recordatorio de pago — Fraccionamiento*\n\n` +
    `Estimado/a *${nombre}*,\n\n` +
    `Le informamos que tiene una deuda pendiente de *$${deudaFmt} MXN* ` +
    `correspondiente a mensualidades no pagadas.\n\n` +
    `Puede registrar su pago en:\n` +
    `https://whatsform.com/lg3dyj\n\n` +
    `_Administración del Fraccionamiento_`;

  return sendMessage(telefono, message);
}

module.exports = {
  sendApprovalNotification,
  sendRejectionNotification,
  sendDebtReminder,
};
