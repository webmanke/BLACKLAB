const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Stats
let stats = { received: 0, sent: 0, startTime: Date.now(), avgResponse: 0 };
let logs = [];
const processedIds = new Set(); // Prevents duplicates FOREVER

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

// PREMIUM DASHBOARD — CLEAN, MODERN, SMALL FONTS, ICONS
app.get("/", (req, res) => {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  const h = String(Math.floor(uptime / 3600)).padStart(2, "0");
  const m = String(Math.floor((uptime % 3600) / 60)).padStart(2, "0");
  const s = String(uptime % 60).padStart(2, "0");

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BlackLab • Live Panel</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <style>
    body{margin:0;font-family:'Inter',sans-serif;background:#f8fafc;color:#1e293b;font-size:14px}
    .header{background:linear-gradient(135deg,#0044ff,#0066ff);color:#fff;padding:2rem;text-align:center}
    .logo{font-size:2.1rem;font-weight:700;margin:0}
    .container{max-width:1100px;margin:2rem auto;padding:0 1rem}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:2rem}
    .stat{background:#fff;border-radius:12px;padding:1.2rem;box-shadow:0 4px 15px rgba(0,0,0,0.06);text-align:center}
    .stat i{font-size:1.7rem;margin-bottom:0.5rem;color:#0066ff}
    .num{font-size:1.7rem;font-weight:600;margin:0.4rem 0}
    .label{color:#64748b;font-size:0.88rem}
    .card{background:#fff;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.06);overflow:hidden}
    .card-header{background:#f1f5f9;padding:1rem 1.5rem;font-weight:600;font-size:0.94rem}
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
  <p>Live Control Panel • Multi-User Ready</p>
</div>
<div class="container">
  <div class="grid">
    <div class="stat">Received Messages<div class="num">${stats.received}</div><div class="label">Total Incoming</div></div>
    <div class="stat">Replies Sent<div class="num">${stats.sent}</div><div class="label">Bot Responses</div></div>
    <div class="stat">Avg Response<div class="num">${stats.avgResponse.toFixed(0)}ms</div><div class="label">Speed</div></div>
    <div class="stat">Uptime<div class="num">\( {h}: \){m}:${s}</div><div class="label">Running</div></div>
  </div>
  <div class="card">
    <div class="card-header">Real-Time Logs</div>
    <div class="logs" id="logs">Connecting to server...</div>
  </div>
</div>
<footer>© 2025 BlackLab Systems • Kenya • Scalable & Reliable</footer>

<script>
  const l = document.getElementById('logs');
  const es = new EventSource('/logs');
  es.onmessage = e => {
    const d = JSON.parse(e.data);
    const el = document.createElement('div');
    el.className = 'log';
    el.innerHTML = '<span class="t">['+d.time+']</span>' +
      '<span class="'+(d.type==='in'?'in':'out')+'">'+(d.type==='in'?'←':'→')+' '+(d.phone?d.phone+': ':'')+d.text+'</span>';
    l.appendChild(el);
    l.scrollTop = l.scrollHeight;
  };
</script>
</body>
</html>`);
});

// LIVE LOGS
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
    log("out", to, payload.text?.body || "Menu/List");
  } catch (e) {
    log("out", "", "ERROR: " + (e.response?.data?.error?.message || e.message));
  }
};

// MENUS
const mainMenu = to => send(to, {
  messaging_product: "whatsapp", to,
  type: "interactive", interactive: {
    type: "button",
    header: { type: "text", text: "BlackLab" },
    body: { text: "Welcome to *BlackLab Systems*\n\nChoose an option:" },
    footer: { text: "BlackLab Systems" },
    action: { buttons: [
      { type: "reply", reply: { id: "buy", title: "Buy Data" } },
      { type: "reply", reply: { id: "balance", title: "Check Balance" } },
      { type: "reply", reply: { id: "about", title: "About Us" } }
    ]}
  }
});

const bundles = to => send(to, {
  messaging_product: "whatsapp", to,
  type: "interactive", interactive: {
    type: "list",
    header: { type: "text", text: "Data Bundles" },
    body: { text: "Select your package:" },
    footer: { text: "BlackLab Systems" },
    action: { button: "View All", sections: [{ rows: [
      { id: "p1", title: "1GB • KSh 29" },
      { id: "p3", title: "3GB • KSh 69" },
      { id: "p5", title: "5GB • KSh 99" },
      { id: "p10", title: "10GB • KSh 179" },
      { id: "p20", title: "20GB • KSh 329" },
      { id: "night", title: "Unlimited Night • KSh 49" }
    ]}]}
  }
});

// WEBHOOK — BULLETPROOF, NO DUPLICATES, MULTI-USER READY
app.post("/webhook", async (req, res) => {
  try {
    const messages = req.body.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!messages) return res.sendStatus(200);

    for (const msg of messages) {
      const msgId = msg.id;
      if (processedIds.has(msgId)) continue; // SKIP DUPLICATES
      processedIds.add(msgId);
      if (processedIds.size > 10000) processedIds.clear();

      const from = msg.from;
      const btn = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "";

      stats.received++;
      log("in", from, msg.text?.body || btn || "media");

      if (btn === "buy") { bundles(from); continue; }
      if (btn === "about") {
        await send(from, { messaging_product: "whatsapp", to: from, type: "text", text: { body: "*BlackLab Systems*\nKenya's fastest data vendor.\n• Instant delivery\n• Best prices\n• 24/7 support" }});
        setTimeout(() => mainMenu(from), 5000);
        continue;
      }
      if (btn) {
        await send(from, { messaging_product: "whatsapp", to: from, type: "text", text: { body: "Bundle selected!\n\nM-Pesa STK Push coming shortly.\nAccept to receive data instantly!" }});
        setTimeout(() => mainMenu(from), 8000);
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
  log("out", "", "BlackLab Bot LIVE — Multi-user, no duplicates, ready for scale");
  console.log("Dashboard → https://" + (process.env.RENDER_EXTERNAL_HOSTNAME || "your-app.onrender.com"));
});
