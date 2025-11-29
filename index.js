const express = require("express");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    mpesa TEXT,
    package TEXT,
    status TEXT DEFAULT 'pending',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    title TEXT,
    price INTEGER
  )`);

  // Default packages
  const defaultPackages = [
    ["data", "1GB Daily", 29],
    ["data", "3GB Weekly", 69],
    ["data", "10GB Monthly", 179],
    ["data", "Unlimited Night", 49],
    ["minutes", "100 Minutes", 50],
    ["sms", "500 SMS Pack", 30]
  ];
  const stmt = db.prepare("INSERT OR IGNORE INTO packages (category, title, price) VALUES (?, ?, ?)");
  defaultPackages.forEach(p => stmt.run(p));
  stmt.finalize();
});

let stats = { received: 0, sent: 0, startTime: Date.now() };
const processed = new Set();
const sessions = new Map();
const HEADER_IMG = "https://i.imgur.com/elSEhEg.jpeg";

const send = async (to, payload) => {
  try {
    const fullPayload = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        header: { type: "image", image: { link: HEADER_IMG } },
        ...payload
      }
    };
    await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, fullPayload, {
      headers: { Authorization: `Bearer ${WA_TOKEN}` }
    });
    stats.sent++;
    db.run("INSERT INTO messages (phone,direction,content) VALUES (?,?,?)", [to, "out", payload.body?.text || "Interactive"]);
  } catch (e) {
    console.error("Send error:", e.response?.data || e.message);
  }
};

// ====================== ADMIN DASHBOARD (GOD MODE) ======================
app.get("/", async (req, res) => {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  const h = String(Math.floor(uptime / 3600)).padStart(2, "0");
  const m = String(Math.floor((uptime % 3600) / 60)).padStart(2, "0");
  const s = String(uptime % 60).padStart(2, "0");

  const [users, orders, packages] = await Promise.all([
    new Promise(r => db.all("SELECT DISTINCT phone FROM messages WHERE phone IS NOT NULL ORDER BY timestamp DESC LIMIT 50", (_, rows) => r(rows))),
    new Promise(r => db.all("SELECT * FROM orders ORDER BY id DESC LIMIT 20", (_, rows) => r(rows))),
    new Promise(r => db.all("SELECT * FROM packages ORDER BY category, price", (_, rows) => r(rows)))
  ]);

  // Build HTML safely with proper escaping
  const packageRows = packages.map(p => `
    <tr>
      <td>${p.category.toUpperCase()}</td>
      <td>${p.title}</td>
      <td>KSh ${p.price}</td>
      <td><button onclick="delPkg(${p.id})" style="background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer">Delete</button></td>
    </tr>
  `).join('');

  const orderRows = orders.map(o => `
    <tr>
      <td>${new Date(o.timestamp).toLocaleString()}</td>
      <td>${o.phone}</td>
      <td>${o.mpesa || "-"}</td>
      <td>${o.package}</td>
      <td><span style="color:#f59e0b">${o.status}</span></td>
    </tr>
  `).join('');

  || '<tr><td colspan="5" style="text-align:center;color:#888">No orders yet</td></tr>';

  const userStats = await Promise.all(users.map(async u => {
    const sent = await new Promise(r => db.get("SELECT COUNT(*) c FROM messages WHERE phone=? AND direction='in'", [u.phone], (_, x) => r(x.c)));
    const received = await new Promise(r => db.get("SELECT COUNT(*) c FROM messages WHERE phone=? AND direction='out'", [u.phone], (_, x) => r(x.c)));
    return `<div style="padding:10px;border-bottom:1px solid #eee;display:flex;justify-content:space-between">
      <strong>${u.phone}</strong>
      <span>In: \( {sent} | Out: \){received}</span>
    </div>`;
  }));

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BlackLab • GOD MODE</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <style>
    body{margin:0;font-family:'Inter',sans-serif;background:#f8fafc;color:#1e293b}
    .header{background:linear-gradient(135deg,#0044ff,#0066ff);color:#fff;padding:2.5rem;text-align:center}
    .logo{font-size:2.6rem;font-weight:700}
    .ping{background:#000;color:#0f0;padding:12px;border-radius:12px;font-family:monospace;font-size:1.2rem;margin-top:10px}
    .container{max-width:1400px;margin:2rem auto;padding:0 1rem}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.5rem}
    .card{background:#fff;border-radius:16px;padding:1.8rem;box-shadow:0 10px 30px rgba(0,0,0,0.1);margin-bottom:2rem}
    .card h3{margin:0 0 1.2rem;font-size:1.3rem;color:#1e40af}
    table{width:100%;border-collapse:collapse}
    th,td{padding:12px;text-align:left;border-bottom:1px solid #e2e8f0}
    th{background:#f8fafc}
    input,textarea,select,button{width:100%;padding:12px;margin:8px 0;border-radius:10px;border:1px solid #cbd5e1}
    button{background:#10b981;color:white;border:none;font-weight:600;cursor:pointer;font-size:1rem}
    button:hover{background:#059669}
    .del{background:#ef4444}
    .del:hover{background:#dc2626}
  </style>
</head>
<body>
<div class="header">
  <h1 class="logo">BlackLab Systems</h1>
  <div class="ping">BOT IS LIVE • ${new Date().toLocaleTimeString()}</div>
</div>

<div class="container">
  <div class="grid">
    <div class="card"><h3>Bot Stats</h3>
      Messages In: <strong>${stats.received}</strong><br>
      Messages Out: <strong>${stats.sent}</strong><br>
      Uptime: <strong>\( {h}h \){m}m ${s}s</strong>
    </div>
    <div class="card"><h3>Broadcast to All Users</h3>
      <textarea id="broadcastText" rows="3" placeholder="Type message for all customers..."></textarea>
      <button onclick="broadcast()">SEND TO EVERYONE</button>
    </div>
  </div>

  <div class="card">
    <h3>Send Custom Message</h3>
    <input type="text" id="targetPhone" placeholder="Phone number (optional)">
    <textarea id="msgText" rows="4" placeholder="Your message..."></textarea>
    <input type="text" id="btn1" placeholder="Button 1 (e.g. View Packages)">
    <input type="text" id="btn2" placeholder="Button 2 (e.g. Contact Us)">
    <button onclick="sendCustom()">SEND MESSAGE</button>
  </div>

  <div class="card">
    <h3>Manage Packages</h3>
    <table><tr><th>Category</th><th>Title</th><th>Price</th><th>Action</th></tr>${packageRows}</table>
    <form id="addForm" style="margin-top:20px;display:grid;grid-template-columns:1fr 2fr 1fr auto;gap:10px;align-items:end">
      <select name="cat"><option>data</option><option>minutes</option><option>sms</option></select>
      <input name="title" placeholder="Package name" required>
      <input name="price" type="number" placeholder="Price" required>
      <button type="submit">ADD</button>
    </form>
  </div>

  <div class="card">
    <h3>Recent Orders</h3>
    <table><tr><th>Time</th><th>Customer</th><th>M-Pesa</th><th>Package</th><th>Status</th></tr>${orderRows}</table>
  </div>

  <div class="card">
    <h3>User Activity (Last 50)</h3>
    ${userStats.join('') || '<p style="color:#888">No users yet</p>'}
  </div>
</div>

<script>
async function broadcast(){
  const text = document.getElementById('broadcastText').value;
  if(!text) return alert("Write a message");
  await fetch('/broadcast', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text})});
  alert("Broadcast sent!");
}
async function sendCustom(){
  const to = document.getElementById('targetPhone').value || null;
  const text = document.getElementById('msgText').value;
  const b1 = document.getElementById('btn1').value || null;
  const b2 = document.getElementById('btn2').value || null;
  if(!text) return alert("Message required");
  await fetch('/send', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({to, text, btn1:b1, btn2:b2})});
  alert("Message sent!");
}
async function delPkg(id){
  if(!confirm("Delete this package?")) return;
  await fetch('/package/'+id, {method:'DELETE'});
  location.reload();
}
document.getElementById('addForm').onsubmit = async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  await fetch('/package', {method:'POST', body:f});
  location.reload();
};
setInterval(() => location.reload(), 180000); // refresh every 3 min
</script>
</body></html>`);
});

