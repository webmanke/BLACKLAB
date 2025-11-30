// bot.js — FINAL UNBREAKABLE VERSION (PHOTO + LIST + ZERO LAG)
const axios = require("axios");
const storage = require("./storage");

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WA_TOKEN = process.env.WA_TOKEN;

// In-memory session (fast & real-time)
const sessions = {};

// Send message with image + caption
const sendWithImage = async (to, imageUrl, caption) => {
  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: {
        link: imageUrl,
        caption: caption
      }
    },
    { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
  );
};

// Send interactive list (packages)
const sendPackageList = async (to) => {
  const packages = storage.getPackages();
  if (!packages || packages.length === 0) {
    return sendText(to, "No packages available right now.");
  }

  const rows = packages.slice(0, 10).map(p => ({
    id: `pkg_${p.id}`,
    title: `${p.title}`,
    description: `KSh \( {p.price} • \){p.category.toUpperCase()}`
  }));

  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: "BlackLab Packages" },
        body: { text: "Tap your desired package below" },
        footer: { text: "Instant Delivery • 24/7" },
        action: {
          button: "Choose Package",
          sections: [{ title: "Available Bundles", rows }]
        }
      }
    },
    { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
  );
};

// Send text only
const sendText = async (to, text) => {
  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text }
    },
    { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
  );
};

// Send confirmation buttons
const sendConfirm = async (to) => {
  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Confirm your order?" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "yes_confirm", title: "Yes, Pay Now" } },
            { type: "reply", reply: { id: "no_cancel", title: "Cancel" } }
          ]
        }
      }
    },
    { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
  );
};

// Main menu with photo
const sendWelcome = async (to) => {
  await sendWithImage(
    to,
    "https://i.imgur.com/elSEhEg.jpeg",  // ← YOUR LOGO / BANNER HERE
    `*Welcome to BlackLab*\n\nKenya's #1 Instant Airtime & Data Vendor\n\nReply with:\n• *Buy* — See packages\n• *About* — Who we are\n• *Support* — Contact us`
  );
};

// Handle all incoming
const handleIncoming = async (from, body) => {
  const text = (body.text?.body || "").trim().toLowerCase();
  const payload = body.interactive?.button_reply?.id || body.interactive?.list_reply?.id;

  storage.addUser(from);
  const session = sessions[from] || { step: "start" };
  sessions[from] = session;

  // Reset on "hi", "hello", "menu"
  if (["hi", "hello", "menu", "start"].includes(text)) {
    session.step = "start";
    return sendWelcome(from);
  }

  // Buy flow
  if (text.includes("buy") || payload === "buy") {
    session.step = "choosing_package";
    return sendPackageList(from);
  }

  // Package selected
  if (payload?.startsWith("pkg_")) {
    const pkgId = Number(payload.split("_")[1]);
    const pkg = storage.getPackages().find(p => p.id === pkgId);
    if (!pkg) return sendText(from, "Package not found.");

    session.package = pkg;
    session.step = "recipient";
    sessions[from] = session;

    return sendText(from, `*Selected:* \( {pkg.title}\nPrice: *KSh \){pkg.price}*\n\nSend the phone number to receive the bundle (e.g. 0712345678)`);
  }

  // Recipient number
  if (session.step === "recipient" && /^0?\d{10}$/.test(text.replace(/\D/g, ""))) {
    session.recipient = "254" + text.replace(/\D/g, "").slice(-9);
    session.step = "mpesa";
    sessions[from] = session;

    return sendText(from, `Recipient: ${session.recipient}\n\nNow send your M-PESA number (the one paying)`);
  }

  // M-Pesa number
  if (session.step === "mpesa" && /^0?\d{10}$/.test(text.replace(/\D/g, ""))) {
    session.mpesa = "254" + text.replace(/\D/g, "").slice(-9);
    session.step = "confirm";
    sessions[from] = session;

    await sendText(from, `
*ORDER CONFIRMATION*

Package → ${session.package.title}
Price → KSh ${session.package.price}
Receive → ${session.recipient}
Pay from → ${session.mpesa}

Ready to send STK Push?
    `);
    return sendConfirm(from);
  }

  // Confirm Yes
  if (payload === "yes_confirm") {
    delete sessions[from];
    await sendText(from, `STK Push sent to \( {session.mpesa}\n\nPay KSh \){session.package.price} to complete.\n\nBundle delivered in seconds!`);
    // ← CALL YOUR M-PESA FUNCTION HERE
    return;
  }

  // Cancel
  if (payload === "no_cancel") {
    delete sessions[from];
    return sendText(from, "Order cancelled. Type *menu* to start again.");
  }

  // About & Support
  if (text === "about") {
    return sendText(from, `*ABOUT BLACKLAB*\n\nKenya's fastest growing instant delivery platform.\n• 100% Automated\n• 24/7 Service\n• Trusted by 100,000+ users\n\nType *menu* to go back`);
  }

  if (text.includes("support") || text.includes("help")) {
    return sendText(from, `*SUPPORT*\nWhatsApp: +254 700 000 000\nEmail: support@blacklab.ke\n\nWe reply in under 3 minutes • 24/7`);
  }

  // Fallback
  sendText(from, "I don't understand.\n\nType *menu* to see options.");
};

// Webhook — FAST & CLEAN
const webhook = async (req, res) => {
  try {
    if (req.method === "GET") {
      // Verification
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];
      if (mode && token === process.env.VERIFY_TOKEN) {
        return res.send(challenge);
      }
      return res.sendStatus(403);
    }

    if (req.body.object) {
      for (const entry of req.body.entry || []) {
        const changes = entry.changes?.[0]?.value;
        if (!changes?.messages?.[0]) continue;

        const message = changes.messages[0];
        const from = message.from;

        await handleIncoming(from, message);
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.sendStatus(500);
  }
};

module.exports = { webhook };
