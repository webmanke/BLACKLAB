// bot.js — FINAL PROFESSIONAL WHATSAPP BOT (LIST MENU + PERFECT PACKAGES)
const axios = require("axios");
const storage = require("./storage");

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WA_TOKEN = process.env.WA_TOKEN;

// Global session store (simple in-memory)
const sessions = {};

// Send text
const sendText = async (to, text) => {
  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, type: "text", text: { body: text } },
    { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
  );
};

// Send interactive list of packages
const sendPackageList = async (to) => {
  const packages = storage.getPackages();
  if (packages.length === 0) {
    return sendText(to, "No packages available right now. Try again later!");
  }

  const sections = [];
  const seenTitles = new Set();

  packages.forEach(p => {
    if (!seenTitles.has(p.title)) {
      seenTitles.add(p.title);
      sections.push({
        id: `pkg_${p.id}`,
        title: `\( {p.title} — KSh \){p.price}`,
        description: p.category.toUpperCase()
      });
    }
  });

  if (sections.length === 0) return sendText(to, "No packages found.");

  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: "BlackLab Packages" },
        body: { text: "Tap a package to buy instantly" },
        footer: { text: "Instant Delivery • 24/7" },
        action: {
          button: "Select Package",
          sections: [{ title: "All Packages", rows: sections.slice(0, 10) }]
        }
      }
    },
    { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
  );
};

// Main menu
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
        body: { text: "Welcome! Choose an option:" },
        footer: { text: "Fast • Trusted • 24/7" },
        action: {
          button: "Menu",
          sections: [
            {
              rows: [
                { id: "packages", title: "Buy Bundles & Airtime" },
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

// Handle incoming
const handleMessage = async (from, text, payload = null) => {
  text = (text || "").trim().toLowerCase();
  storage.addUser(from);

  // Reset session if user says "menu" or "hi"
  if (text === "hi" || text === "hello" || text === "menu") {
    delete sessions[from];
    return sendMenu(from);
  }

  const session = sessions[from] || {};

  // Step 1: Show packages
  if (payload === "packages" || text.includes("buy") || text.includes("package")) {
    session.step = "awaiting_package";
    sessions[from] = session;
    return sendPackageList(from);
  }

  // Step 2: Package selected via list
  if (payload && payload.startsWith("pkg_")) {
    const pkgId = Number(payload.split("_")[1]);
    const pkg = storage.getPackages().find(p => p.id === pkgId);
    if (!pkg) return sendText(from, "Package not found.");

    session.package = pkg;
    session.step = "awaiting_recipient";
    sessions[from] = session;

    return sendText(from, `*Selected:* \( {pkg.title} — KSh \){pkg.price}\n\nPlease send the *phone number to receive the bundle* (e.g. 07xx xxx xxx)`);
  }

  // Step 3: Recipient number
  if (session.step === "awaiting_recipient" && text.match(/^07\d{8}\( |^\+2547\d{8} \)|^2547\d{8}$/)) {
    session.recipient = text.replace(/^\+/, "").trim();
    session.step = "awaiting_mpesa";
    sessions[from] = session;

    return sendText(from, `Recipient: ${session.recipient}\n\nNow send your *M-PESA number* (the one that will pay)`);
  }

  // Step 4: M-PESA number
  if (session.step === "awaiting_mpesa" && text.match(/^07\d{8}\( |^\+2547\d{8} \)|^2547\d{8}$/)) {
    session.mpesa = text.replace(/^\+/, "").trim();
    sessions[from] = session;

    await sendText(from, `
*ORDER SUMMARY*
Package: ${session.package.title}
Price: KSh ${session.package.price}
Recipient: ${session.recipient}
Pay from: ${session.mpesa}

Confirm to receive STK Push now...
    `);

    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "Confirm purchase?" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "confirm_yes", title: "Yes, Pay Now" } },
              { type: "reply", reply: { id: "confirm_no", title: "Cancel" } }
            ]
          }
        }
      },
      { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
    );
    session.step = "awaiting_confirmation";
    sessions[from] = session;
    return;
  }

  // About & Contact
  if (payload === "about" || text === "about") {
    return sendText(from, `*ABOUT BLACKLAB*\n\nKenya's #1 Instant Airtime & Data Vendor\n\n• 100% Automated\n• 24/7 Delivery\n• Trusted by 50,000+ users\n\nType *menu* to go back`);
  }

  if (payload === "contact" || text.includes("support")) {
    return sendText(from, `*SUPPORT*\n\nWhatsApp: +254 700 000 000\nEmail: support@blacklab.ke\n\nReply within 2 minutes • 24/7\n\nType *menu* to go back`);
  }

  // Default
  sendText(from, "I don't understand.\n\nType *menu* to see options.");
};

// Button replies
const handleButton = async (from, payload) => {
  const session = sessions[from] || {};

  if (payload === "confirm_yes" && session.package) {
    delete sessions[from];
    await sendText(from, `Sending STK Push for *\( {session.package.title}* (KSh \){session.package.price}) to ${session.mpesa}...\n\nYou’ll receive a prompt in seconds.\n\nBundle delivered instantly after payment!`);
    // CALL M-PESA STK PUSH HERE (next message)
  }

  if (payload === "confirm_no") {
    delete sessions[from];
    await sendText(from, "Order cancelled. Type *menu* to start again.");
  }
};

// Webhook
const webhook = async (req, res) => {
  if (req.body.object) {
    for (const entry of req.body.entry || []) {
      for (const change of entry.changes || []) {
        const msg = change.value.messages?.[0];
        if (!msg) continue;

        const from = msg.from;
        const text = msg.text?.body;
        const buttonPayload = msg.interactive?.button_reply?.id;
        const listPayload = msg.interactive?.list_reply?.id;

        if (buttonPayload) {
          await handleButton(from, buttonPayload);
        } else if (listPayload) {
          await handleMessage(from, "", listPayload);
        } else if (text) {
          await handleMessage(from, text);
        }
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
};

module.exports = { webhook };
