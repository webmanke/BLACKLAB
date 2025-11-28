const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const sessions = new Map();

// === ROOT PAGE WITH NICE STYLING ===
app.get("/", (req, res) => {
  res.send(`
    <body style="margin:0;height:100vh;background:linear-gradient(135deg,#000428,#004e92);color:white;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;flex-direction:column;">
      <h1 style="font-size:3rem;margin-bottom:0;">BlackLab</h1>
      <p style="font-size:1.5rem;margin:10px;">WhatsApp Bot is <span style="color:#00ff00;font-weight:bold;">LIVE & READY</span></p>
      <p style="margin-top:30px;font-size:1.1rem;opacity:0.9;">built with ❤️ by blacklab tech</p>
      <p style="position:absolute;bottom:20px;font-size:0.9rem;opacity:0.7;">Status: All systems operational</p>
    </body>
  `);
});

// Webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

// Send menu — now with MAX 3 buttons only!
async function sendMenu(to, menuKey = "main") {
  const menus = {
    main: {
      header: "BlackLab",
      body: "Welcome to *BlackLab*!\n\nHow can we help you today?",
      buttons: [
        { id: "buy_bundle", title: "Buy Data Bundle" },
        { id: "check_balance", title: "Check Balance" },
        { id: "support", title: "Support / About" }, // merged two into one
      ],
    },
    buy_bundle: {
      header: "Data Bundles",
      body: "Choose your bundle — valid 30 days",
      buttons: [
        { id: "bundle_1gb", title: "1GB → R29" },
        { id: "bundle_5gb", title: "5GB → R99" },
        { id: "back_main", title: "Back" },
      ],
    },
  };

  const menu = menus[menuKey] || menus.main;

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: { type: "text", text: menu.header },
      body: { text: menu.body },
      footer: { text: "built with ❤️ by blacklab tech" },
      action: {
        buttons: menu.buttons.map(b => ({
          type: "reply",
          reply: { id: b.id, title: b.title }
        }))
      }
    }
  };

  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      data,
      { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
    );
    console.log(`Menu "\( {menuKey}" sent to \){to}`);
  } catch (error) {
    console.error("Failed to send menu:", error.response?.data || error.message);
  }
}

// Webhook handler
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from = message?.from;
    if (!from) return res.sendStatus(200);

    // Button reply
    if (message?.interactive?.button_reply?.id) {
      const id = message.interactive.button_reply.id;

      if (id === "buy_bundle") return await sendMenu(from, "buy_bundle");
      if (id === "back_main") { sessions.delete(from); return await sendMenu(from, "main"); }
      if (id.startsWith("bundle_")) {
        const bundle = id.replace("bundle_", "").replace("_", " ").toUpperCase();
        await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: { body: `You selected *${bundle}*!\n\nPayment details coming in a few seconds…\nThank you!` }
        }, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });

        setTimeout(() => { sessions.delete(from); sendMenu(from, "main"); }, 4000);
        return res.sendStatus(200);
      }
    }

    // Any other message → main menu
    sessions.delete(from);
    await sendMenu(from, "main");

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BlackLab Bot LIVE on port ${PORT}`));
