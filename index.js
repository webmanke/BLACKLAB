const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const sessions = new Map();

// === BEAUTIFUL LIVE STATUS + DOCUMENTATION PAGE ===
app.get("/", (req, res) => {
  res.send(`
    <style>
      body {margin:0;height:100vh;background:linear-gradient(135deg,#0f0f23,#1a1a3d);color:#fff;font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;text-align:center;}
      .card {background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);padding:40px 30px;border-radius:20px;border:1px solid rgba(255,255,255,0.2);max-width:500px;}
      h1 {font-size:3.5rem;margin:0 0 10px;background:linear-gradient(90deg,#00ff88,#00d4ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent;}
      .status {color:#00ff00;font-weight:bold;}
      .footer {margin-top:40px;font-size:1rem;opacity:0.8;}
    </style>
    <div class="card">
      <h1>BlackLab</h1>
      <p style="font-size:1.6rem;margin:10px 0;">WhatsApp Bot is <span class="status">LIVE & ACTIVE</span></p>
      <p style="line-height:1.8;">
        • Auto replies with interactive menus<br>
        • M-Pesa STK Push integration ready<br>
        • Supports unlimited data bundles via "More Bundles"<br>
        • Built for scale & speed
      </p>
      <div class="footer">
        BlackLab Systems © 2025<br>
        <small>Powered by WhatsApp Cloud API + Node.js</small>
      </div>
    </div>
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

// Send interactive button (max 3)
async function sendButton(to, header, body, buttons) {
  const data = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: { type: "text", text: header },
      body: { text: body },
      footer: { text: "BlackLab Systems" },
      action: { buttons: buttons.map(b => ({ type: "reply", reply: { id: b.id, title: b.title } })) }
    }
  };
  await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, data, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` }
  });
}

// Send List Message (up to 10 items
async function sendListMenu(to) {
  const data = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: "All Data Bundles" },
      body: { text: "Choose your preferred data package:" },
      footer: { text: "BlackLab Systems" },
      action: {
        button: "View Bundles",
        sections: [{
          rows: [
            { id: "bundle_1gb", title: "1GB", description: "KSh 29 · 30 days" },
            { id: "bundle_3gb", title: "3GB", description: "KSh 69 · 30 days" },
            { id: "bundle_5gb", title: "5GB", description: "KSh 99 · 30 days" },
            { id: "bundle_10gb", title: "10GB", description: "KSh 179 · 30 days" },
            { id: "bundle_20gb", title: "20GB", description: "KSh 329 · 30 days" },
            { id: "bundle_unlimited", title: "Unlimited Night", description: "KSh 49 · 12am–6am" },
          ]
        }]
      }
    }
  };
  await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, data, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` }
  });
}

// Main handler
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from = message?.from;
    if (!from) return res.sendStatus(200);

    const buttonId = message?.interactive?.button_reply?.id || message?.interactive?.list_reply?.id;

    // === BUNDLE SELECTED (from list or button) ===
    if (buttonId?.startsWith("bundle_")) {
      const bundles = {
        bundle_1gb: 29,
        bundle_3gb: 69,
        bundle_5gb: 99,
        bundle_10gb: 179,
        bundle_20gb: 329,
        bundle_unlimited: 49
      };

      const amount = bundles[buttonId];
      const name = buttonId.replace("bundle_", "").replace("_", " ").toUpperCase();

      await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: "whatsapp",
        to: from,
        type: "text",
        text: {
          body: `You selected *\( {name}* for *KSh \){amount}*\n\nYou will receive an M-Pesa STK Push shortly.\n\nPlease accept the prompt on your phone to complete purchase.\n\nThank you for choosing BlackLab!`
        }
      }, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });

      // Clean return to main menu after 6 seconds
      setTimeout(async () => {
        sessions.delete(from);
        await sendButton(from, "BlackLab", "Welcome back! How can we help you today?", [
          { id: "buy_bundle", title: "Buy Data" },
          { id: "check_balance", title: "Check Balance" },
          { id: "support", title: "Support" }
        ]);
      }, 6000);

      return res.sendStatus(200);
    }

    // === BUTTON CLICKS ===
    if (buttonId === "buy_bundle" || buttonId === "more_bundles") {
      sessions.set(from, "browsing_bundles");
      return await sendListMenu(from);
    }

    if (buttonId === "about") {
      await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: "whatsapp",
        to: from,
        type: "text",
        text: { body: "*BlackLab Systems*\n\nKenya's fastest growing data vendor.\n\n• Instant delivery\n• 24/7 support\n• Best prices guaranteed\n\nWe run on trust & speed." }
      }, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
      setTimeout(() => sendMainMenu(from), 5000);
      return res.sendStatus(200);
    }

    // === DEFAULT: Show main menu ===
    sessions.delete(from);
    await sendMainMenu(from);

    res.sendStatus(200);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.sendStatus(500);
  }
});

async function sendMainMenu(to) {
  await sendButton(to, "BlackLab", "Welcome to *BlackLab*!\n\nChoose an option:", [
    { id: "buy_bundle", title: "Buy Data" },
    { id: "more_bundles", title: "More Bundles" },
    { id: "about", title: "About Us" }
  ]);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BlackLab Bot running smoothly on port ${PORT}`));
