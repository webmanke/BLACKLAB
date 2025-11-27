import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ENV VARS
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;        // blacklabverify
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;    // your permanent token
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;  // from Meta

// ---------------------------------------------------
// GET WEBHOOK (VERIFICATION HANDSHAKE)
// ---------------------------------------------------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
  }

  return res.sendStatus(403);
});

// ---------------------------------------------------
// POST WEBHOOK (INCOMING MESSAGES)
// ---------------------------------------------------
app.post("/webhook", async (req, res) => {
  try {
    console.log("Incoming webhook:", JSON.stringify(req.body, null, 2));

    // Confirm delivery to Meta
    res.sendStatus(200);

    // Parse message
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message) return;

    const from = message.from;
    const text = message.text?.body;

    console.log("Message from:", from);
    console.log("Text:", text);

    // AUTO-REPLY (simple text)
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      data: {
        messaging_product: "whatsapp",
        to: from,
        text: { body: "BlackLab: your message has been received." }
      }
    });

  } catch (err) {
    console.error("Webhook error:", err.response?.data || err.message);
  }
});

// ---------------------------------------------------
app.get("/", (req, res) => {
  res.send("BlackLab WhatsApp Bot is live.");
});

// ---------------------------------------------------
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
