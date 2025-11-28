const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Stats & Session Management
let stats = { received: 0, sent: 0, startTime: Date.now(), avgResponse: 0 };
let logs = [];
const processedIds = new Set();
const sessions = new Map(); // user → { step, tempData }

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

// PROFESSIONAL DASHBOARD
app.get("/", (req, res) => {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  const h = String(Math.floor(uptime / 3600)).padStart(2, "0");
  const m = String(Math.floor((uptime % 3600) / 60)).padStart(2, "0");
  const s = String(uptime % 60).padStart(2, "0");

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BlackLab • Control Panel</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <style>
    body{margin:0;font-family:'Inter',sans-serif;background:#f8fafc;color:#1e293b;font-size:14px}
    .header{background:linear-gradient(135deg,#0044ff,#0066ff);color:#fff;padding:2.5rem;text-align:center}
    .logo{font-size:2.3rem;font-weight:700;margin:0}
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
  </style>
</head>
<body>
<div class="header">
  <h1 class="logo">BlackLab Systems</h1>
  <p>Live Control Panel • Enterprise Grade</p>
</div>
<div class="container">
  <div class="grid">
    <div class="stat"><i class="fas fa-inbox"></i><div class="num">${stats.received}</div><div class="label">Messages In</div></div>
    <div class="stat"><i class="fas fa-paper-plane"></i><div class="num">${stats.sent}</div><div class="label">Replies Sent</div></div>
    <div class="stat"><i class="fas fa-tachometer-alt"></i><div class="num">${stats.avgResponse.toFixed(0)}ms</div><div class="label">Avg Speed</div></div>
    <div class="stat"><i class="fas fa-clock"></i><div class="num">\( {h}: \){m}:${s}</div><div class="label">Uptime</div></div>
  </div>
  <div class="card">
    <div class="card-header">Real-Time Logs</div>
    <div class="logs" id="logs">Connecting...</div>
  </div>
</div>
<footer>© 2025 BlackLab Systems • Kenya's #1 Data Vendor</footer>

<script>
  const es = new EventSource('/logs');
  es.onmessage = e => {
    const d = JSON.parse(e.data);
    const el = document.createElement('div');
    el.className = 'log';
    el.innerHTML = '<span class="t">['+d.time+']</span><span class="'+(d.type==='in'?'in':'out')+'">'+(d.type==='in'?'Incoming':'Outgoing')+' '+(d.phone?d.phone+': ':'')+d.text+'</span>';
    document.getElementById('logs').appendChild(el);
    document.getElementById('logs').scrollTop = 99999;
  };
</script>
</body>
</html>`);
});

// LOGS STREAM
app.get("/logs", (req, res) => {
  res.set({"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive"});
  res.flushHeaders();
  logs.forEach(l => res.write("data: "+JSON.stringify(l)+"\n\n"));
  const i = setInterval(() => logs.slice(-10).forEach(l => res.write("data: "+JSON.stringify(l)+"\n\n")), 1500);
  req.on("close", () => clearInterval(i));
});

// VERIFY
app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// SEND + LOG
const send = async (to, payload) => {
  const start = Date.now();
  try {
    await axios.post("https://graph.facebook.com/v20.0/" + PHONE_NUMBER_ID + "/messages", payload, {
      headers: { Authorization: "Bearer " + WA_TOKEN }
    });
    const duration = Date.now() - start;
    stats.sent++;
    stats.avgResponse = Math.round((stats.avgResponse * (stats.sent - 1) + duration) / stats.sent);
    log("out", to, payload.text?.body || payload.interactive?.type || "Menu");
  } catch (e) {
    log("out", "", "ERROR: " + (e.response?.data?.error?.message || e.message));
  }
};

// MENUS
const mainMenu = (to) => send(to, {
  messaging_product: "whatsapp", to,
  type: "interactive", interactive: {
    type: "button",
    header: { type: "text", text: "BlackLab" },
    body: { text: "Welcome to *BlackLab Systems* — Kenya's #1 Instant Data Vendor\n\nChoose a category:" },
    footer: { text: "BlackLab Systems • 24/7" },
    action: { buttons: [
      { type: "reply", reply: { id: "buy_data", title: "Data Bundles" } },
      { type: "reply", reply: { id: "buy_sms", title: "SMS Bundles" } },
      { type: "reply", reply: { id: "about", title: "About Us" } }
    ]}
  }
});

const dataBundles = (to) => send(to, {
  messaging_product: "whatsapp", to,
  type: "interactive", interactive: {
    type: "list",
    header: { type: "text", text: "Data Bundles" },
    body: { text: "Select package:" },
    footer: { text: "BlackLab Systems" },
    action: { button: "View All", sections: [{ title: "Daily & Weekly", rows: [
      { id: "d1", title: "1GB • KSh 29" },
      { id: "d3", title: "3GB • KSh 69" },
      { id: "d5", title: "5GB • KSh 99" },
      { id: "d10", title: "10GB • KSh 179" },
      { id: "d20", title: "20GB • KSh 329" },
      { id: "night", title: "Unlimited Night • KSh 49" }
    ]}]}
  }
});

const aboutUs = (to) => send(to, {
  messaging_product: "whatsapp", to,
  type: "interactive", interactive: {
    type: "button",
    body: { text: "*About BlackLab Systems*\n\nWelcome to Kenya's fastest, most reliable and trusted instant data vendor since 2024.\n\n• Over 500,000+ bundles delivered\n• 100% automated — no delays\n• Lowest prices guaranteed\n• 24/7 live support\n• Trusted by individuals & businesses\n• Powered by Safaricom & WhatsApp Cloud API\n\nWe exist to keep you connected — anytime, anywhere.\n\nThank you for choosing BlackLab" },
    footer: { text: "BlackLab Systems • Kenya" },
    action: { buttons: [{ type: "reply", reply: { id: "main", title: "Back to Menu" } }] }
  }
});

const askBuyFor = (to) => {
  sessions.set(to, { step: "awaiting_for" });
  send(to, {
    messaging_product: "whatsapp", to,
    type: "interactive", interactive: {
      type: "button",
      body: { text: "Who do you want to buy the bundle for?" },
      action: { buttons: [
        { type: "reply", reply: { id: "self", title: "For Myself" } },
        { type: "reply", reply: { id: "other", title: "For Another Number" } }
      ]}
    }
  });
};

// WEBHOOK
app.post("/webhook", async (req, res) => {
  try {
    const messages = req.body.entry?.[0]?.changes?.[0]?.value?.messages || [];
    for (const msg of messages) {
      if (processedIds.has(msg.id)) continue;
      processedIds.add(msg.id);
      if (processedIds.size > 10000) processedIds.clear();

      const from = msg.from;
      const text = msg.text?.body?.trim() || "";
      const btn = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "";

      stats.received++;
      log("in", from, text || btn || "media");

      const session = sessions.get(from) || {};

      // Button actions
      if (btn === "buy_data") { askBuyFor(from); continue; }
      if (btn === "buy_sms") { send(from, {messaging_product:"whatsapp",to:from,type:"text",text:{body:"SMS Bundles coming soon!"}}); continue; }
      if (btn === "about") { aboutUs(from); continue; }
      if (btn === "main") { mainMenu(from); continue; }

      // Buy flow
      if (btn === "self") {
        sessions.delete(from);
        send(from, {messaging_product:"whatsapp",to:from,type:"text",text:{body:"Got it! We'll use your current number for payment & delivery.\n\nPlease select your bundle from the list below:"}});
        setTimeout(() => dataBundles(from), 1500);
        continue;
      }

      if (btn === "other") {
        sessions.set(from, { step: "awaiting_mpesa" });
        send(from, {messaging_product:"whatsapp",to:from,type:"text",text:{body:"Please send the *M-Pesa number* that will pay (e.g. 0712345678)"}});
        continue;
      }

      // Session steps
      if (session.step === "awaiting_mpesa" && text) {
        if (!text.match(/^0[67]\d{8}$/)) {
          send(from, {messaging_product:"whatsapp",to:from,type:"text",text:{body:"Invalid M-Pesa number. Please send a valid Safaricom number (e.g. 0712345678)"}});
          continue;
        }
        sessions.set(from, { step: "awaiting_recipient", mpesa: text });
        send(from, {messaging_product:"whatsapp",to:from,type:"text",text:{body:`M-Pesa number saved: *${text}*\n\nNow send the *recipient number* to receive data (e.g. 0712345678)`}});
        continue;
      }

      if (session.step === "awaiting_recipient" && text) {
        if (!text.match(/^0[67]\d{8}$/)) {
          send(from, {messaging_product:"whatsapp",to:from,type:"text",text:{body:"Invalid recipient number. Try again."}});
          continue;
        }
        sessions.delete(from);
        send(from, {messaging_product:"whatsapp",to:from,type:"text",text:{body:`Got it!\n\nPayment: *\( {session.mpesa}*\nRecipient: * \){text}*\n\nPlease select the bundle below:`}});
        setTimeout(() => dataBundles(from), 2000);
        continue;
      }

      if (btn && btn !== "main") {
        sessions.delete(from);
        send(from, {messaging_product:"whatsapp",to:from,type:"text",text:{body:"Bundle selected!\n\nYour order is being processed.\nYou will receive M-Pesa STK Push shortly.\n\nData will be delivered instantly after payment!"}});
        setTimeout(() => mainMenu(from), 9000);
        continue;
      }

      // Default
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
  log("out", "", "BlackLab Bot FULLY LIVE — Professional & Scalable");
  console.log("Dashboard → https://" + (process.env.RENDER_EXTERNAL_HOSTNAME || "your-app.onrender.com"));
});
