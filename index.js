const express = require("express");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public")); // For future CSS/JS if needed

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// SQLite DB (persistent on Render)
const dbPath = path.join(__dirname, "blacklab.db");
const db = new sqlite3.Database(dbPath);

// Init DB
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    direction TEXT NOT NULL, -- 'in' or 'out'
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    phone TEXT PRIMARY KEY,
    step TEXT,
    data TEXT -- JSON string
  )`);
});

// Stats
let stats = { received: 0, sent: 0, startTime: Date.now(), avgResponse: 0 };

// LOG TO DB
const logToDb = (direction, phone, content) => {
  db.run("INSERT INTO messages (phone, direction, content) VALUES (?, ?, ?)", [phone, direction, content]);
};

// GET USERS (unique phones from DB)
const getUsers = () => {
  return new Promise((resolve) => {
    db.all("SELECT DISTINCT phone FROM messages ORDER BY timestamp DESC LIMIT 50", (err, rows) => {
      resolve(rows.map(row => row.phone));
    });
  });
};

// DASHBOARD — NOW WITH USER LIST & SEND MESSAGE FORM
app.get("/", async (req, res) => {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  const h = String(Math.floor(uptime / 3600)).padStart(2, "0");
  const m = String(Math.floor((uptime % 3600) / 60)).padStart(2, "0");
  const s = String(uptime % 60).padStart(2, "0");

  const users = await getUsers();

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BlackLab • Admin Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <style>
    body{margin:0;font-family:'Inter',sans-serif;background:#f8fafc;color:#1e293b;font-size:14px}
    .header{background:linear-gradient(135deg,#0044ff,#0066ff);color:#fff;padding:2.5rem;text-align:center}
    .logo{font-size:2.4rem;font-weight:700;margin:0}
    .container{max-width:1200px;margin:2rem auto;padding:0 1rem}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:1rem;margin-bottom:2rem}
    .stat{background:#fff;border-radius:12px;padding:1.3rem;box-shadow:0 4px 20px rgba(0,0,0,0.07);text-align:center}
    .stat i{font-size:1.8rem;margin-bottom:0.5rem;color:#0066ff}
    .num{font-size:1.8rem;font-weight:600}
    .label{color:#64748b;font-size:0.9rem}
    .card{background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.07);overflow:hidden;margin-bottom:1rem}
    .card-header{background:#f1f5f9;padding:1rem 1.5rem;font-weight:600;font-size:0.95rem}
    .users-list{max-height:300px;overflow-y:auto;padding:1rem}
    .user-item{display:flex;justify-content:space-between;align-items:center;padding:0.8rem;border-bottom:1px solid #e2e8f0}
    .user-phone{font-weight:500}
    .send-form{padding:1.5rem}
    .send-form input, .send-form textarea, .send-form select{margin-bottom:1rem;width:100%;padding:0.8rem;border:1px solid #d1d5db;border-radius:8px}
    .send-btn{background:#10b981;color:#fff;border:none;padding:0.8rem 1.5rem;border-radius:8px;cursor:pointer;font-weight:500}
    .logs{height:400px;overflow-y:auto;padding:1rem;background:#0f172a;color:#e2e8f0;font:0.86rem 'JetBrains Mono',monospace}
    .log{display:flex;gap:12px;padding:3px 0}
    .t{color:#94a3b8;width:70px;font-size:0.82rem}
    .in{color:#10b981}
    .out{color:#60a5fa}
    footer{text-align:center;padding:2rem;color:#64748b;font-size:0.88rem}
  </style>
</head>
<body>
<div class="header"><h1 class="logo">BlackLab Admin</h1><p>Full Bot Control • Users & Broadcast</p></div>
<div class="container">
  <div class="grid">
    <div class="stat"><i class="fas fa-inbox"></i><div class="num">${stats.received}</div><div class="label">Messages In</div></div>
    <div class="stat"><i class="fas fa-paper-plane"></i><div class="num">${stats.sent}</div><div class="label">Messages Out</div></div>
    <div class="stat"><i class="fas fa-tachometer-alt"></i><div class="num">${stats.avgResponse.toFixed(0)}ms</div><div class="label">Response Time</div></div>
    <div class="stat"><i class="fas fa-clock"></i><div class="num">\( {h}: \){m}:${s}</div><div class="label">Uptime</div></div>
  </div>

  <div class="grid">
    <div class="card" style="grid-column:1/-1">
      <div class="card-header"><i class="fas fa-users"></i> Active Users (Recent)</div>
      <div class="users-list">
        \( {users.map(user => `<div class="user-item"><span class="user-phone"> \){user}</span><button onclick="sendTo('${user}')"><i class="fas fa-paper-plane"></i> Send Message</button></div>`).join('') || '<p style="text-align:center;color:#64748b">No users yet</p>'}
      </div>
    </div>
  </div>

  <div class="grid">
    <div class="card" style="grid-column:1/2">
      <div class="card-header"><i class="fas fa-comment-dots"></i> Broadcast Message</div>
      <div class="send-form">
        <select id="targetUser"><option value="">Select User or Broadcast All</option>\( {users.map(user => `<option value=" \){user}">${user}</option>`).join('')}</select>
        <textarea id="msgText" placeholder="Message text..." rows="3"></textarea>
        <select id="msgType"><option value="text">Text Only</option><option value="buttons">With Buttons</option></select>
        <button class="send-btn" onclick="sendBroadcast()">Send</button>
      </div>
    </div>

    <div class="card" style="grid-column:2/-1">
      <div class="card-header"><i class="fas fa-terminal"></i> Real-Time Logs</div>
      <div class="logs" id="logs">Connecting...</div>
    </div>
  </div>
</div>
<footer>© 2025 BlackLab Systems • Stable & Scalable</footer>

<script>
  let targetPhone = '';
  function sendTo(phone) {
    targetPhone = phone;
    document.getElementById('targetUser').value = phone;
    document.getElementById('msgText').focus();
  }
  async function sendBroadcast() {
    const phone = document.getElementById('targetUser').value;
    const text = document.getElementById('msgText').value;
    const type = document.getElementById('msgType').value;
    if (!text) return alert('Enter a message');
    const formData = new FormData();
    formData.append('phone', phone || 'all');
    formData.append('text', text);
    formData.append('type', type);
    await fetch('/send-admin', { method: 'POST', body: formData });
    alert('Message sent!');
    document.getElementById('msgText').value = '';
  }

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

// ADMIN SEND ENDPOINT
app.post("/send-admin", async (req, res) => {
  const { phone, text, type } = req.body;
  const users = await getUsers();

  if (phone === 'all') {
    for (const user of users) {
      await sendToUser(user, text, type);
    }
  } else {
    await sendToUser(phone, text, type);
  }
  res.sendStatus(200);
});

const sendToUser = async (to, text, type = 'text') => {
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: type === 'buttons' ? "interactive" : "text"
  };

  if (type === 'buttons') {
    payload.interactive = {
      type: "button",
      header: { type: "image", image: { link: "https://i.imgur.com/elSEhEg.jpeg" } },
      body: { text },
      footer: { text: "BlackLab Systems" },
      action: { buttons: [
        { type: "reply", reply: { id: "reply1", title: "Reply 1" } },
        { type: "reply", reply: { id: "reply2", title: "Reply 2" } }
      ]}
    };
  } else {
    payload.text = { body: text };
  }

  await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, payload, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` }
  });

  logToDb('out', to, text);
  stats.sent++;
};

