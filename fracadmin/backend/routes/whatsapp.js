const router = require("express").Router();

// GET /api/whatsapp/webhook — verificación de Meta
router.get("/webhook", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[WhatsApp] Webhook verificado");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// POST /api/whatsapp/webhook — recibir mensajes entrantes (opcional para el futuro)
router.post("/webhook", (req, res) => {
  // Por ahora solo confirmamos recepción
  res.sendStatus(200);
});

module.exports = router;
