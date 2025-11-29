const express = require("express");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const db = new sqlite3.Database("./blacklab.db");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    direction TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Stats
let stats = { received: 0, sent: 0, startTime: Date.now(), avgResponse: 0 };
const processedIds = new Set();

// Log to DB
const logToDb = (dir, phone, content) => {
  db.run("INSERT INTO messages (phone, direction, content) VALUES (?, ?, ?)", [phone || null, dir, content]);
};

// Get unique users
const getUsers = () => {
  return new Promise((resolve) => {
    db.all("SELECT DISTINCT phone FROM messages WHERE phone IS NOT NULL ORDER BY timestamp DESC LIMIT 100", (err, rows) => {
      resolve(rows.map(r => r.phone));
    });
  });
};

// YOUR IMAGE
const HEADER_IMAGE = "https://i.imgur.com/elSEhEg.jpeg";

// SEND FROM BOT (ONE MESSAGE WITH IMAGE)
const sendBot = async (to, payload) => {
  const start = Date.now();
  try {
    const full = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        header: { type: "image", image: { link: HEADER_IMAGE } },
        ...payload
      }
    };

    await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, full, {
      headers: { Authorization: `Bearer ${WA_TOKEN}` }
    });

    const duration = Date.now() - start;
    stats.sent++;
    stats.avgResponse = Math.round((stats.avgResponse * (stats.sent - 1) + duration) / stats.sent);
    logToDb("out", to, payload.body?.text || "Menu");
  } catch (e) {
    logToDb("out", to, "ERROR: " + (e.response?.data?.error?.message || e.message));
  }
};

