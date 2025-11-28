const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Stats & logs
let stats = { received: 0, sent: 0, uptime: Date.now(), avgResponse: 0 };
let logs = [];
let lastMsgTime = 0;

const log = (type, phone = "", text = "") => {
  const entry = {
    time: new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    type, // in / out
    phone: phone ? "xxx" + phone.slice(-4) : "",
    text: text.substring(0, 100)
  };
  logs.push(entry);
  if (logs.length > 500) logs.shift();
};

// PROFESSIONAL DASHBOARD — CLEAN, SMALL FONTS, ICONS, STATS
app.get("/", (req, res) => {
  const uptime = Math.floor((Date.now() - stats.uptime) / 1000);
  const hrs = String(Math.floor(uptime / 3600)).padStart(2, "0");
  const mins = String(Math.floor((uptime % 3600) / 60)).padStart(2, "0");
  const secs = String(uptime % 60).padStart(2, "0");

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BlackLab • Control Panel</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <style>
    :root { --bg:#f9fbfd; --card:#ffffff; --text:#1e293b; --green:#10b981; --blue:#3b82f6; }
    body {margin:0;font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);font-size:14px}
    .header {background:linear-gradient(135deg,#0044ff,#0066ff);color:#fff;padding:2rem;text-align:center}
    .logo {font-size:2.2rem;font-weight:700;margin:0}
    .container {max-width:1100px;margin:2rem auto;padding:0 1rem}
    .grid {display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin-bottom:2rem}
    .stat {background:var(--card);border-radius:12px;padding:1.2rem;box-shadow:0 4px 15px rgba(0,0,0,0.05);text-align:center}
    .stat i {font-size:1.8rem;margin-bottom:0.5rem;color:var(--blue)}
    .num {font-size:1.8rem;font-weight:600;margin:0.3rem 0}
    .label {color:#64748b;font-size:0.9rem}
    .card {background:var(--card);border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.05);overflow:hidden}
    .card-header {background:#f1f5f9;padding:1rem 1.5rem;font-weight:600;font-size:0.95rem;border-bottom:1px solid #e2e8f0}
    .logs {height:580px;overflow-y:auto;padding:1rem;background:#0f8fafc;font:0.88rem 'JetBrains Mono',monospace}
    .log {display:flex;gap:12px;padding:4px 0;align-items:center}
    .time {color:#94a3b8;width:68px;font-size:0.82rem}
    .in {color:#10b981}
    .out {color:#3b82f6}
    footer {text-align:center;padding:2rem;color:#64748b;font-size:0.9rem}
  </style>
</head>
<body>
  <div class="header">
    <h1 class="logo">BlackLab Systems</h1>
    <p>WhatsApp Bot • Live Control Panel</p>
  </div>

  <div class="container">
    <div class="grid">
      <div class="stat"><i class="fas fa-inbox"></i><div class="num">${stats.received}</div><div class="label">Messages Received</div></div>
      <div class="stat"><i class="fas fa-paper-plane"></i><div class="num">${stats.sent}</div><div class="label">Replies Sent</div></div>
      <div class="stat"><i class="fas fa-clock"></i><div class="num">${stats.avgResponse.toFixed(0)}ms</div><div class="label">Avg Response Time</div></div>
      <div class="stat"><i class="fas fa-heartbeat"></i><div class="num">\( {hrs}: \){mins}:${secs}</div><div class="label">Uptime</div></div>
    </div>

    <div class="card">
      <div class="card-header"><i class="fas fa-terminal"></i> Real-Time Logs</div>
      <div class="logs" id="logs">Connecting...</div>
    </div>
  </div>

  <footer>© 2025 BlackLab Systems • Made in Kenya with love</footer>

  <script>
    const l = document.getElementById('logs');
    const es = new EventSource('/logs');
    es.onmessage = e => {
      const d = JSON.parse(e.data);
      const el = document.createElement('div');
      el.className = 'log';
      el.innerHTML = '<span class="time">['+d.time+']</span>' +
        '<span class="'+(d.type==='in'?'in':'out')+'">'+(d.type==='in'?'Incoming':'Outgoing')+' '+(d.phone?d.phone+': ':'')+d.text+'</span>';
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
  const int = setInterval(() => {
    logs.slice(-10).forEach(l => res.write("data: "+JSON.stringify(l)+"\n\n"));
  }, 1500);
  req.on("close", () => clearInterval(int));
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
    log("out", to, payload.text?.body || "Interactive Menu");
  } catch (e) {
    log("out", "", "SEND ERROR: " + (e.response?.data?.error?.message || e.message));
  }
};

// MENUS
const mainMenu = (to) => send(to, {
  messaging_product: "whatsapp", to,
  type: "interactive", interactive: {
    type: "button",
    header: { type: "text", text: "BlackLab" },
    body: { text: "Welcome to *BlackLab Systems*\n\nHow can we help you?" },
    footer: { text: "BlackLab Systems" },
    action: { buttons: [
      { type: "reply", reply: { id: "buy", title: "Buy Data" } },
      { type: "reply", reply: { id: "balance", title: "Check Balance" } },
      { type: "reply", reply: { id: "about", title: "About Us" } }
    ]}
  }
});

const bundlesMenu = (to) => send(to, {
  messaging_product: "whatsapp", to,
  type: "interactive", interactive: {
    type: "list",
    header: { type: "text", text: "Data Bundles" },
    body: { text: "Choose your package:" },
    footer: { text: "BlackLab Systems" },
    action: { button: "View Packages", sections: [{ rows: [
      { id: "p1", title: "1GB • KSh 29" },
      { id: "p3", title: "3GB • KSh 69" },
      { id: "p5", title: "5GB • KSh 99" },
      { id: "p10", title: "10GB • KSh 179" },
      { id: "p20", title: "20GB • KSh 329" },
      { id: "night", title: "Unlimited Night • KSh 49" }
    ]}]}
  }
});

// WEBHOOK — FINAL & BULLETPROOF
let lastId = "";
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg || msg.message_id === lastId) return res.sendStatus(200);
    lastId = msg.message_id;

    const from = msg.from;
    const btnId = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "";

    stats.received++;
    log("in", from, msg.text?.body || btnId || "media");

    if (btnId === "buy") return bundlesMenu(from);
    if (btnId === "about") {
      await send(from, { messaging_product: "whatsapp", to: from, type: "text", text: { body: "*BlackLab Systems*\nKenya's fastest data vendor.\n• Instant delivery\n• Best prices\n• 24/7 support" }});
      setTimeout(() => mainMenu(from), 5000);
      return res.sendStatus(200);
    }
    if (btnId) {
      await send(from, { messaging_product: "whatsapp", to: from, type: "text", text: { body: "Bundle selected!\n\nYou will receive M-Pesa STK Push in seconds.\nAccept to get data instantly!" }});
      setTimeout(() => mainMenu(from), 8000);
      return res.sendStatus(200);
    }

    // First contact or random text
    mainMenu(from);
    res.sendStatus(200);
  } catch (e) {
    log("out", "", "ERROR: " + e.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log("out", "", "BlackLab Bot is LIVE and READY");
  console.log("Dashboard → https://" + (process.env.RENDER_EXTERNAL_HOSTNAME || "your-app.onrender.com"));
});
