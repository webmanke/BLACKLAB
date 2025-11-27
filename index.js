import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ENV VARS (Render)
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;        // blacklabverify
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;    // permanent token
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;  // from Meta

// ---------------------------------------------------
// SEND TEMPLATE HELPER
// ---------------------------------------------------
async function sendTemplate(to, templateName, components = []) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en" }
      }
    };

    if (components.length > 0) {
      payload.template.components = components;
    }

    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      },
      data: payload
    });

    console.log("Template sent:", templateName);

  } catch (err) {
    console.error("Template send error:", err.response?.data || err.message);
  }
}

// ---------------------------------------------------
// GET WEBHOOK (META VERIFICATION)
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
// POST WEBHOOK (RECEIVE MESSAGES)
// ---------------------------------------------------
app.post("/webhook", async (req, res) => {
  console.log("Incoming webhook:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message) return;

    const from = message.from;
    const text = message.text?.body?.toLowerCase() || "";

    console.log("From:", from, "Text:", text);

    // ---------------------------------------------------
    // MENU COMMAND
    // ---------------------------------------------------
    if (text === "menu") {
      await sendTemplate(from, "blacklab_menu");
      return;
    }

    // ---------------------------------------------------
    // MENU OPTIONS → TRIGGERS TEMPLATES
    // ---------------------------------------------------
    if (text === "order assistance") {
      await sendTemplate(from, "order_assistance_blacklab", [
        {
          type: "body",
          parameters: [{ type: "text", text: "Customer" }]
        }
      ]);
      return;
    }

    if (text === "know more") {
      await sendTemplate(from, "about_blacklab_info");
      return;
    }

    if (text === "call tony") {
      await sendTemplate(from, "call_tony_blacklab");
      return;
    }

    // ---------------------------------------------------
    // FALLBACK RESPONSE
    // ---------------------------------------------------
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
        text: { body: "Send 'menu' to explore BlackLab options." }
      }
    });

  } catch (err) {
    console.error("Message handling error:", err.response?.data || err.message);
  }
});

// ---------------------------------------------------
app.get("/", (req, res) => {
  res.send("BlackLab WhatsApp Bot is running.");
});

// ---------------------------------------------------
app.listen(3000, () => {
  console.log("BlackLab bot running on port 3000");
});