// ADMIN DASHBOARD — CLEAN & WORKING
app.get("/", async (req, res) => {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  const h = String(Math.floor(uptime / 3600)).padStart(2, "0");
  const m = String(Math.floor((uptime % 3600) / 60)).padStart(2, "0");
  const s = String(uptime % 60).padStart(2, "0");
  const users = await getUsers();

  let userList = '<p style="text-align:center;color:#888">No users yet</p>';
  if (users.length > 0) {
    userList = users.map(u => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #eee">
        <span style="font-weight:500">${u}</span>
        <button onclick="selectUser('${u}')" style="background:#10b981;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer">Send Message</button>
      </div>
    `).join('');
  }

  res.send(`
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BlackLab • Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<style>
  body{margin:0;font-family:'Inter',sans-serif;background:#f8fafc;color:#1e293b;font-size:14px}
  .h{background:linear-gradient(135deg,#0044ff,#0066ff);color:#fff;padding:2.5rem;text-align:center}
  .logo{font-size:2.4rem;font-weight:700}
  .c{max-width:1200px;margin:2rem auto;padding:0 1rem}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin-bottom:2rem}
  .s{background:#fff;border-radius:12px;padding:1.3rem;box-shadow:0 4px 20px rgba(0,0,0,0.07);text-align:center}
  .s i{font-size:1.8rem;margin-bottom:0.5rem;color:#0066ff}
  .n{font-size:1.8rem;font-weight:600}
  .l{color:#64748b;font-size:0.9rem}
  .card{background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.07);margin-bottom:1.5rem;overflow:hidden}
  .ch{background:#f1f5f9;padding:1rem 1.5rem;font-weight:600}
  .logs{height:420px;overflow-y:auto;padding:1rem;background:#0f172a;color:#e2e8f0;font:0.86rem monospace}
  .log{display:flex;gap:12px;padding:3px 0}
  .t{color:#94a3b8;width:70px;font-size:0.82rem}
  .in{color:#10b981}
  .out{color:#60a5fa}
  textarea,select,input{width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:8px}
  button{background:#10b981;color:white;border:none;padding:12px 20px;border-radius:8px;cursor:pointer;font-weight:500}
  footer{text-align:center;padding:2rem;color:#888}
</style>
</head>
<body>
<div class="h"><h1 class="logo">BlackLab Admin</h1><p>Full Control • Send Messages • View Users</p></div>
<div class="c">
  <div class="grid">
    <div class="s"><i class="fas fa-inbox"></i><div class="n">${stats.received}</div><div class="l">Received</div></div>
    <div class="s"><i class="fas fa-paper-plane"></i><div class="n">${stats.sent}</div><div class="l">Sent</div></div>
    <div class="s"><i class="fas fa-tachometer-alt"></i><div class="n">${stats.avgResponse.toFixed(0)}ms</div><div class="l">Speed</div></div>
    <div class="s"><i class="fas fa-clock"></i><div class="n">\( {h}: \){m}:${s}</div><div class="l">Uptime</div></div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="ch">Active Users</div>
      <div style="padding:1rem">${userList}</div>
    </div>
  </div>

  <div class="card">
    <div class="ch">Send Message From Website</div>
    <div style="padding:1.5rem">
      <input type="text" id="target" placeholder="Phone number (or leave empty for broadcast)" />
      <textarea id="text" rows="4" placeholder="Your message..."></textarea>
      <select id="type">
        <option value="text">Text Only</option>
        <option value="buttons">Text + Buttons</option>
      </select>
      <button onclick="sendMsg()">SEND MESSAGE</button>
    </div>
  </div>

  <div class="card">
    <div class="ch">Live Logs</div>
    <div class="logs" id="logs">Connecting...</div>
  </div>
</div>
<footer>© 2025 BlackLab Systems • Enterprise Grade</footer>

<script>
function selectUser(p){ document.getElementById('target').value = p; }
async function sendMsg(){
  const to = document.getElementById('target').value;
  const text = document.getElementById('text').value;
  const type = document.getElementById('type').value;
  if(!text) return alert("Write a message");
  await fetch('/admin-send',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({to: to||null, text, type})
  });
  alert("Message sent!");
  document.getElementById('text').value='';
}
const es = new EventSource('/logs');
es.onmessage = e => {
  const d = JSON.parse(e.data);
  const el = document.createElement('div'); el.className='log';
  el.innerHTML = '<span class="t">['+d.time+']</span><span class="'+(d.type==='in'?'in':'out')+'">'+(d.type==='in'?'←':'→')+' '+(d.phone?d.phone+': ':'')+d.text+'</span>';
  document.getElementById('logs').appendChild(el);
  document.getElementById('logs').scrollTop = 99999;
};
</script>
</body></html>
  `);
});

// ADMIN SEND MESSAGE
app.post("/admin-send", async (req, res) => {
  let { to, text, type } = req.body;
  if (!text) return res.sendStatus(400);

  const users = await getUsers();
  const targets = to ? [to] : users;

  for (const phone of targets) {
    const payload = { body: { text } };
    if (type === "buttons") {
      payload.action = { buttons: [
        { type: "reply", reply: { id: "yes", title: "Yes" } },
        { type: "reply", reply: { id: "no", title: "No" } }
      ]};
    }
    await sendBot(phone, payload);
  }
  res.sendStatus(200);
});

// LOGS STREAM
app.get("/logs", (req, res) => {
  res.set({"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive"});
  res.flushHeaders();
  db.each("SELECT * FROM messages ORDER BY id DESC LIMIT 50", (err, row) => {
    res.write("data: "+JSON.stringify({
      time: new Date(row.timestamp).toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),
      type: row.direction,
      phone: row.phone ? "xxx"+row.phone.slice(-4) : "",
      text: row.content
    })+"\n\n");
  });
  const i = setInterval(() => {}, 60000);
  req.on("close", () => clearInterval(i));
});

// WEBHOOK VERIFY
app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN)
    return res.send(req.query["hub.challenge"]);
  res.sendStatus(403);
});

// MAIN MENU
const mainMenu = (to) => sendBot(to, {
  body: { text: "Welcome to *BlackLab Systems*\nKenya's #1 Instant Data Vendor\n\nChoose:" },
  footer: { text: "BlackLab • 24/7" },
  action: { buttons: [
    { type: "reply", reply: { id: "packages", title: "See Packages" } },
    { type: "reply", reply: { id: "about", title: "About Us" } },
    { type: "reply", reply: { id: "contact", title: "Contact Us" } }
  ]}
});

// WEBHOOK
app.post
app.post("/webhook", async (req, res) => {
  try {
    const msgs = req.body.entry?.[0]?.changes?.[0]?.value?.messages || [];
    for (const msg of msgs) {
      if (processedIds.has(msg.id)) continue;
      processedIds.add(msg.id);

      const from = msg.from;
      const btn = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "";

      stats.received++;
      logToDb("in", from, btn || msg.text?.body || "media");

      if (["packages","about","contact","main"].includes(btn)) {
        mainMenu(from); // placeholder — add your full flow later
        continue;
      }

      mainMenu(from);
    }
    res.sendStatus(200);
  } catch (e) {
    logToDb("out", null, "ERROR: "+e.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("BlackLab Admin Dashboard + Bot LIVE");
});