// ====================== ADMIN ENDPOINTS ======================
app.post("/broadcast", async (req, res) => {
  const { text } = req.body;
  const users = await new Promise(r => db.all("SELECT DISTINCT phone FROM messages WHERE phone IS NOT NULL", (_, rows) => r(rows.map(x => x.phone))));
  for (const phone of users) {
    await send(phone, { body: { text } });
  }
  res.sendStatus(200);
});

app.post("/send", async (req, res) => {
  let { to, text, btn1, btn2 } = req.body;
  const buttons = [];
  if (btn1) buttons.push({type:"reply",reply:{id:"custom1",title:btn1}});
  if (btn2) buttons.push({type:"reply",reply:{id:"custom2",title:btn2}});

  const payload = { body: { text } };
  if (buttons.length > 0) payload.action = { buttons };

  if (to) {
    await send(to, payload);
  } else {
    const users = await new Promise(r => db.all("SELECT DISTINCT phone FROM messages WHERE phone IS NOT NULL", (_, rows) => r(rows.map(x => x.phone))));
    for (const phone of users) await send(phone, payload);
  }
  res.sendStatus(200);
});

app.post("/package", (req, res) => {
  const { cat, title, price } = req.body;
  db.run("INSERT INTO packages (category,title,price) VALUES (?,?,?)", [cat, title, price]);
  res.sendStatus(200);
});

app.delete("/package/:id", (req, res) => {
  db.run("DELETE FROM packages WHERE id=?", [req.params.id]);
  res.sendStatus(200);
});

// ====================== BOT FLOW ======================
const mainMenu = (to) => send(to, {
  body: { text: "*Welcome to BlackLab Systems*\nKenya's #1 Instant Bundles\n\nWhat do you want today?" },
  action: { buttons: [
    {type:"reply",reply:{id:"packages",title:"See Packages"}},
    {type:"reply",reply:{id:"about",title:"About Us"}}
  ]}
});

app.post("/webhook", async (req, res) => {
  try {
    const msgs = req.body.entry?.[0]?.changes?.[0]?.value?.messages || [];
    for (const msg of msgs) {
      if (processed.has(msg.id)) continue;
      processed.add(msg.id);

      const from = msg.from;
      const btn = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "";
      const text = msg.text?.body?.trim() || "";

      stats.received++;
      db.run("INSERT INTO messages (phone,direction,content) VALUES (?,?,?)", [from, "in", text||btn||"media"]);

      if (btn === "packages") {
        send(from, {
          body: { text: "Choose category:" },
          action: { buttons: [
            {type:"reply",reply:{id:"cat_data",title:"Data"}},
            {type:"reply",reply:{id:"cat_minutes",title:"Minutes"}},
            {type:"reply",reply:{id:"cat_sms",title:"SMS"}}
          ]}
        });
        continue;
      }

      mainMenu(from);
    }
    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN)
    return res.send(req.query["hub.challenge"]);
  res.sendStatus(403);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("BLACKLAB GOD MODE IS LIVE");
  console.log("Dashboard:", `https://${process.env.RENDER_EXTERNAL_HOSTNAME || "your-app"}.onrender.com`);
});
