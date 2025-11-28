const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Stats & Sessions
let stats = { received: 0, sent: 0, startTime: Date.now(), avgResponse: 0 };
let logs = [];
const processedIds = new Set();
const sessions = new Map(); // from → { step, data }

// LOGGING
const log = (type, phone = "", text = "") => {
  const entry = {
    time: new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    type,
    phone: phone ? "xxx" + phone.slice(-4) : "",
    text: text.substring(0, 100)
  };
  logs.push(entry);
  if (logs.length > 500) logs.shift();
};

// DASHBOARD (PREMIUM)
app.get("/", (req, res) => {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  const h = String(Math.floor(uptime / 3600)).padStart(2, "0");
  const m = String(Math.floor((uptime % 3600) / 60)).padStart(2, "0");
  const s = String(uptime % 60).padStart(2, "0");

  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BlackLab • Live Panel</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <style>
    body{margin:0;font-family:'Inter',sans-serif;background:#f8fafc;color:#1e293b;font-size:14px}
    .header{background:linear-gradient(135deg,#0044ff,#0066ff);color:#fff;padding:2.5rem;text-align:center}
    .logo{font-size:2.4rem;font-weight:700;margin:0}
    .container{max-width:1100px;margin:2rem auto;padding:0 1rem}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:1rem;margin-bottom:2rem}
    .stat{background:#fff;border-radius:12px;padding:1.3rem;box-shadow:0 4px 20px rgba(0,0,0,0.07);text-align:center}
    .stat i{font-size:1.8rem;margin-bottom:0.5rem;color:#0066ff}
    .num{font-size:1.8rem;font-weight:600}
    .label{color:#64748b;font-size:0.9rem}
    .card{background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.07);overflow:hidden}
    .card-header{background:#f1f5f9;padding:1rem 1.5rem;font-weight:600;font-size:0.95rem}
    .logs{height:580px;overflow-y:auto;padding:1rem;background:#0f172a;color:#e2e8f0;font:0.86rem 'JetBrains Mono',monospace}
    .log{display:flex;gap:12px;padding:3px 0}
    .t{color:#94a3b8;width:70px;font-size:0.82rem}
    .in{color:#10b981}
    .out{color:#60a5fa}
    footer{text-align:center;padding:2rem;color:#64748b;font-size:0.88rem}
  </style></head><body>
  <div class="header"><h1 class="logo">BlackLab Systems</h1><p>Enterprise WhatsApp Bot • Live Panel</p></div>
  <div class="container">
    <div class="grid">
      <div class="stat">Incoming<div class="num">${stats.received}</div><div class="label">Messages</div></div>
      <div class="stat">Outgoing<div class="num">${stats.sent}</div><div class="label">Replies</div></div>
      <div class="stat">Speed<div class="num">${stats.avgResponse.toFixed(0)}ms</div><div class="label">Avg Response</div></div>
      <div class="stat">Uptime<div class="num">\( {h}: \){m}:${s}</div><div class="label">Since Deploy</div></div>
    </div>
    <div class="card"><div class="card-header">Real-Time Logs</div>
      <div class="logs" id="logs">Connecting...</div>
    </div>
  </div>
  <footer>© 2025 BlackLab Systems • Kenya</footer>
  <script>
    const es = new EventSource('/logs');
    es.onmessage = e => {
      const d = JSON.parse(e.data);
      const el = document.createElement('div'); el.className = 'log';
      el.innerHTML = '<span class="t">['+d.time+']</span><span class="'+(d.type==='in'?'in':'out')+'">'+(d.type==='in'?'Incoming':'Outgoing')+' '+(d.phone?d.phone+': ':'')+d.text+'</span>';
      document.getElementById('logs').appendChild(el);
      document.getElementById('logs').scrollTop = 99999;
    };
  </script>
  </body></html>`);
});

app.get("/logs", (req, res) => {
  res.set({"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive"});
  res.flushHeaders();
  logs.forEach(l => res.write("data: "+JSON.stringify(l)+"\n\n"));
  const i = setInterval(() => logs.slice(-10).forEach(l => res.write("data: "+JSON.stringify(l)+"\n\n")), 1500);
  req.on("close", () => clearInterval(i));
});

app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN)
    return res.send(req.query["hub.challenge"]);
  res.sendStatus(403);
});

// SEND WITH HEADER IMAGE (PROFESSIONAL)
const sendWithImage = async (to, payload, imageUrl = "https://i.imgur.com/8Qz8KZm.jpeg") => {
  const start = Date.now();
  try {
    // Send header image
    await axios.post("https://graph.facebook.com/v20.0/" + PHONE_NUMBER_ID + "/messages", {
      messaging_product: "whatsapp", to, type: "image",
      image: { link: imageUrl }
    }, { headers: { Authorization: "Bearer " + WA_TOKEN } });

    await new Promise(r => setTimeout(r, 900));

    // Send actual message
    await axios.post("https://graph.facebook.com/v20.0/" + PHONE_NUMBER_ID + "/messages", payload, {
      headers: { Authorization: "Bearer " + WA_TOKEN }
    });

    const duration = Date.now() - start;
    stats.sent += 2;
    stats.avgResponse = Math.round((stats.avgResponse * (stats.sent - 2) + duration) / stats.sent);
    log("out", to, "Image + " + (payload.text?.body || payload.interactive?.type || "Menu"));
  } catch (e) {
    log("out", "", "ERROR: " + (e.response?.data?.error?.message || e.message));
  }
};

// MENUS
const mainMenu = (to) => sendWithImage(to, {
  messaging_product: "whatsapp", to,
  type: "interactive", interactive: {
    type: "button",
    body: { text: "Welcome to *BlackLab Systems*\nKenya's #1 Instant Data Vendor\n\nWhat would you like to do?" },
    footer: { text: "BlackLab • 24/7" },
    action: { buttons: [
      { type: "reply", reply: { id: "packages", title: "See Packages" } },
      { type: "reply", reply: { id: "about", title: "About Us" } },
      { type: "reply", reply: { id: "contact", title: "Contact Us" } }
    ]}
  }
}, "https://i.imgur.com/8Qz8KZm.jpeg");

const packageTypes = (to) => sendWithImage(to, {
  messaging_product: "whatsapp", to,
  type: "interactive", interactive: {
    type: "button",
    body: { text: "Choose package type:" },
    action: { buttons: [
      { type: "reply", reply: { id: "data", title: "Data Bundles" } },
      { type: "reply", reply: { id: "minutes", title: "Voice Minutes" } },
      { type: "reply", reply: { id: "sms", title: "SMS Bundles" } }
    ]}
  }
}, "https://i.imgur.com/3kL2m9P.jpeg");

const dataList = (to) => sendWithImage(to, {
  messaging_product: "whatsapp", to,
  type: "interactive", interactive: {
    type: "list",
    header: { type: "text", text: "Data Bundles" },
    body: { text: "Select your package:" },
    action: { button: "View All", sections: [{ rows: [
      { id: "d1", title: "1GB • KSh 29" },
      { id: "d3", title: "3GB • KSh 69" },
      { id: "d5", title: "5GB • KSh 99" },
      { id: "d10", title: "10GB • KSh 179" },
      { id: "d20", title: "20GB • KSh 329" },
      { id: "night", title: "Unlimited Night • KSh 49" }
    ]}]}
  }
}, "https://i.imgur.com/XwY5e9k.jpeg");

const aboutUs = (to) => sendWithImage(to, {
  messaging_product: "whatsapp", to,
  type: "interactive", interactive: {
    type: "button",
    body: { text: "*About BlackLab Systems*\n\nWe are Kenya's fastest and most trusted instant data vendor since 2024.\n\n• Over 1 Million bundles delivered\n• 100% automated system\n• Lowest prices in Kenya\n• Instant delivery (under 10 seconds)\n• 24/7 live support\n• Trusted by thousands daily\n• Official Safaricom partner\n\nThank you for choosing BlackLab — we keep Kenya connected!" },
    footer: { text: "BlackLab Systems" },
    action: { buttons: [{ type: "reply", reply: { id: "main", title: "Back to Menu" } }] }
  }
}, "https://i.imgur.com/8Qz8KZm.jpeg");

const contactUs = (to) => sendWithImage(to, {
  messaging_product: "whatsapp", to,
  type: "text",
  text: { body: "*Contact BlackLab Systems*\n\nPhone: +254 712 345 678\nEmail: support@blacklab.co.ke\nWhatsApp: wa.me/254712345678\n\nWe reply in under 2 minutes!\n\nTap below to go back." }
}, "https://i.imgur.com/3kL2m9P.jpeg").then(() => setTimeout(() => mainMenu(to), 8000));

// WEBHOOK
app.post("/webhook", async (req, res) => {
  try {
    const messages = req.body.entry?.[0]?.changes?.[0]?.value?.messages || [];
    for (const msg of messages) {
      if (processedIds.has(msg.id)) continue;
      processedIds.add(msg.id);
      if (processedIds.size > 10000) processedIds.clear();

      const from = msg.from;
      const btn = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "";
      const text = msg.text?.body?.trim() || "";

      stats.received++;
      log("in", from, text || btn || "media");

      if (btn === "packages") { packageTypes(from); continue; }
      if (btn === "about") { aboutUs(from); continue; }
      if (btn === "contact") { contactUs(from); continue; }
      if (btn === "main") { mainMenu(from); continue; }
      if (btn === "data") { dataList(from); continue; }
      if (btn === "minutes" || btn === "sms") {
        sendWithImage(from, {messaging_product:"whatsapp",to:from,type:"text",text:{body:"This package is coming soon!"}});
        continue;
      }

      if (btn) {
        sendWithImage(from, {messaging_product:"whatsapp",to:from,type:"text",text:{body:"Bundle selected!\n\nM-Pesa STK Push coming in seconds.\nAccept to receive data instantly!"}});
        setTimeout(() => mainMenu(from), 9000);
        continue;
      }

      mainMenu(from);
    }
    res.sendStatus(200);
  } catch (e) {
    log("out", "", "ERROR: " + e.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log("out", "", "BlackLab Bot LIVE — With Header Images & Full Flow");
  console.log("Go to your .onrender.com link");
});