// VERIFY
app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN)
    return res.send(req.query["hub.challenge"]);
  res.sendStatus(403);
});

// SEND BOT MESSAGE (STABLE VERSION)
const sendBotMsg = async (to, payload) => {
  const start = Date.now();
  try {
    await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, payload, {
      headers: { Authorization: `Bearer ${WA_TOKEN}` }
    });
    const duration = Date.now() - start;
    stats.avgResponse = Math.round((stats.avgResponse * (stats.sent - 1) + duration) / stats.sent);
    logToDb('out', to, payload.text?.body || payload.interactive?.type || "Menu");
    stats.sent++;
  } catch (e) {
    logToDb('out', to, "ERROR: " + (e.response?.data?.error?.message || e.message));
  }
};

// BOT MENUS (SAME AS BEFORE — STABLE)
const mainMenu = (to) => sendBotMsg(to, {
  messaging_product: "whatsapp", to,
  type: "interactive", interactive: {
    type: "button",
    header: { type: "image", image: { link: "https://i.imgur.com/elSEhEg.jpeg" } },
    body: { text: "Welcome to *BlackLab Systems*\nKenya's #1 Instant Data Vendor\n\nWhat would you like to do today?" },
    footer: { text: "BlackLab • Always Instant • 24/7" },
    action: { buttons: [
      { type: "reply", reply: { id: "packages", title: "See Packages" } },
      { type: "reply", reply: { id: "about", title: "About Us" } },
      { type: "reply", reply: { id: "contact", title: "Contact Us" } }
    ]}
  }
});

// ... (add all other menus like packageTypes, dataBundles, aboutUs, contactUs from previous code — same structure)

app.post("/webhook", async (req, res) => {
  try {
    const messages = req.body.entry?.[0]?.changes?.[0]?.value?.messages || [];
    for (const msg of messages) {
      if (processedIds.has(msg.id)) continue;
      processedIds.add(msg.id);

      const from = msg.from;
      const btn = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "";
      const text = msg.text?.body?.trim() || "";

      stats.received++;
      logToDb('in', from, text || btn || "media");

      // Your bot logic here (same as before)
      if (btn === "packages") { packageTypes(from); continue; }
      // ... (rest of your flow)

      mainMenu(from);
    }
    res.sendStatus(200);
  } catch (e) {
    logToDb('out', '', "ERROR: " + e.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
db.close(() => {}); // Graceful close
app.listen(PORT, () => {
  console.log("BlackLab Admin Dashboard LIVE");
});
