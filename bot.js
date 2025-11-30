// bot.js — FINAL WHATSAPP BOT (PACKAGES, ABOUT, CONTACT — ALL WORKING)
const axios = require("axios");
const storage = require("./storage");

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WA_TOKEN = process.env.WA_TOKEN;

// Send text message
const sendText = async (to, text) => {
  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, type: "text", text: { body: text } },
    { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
  );
};

// Send buttons
const sendButtons = async (to, body, buttons) => {
  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        header: { type: "text", text: "BlackLab • Instant Delivery" },
        body: { text: body },
        footer: { text: "24/7 • 100% Automated" },
        action: { buttons }
      }
    },
    { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
  );
};

// Send list menu
const sendMenu = async (to) => {
  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: "BlackLab Kenya" },
        body: { text: "Welcome! Choose an option below:" },
        footer: { text: "Instant • Trusted • 24/7" },
        action: {
          button: "View Menu",
          sections: [
            {
              title: "Main Menu",
              rows: [
                { id: "buy", title: "Buy Airtime & Bundles" },
                { id: "packages", title: "View All Packages" },
                { id: "about", title: "About Us" },
                { id: "contact", title: "Contact Support" }
              ]
            }
          ]
        }
      }
    },
    { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
  );
};

// Show packages by category
const showPackages = async (to) => {
  const packages = storage.getPackages();
  if (packages.length === 0) {
    return sendText(to, "No packages available yet. Try again later!");
  }

  const groups = { data: [], minutes: [], sms: [] };
  packages.forEach(p => {
    if (groups[p.category]) groups[p.category].push(`• \( {p.title} — KSh \){p.price}`);
  });

  let message = "*BLACKLAB PACKAGES*\n\n";

  if (groups.data.length > 0) {
    message += "*DATA BUNDLES*\n" + groups.data.join("\n") + "\n\n";
  }
  if (groups.minutes.length > 0) {
    message += "*VOICE MINUTES*\n" + groups.minutes.join("\n") + "\n\n";
  }
  if (groups.sms.length > 0) {
    message += "*SMS PACKAGES*\n" + groups.sms.join("\n") + "\n\n";
  }

  message += "Reply with package name to buy.\nType *menu* for main menu.";

  await sendText(to, message);
};

// Handle incoming messages
const handleMessage = async (from, text, isButton = false, payload = null) => {
  text = text?.trim().toLowerCase() || "";

  // Save user
  storage.addUser(from);

  if (text === "hi" || text === "hello" || text === "menu" || payload === "menu") {
    return sendMenu(from);
  }

  if (payload === "packages" || text === "packages" || text.includes("bundle") || text.includes("data")) {
    return showPackages(from);
  }

  if (payload === "about" || text === "about") {
    return sendText(from, `*ABOUT BLACKLAB*\n\nWe are Kenya's #1 instant airtime & data vendor.\n\n• 100% Automated\n• 24/7 Delivery\n• Trusted by thousands\n• Zero delays\n\nYour success is our mission.\n\nType *menu* to go back.`);
  }

  if (payload === "contact" || text === "contact" || text === "support") {
    return sendText(from, `*CONTACT SUPPORT*\n\nWhatsApp: +254 700 000 000\nEmail: support@blacklab.ke\n\nWe reply in under 5 minutes • 24/7\n\nType *menu* to go back.`);
  }

  if (payload === "buy" || text.includes("buy") || text.includes("airtime") || text.includes("ksh")) {
    return sendText(from, "Please reply with the exact package name you want to buy.\n\nExample: *1GB Daily* or *500 Minutes*\n\nType *packages* to see all options.");
  }

  // If user types a package name
  const packages = storage.getPackages();
  const matched = packages.find(p => 
    p.title.toLowerCase().includes(text) || text.includes(p.title.toLowerCase())
  );

  if (matched) {
    await sendButtons(from, 
      `*\( {matched.title}*\nPrice: KSh \){matched.price}\n\nConfirm purchase?`,
      [
        { type: "reply", reply: { id: "yes_" + matched.id, title: "Yes, Buy Now" } },
        { type: "reply", reply: { id: "no", title: "Cancel" } }
      ]
    );
    return;
  }

  // Default reply
  await sendText(from, "I don't understand that.\n\nType *menu* to see options.");
};

// Handle button replies
const handleButton = async (from, payload) => {
  if (payload.startsWith("yes_")) {
    const pkgId = payload.split("_")[1];
    const pkg = storage.getPackages().find(p => p.id === Number(pkgId));
    if (pkg) {
      // Here you connect M-PESA STK Push
      await sendText(from, `Sending STK Push for *\( {pkg.title}* — KSh \){pkg.price}\n\nYou will receive a prompt on your phone shortly.\n\nAfter payment, bundle is delivered instantly!`);
      // Trigger STK Push here (next step)
    }
  } else if (payload === "no") {
    await sendText(from, "Purchase cancelled. Type *menu* to continue.");
  }
};

// Main webhook handler
const webhook = async (req, res) => {
  if (req.body.object) {
    for (const entry of req.body.entry) {
      for (const change of entry.changes) {
        const message = change.value.messages?.[0];
        const button = change.value.messages?.[0]?.interactive;

        if (message) {
          const from = message.from;
          const text = message.text?.body;
          const payload = message.interactive?.button_reply?.id ||
                         message.interactive?.list_reply?.id;

          if (button?.type === "button_reply") {
            await handleButton(from, payload);
          } else if (payload) {
            await handleMessage(from, "", true, payload);
          } else {
            await handleMessage(from, text);
          }
        }
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
};

module.exports = { webhook };
