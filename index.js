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
  const defaultPkgs = [
    ["data", "1GB Daily", 29],
    ["data", "3GB Weekly", 69],
    ["data", "10GB Monthly", 179],
    ["data", "Unlimited Night", 49],
    ["minutes", "100 Minutes", 50],
    ["sms", "500 SMS", 30]
  ];
  const stmt = db.prepare("INSERT OR IGNORE INTO packages (category, title, price) VALUES (?, ?, ?)");
  defaultPkgs.forEach(p => stmt.run(p));
  stmt.finalize();
});

let stats = { received: 0, sent: 0, startTime: Date.now() };
const processed = new Set();
const HEADER_IMG = "https://i.imgur.com/elSEhEg.jpeg";
const FOOTER_TEXT = "BlackLab Systems • Instant • Trusted • 24/7";

// UNIVERSAL SEND FUNCTION — IMAGE + TEXT + BUTTONS + FOOTER
const send = async (to, { body, buttons = [] }) => {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        header: { type: "image", image: { link: HEADER_IMG } },
        body: { text: body },
        footer: { text: FOOTER_TEXT },
        action: { buttons }
      }
    };

    await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, payload, {
      headers: { Authorization: `Bearer ${WA_TOKEN}` }
    });

    stats.sent++;
    db.run("INSERT INTO messages (phone,direction,content) VALUES (?,?,?)", [to, "out", body]);
  } catch (e) {
    console.error("Send failed:", e.response?.data || e.message);
  }
};

// MAIN DASHBOARD — GOD MODE
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

  const packageRows = packages.length ? packages.map(p => `
    <tr>
      <td>${p.category.toUpperCase()}</td>
      <td>${p.title}</td>
      <td>KSh ${p.price}</td>
      <td><button class="del" onclick="delPkg(${p.id})">Delete</button></td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="text-align:center;color:#888">No packages yet</td></tr>';

  const orderRows = orders.length ? orders.map(o => `
    <tr>
      <td>${new Date(o.timestamp).toLocaleString()}</td>
      <td>${o.phone}</td>
      <td>${o.mpesa || "-"}</td>
      <td>${o.package}</td>
      <td><span style="color:#f59e0b;font-weight:600">${o.status}</span></td>
    </tr>
  `).join('') : '<tr><td colspan="5"><td style="text-align:center;color:#888">No orders yet</td></tr>';

  const userList = users.length ? await Promise.all(users.map(async u => {
    const [inCount, outCount] = await Promise.all([
      new Promise(r => db.get("SELECT COUNT(*) c FROM messages WHERE phone=? AND direction='in'", [u.phone], (_, x) => r(x.c))),
      new Promise(r => db.get("SELECT COUNT(*) c FROM messages WHERE phone=? AND direction='out'", [u.phone], (_, x) => r(x.c)))
    ]);
    return `<div class="user"><strong>\( {u.phone}</strong> <span>In: \){inCount} | Out: ${outCount}</span></div>`;
  })).then(arr => arr.join('')) : '<p style="color:#888;text-align:center">No users yet</p>';

  res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BlackLab • GOD MODE</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body{margin:0;font-family:'Inter',sans-serif;background:#f8fafc;color:#1e293b}
  .h{background:linear-gradient(135deg,#0044ff,#0066ff);color:#fff;padding:3rem;text-align:center}
  .logo{font-size:2.8rem;font-weight:800}
  .ping{background:#000;color:#0f0;padding:12px;border-radius:12px;font:1.3rem monospace;margin-top:10px}
  .c{max-width:1400px;margin:2rem auto;padding:0 1rem}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1.5rem}
  .card{background:#fff;border-radius:16px;padding:2rem;box-shadow:0 10px 40px rgba(0,0,0,0.12);margin-bottom:2rem}
  .card h3{font-size:1.4rem;margin-bottom:1rem;color:#1e40af}
  table{width:100%;border-collapse:collapse}
  th,td{padding:14px;text-align:left;border-bottom:1px solid #e2e8f0}
  th{background:#f1f5f9;font-weight:600}
  input,textarea,select,button{width:100%;padding:14px;margin:10px 0;border-radius:12px;border:1px solid #cbd5e1;font-size:1rem}
  button{background:#10b981;color:white;border:none;font-weight:700;cursor:pointer}
  button:hover{background:#059669}
  .del{background:#ef4444}
  .del:hover{background:#dc2626}
  .user{padding:12px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between}
</style>
</head><body>
<div class="h">
  <h1 class="logo">BlackLab Systems</h1>
  <div class="ping">BOT IS 100% ALIVE • ${new Date().toLocaleString()}</div>
</div>
<div class="c">

<div class="grid">
  <div class="card"><h3>Live Stats</h3>
    <strong>Messages In:</strong> ${stats.received}<br>
    <strong>Messages Out:</strong> ${stats.sent}<br>
    <strong>Uptime:</strong> \( {h}h \){m}m ${s}s
  </div>
  <div class="card"><h3>Quick Broadcast</h3>
    <textarea id="btext" rows="4" placeholder="Send to all customers instantly..."></textarea>
    <button onclick="broadcast()">BROADCAST NOW</button>
  </div>
</div>

<div class="card">
  <h3>Send Custom Message</h3>
  <input type="text" id="phone" placeholder="Phone (optional)">
  <textarea id="text" rows="4" placeholder="Your message..."></textarea>
  <input type="text" id="b1" placeholder="Button 1">
  <input type="text" id="b2" placeholder="Button 2">
  <button onclick="sendMsg()">SEND</button>
</div>

<div class="card">
  <h3>Packages</h3>
  <table>${packageRows}</table>
  <div style="margin-top:20px;display:grid;grid-template-columns:1fr 2fr 1fr auto;gap:12px">
    <select id="cat"><option>data</option><option>minutes</option><option>sms</option></select>
    <input id="title" placeholder="Title">
    <input id="price" type="number" placeholder="Price">
    <button onclick="addPkg()">ADD</button>
  </div>
</div>

<div class="card"><h3>Recent Orders</h3><table>${orderRows}</table></div>
<div class="card"><h3>User Activity</h3>${userList}</div>

</div>

<script>
async function broadcast(){
  const text = document.getElementById('btext').value;
  if(!text) return alert("Write something");
  await fetch('/broadcast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
  alert("Broadcast sent to all users!");
}
async function sendMsg(){
  const to = document.getElementById('phone').value || null;
  const text = document.getElementById('text').value;
  const b1 = document.getElementById('b1').value || null;
  const b2 = document.getElementById('b2').value || null;
  if(!text) return alert("Message required");
  await fetch('/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,text,btn1:b1,btn2:b2})});
  alert("Message sent!");
}
async function addPkg(){
  const cat = document.getElementById('cat').value;
  const title = document.getElementById('title').value;
  const price = document.getElementById('price').value;
  if(!title || !price) return alert("Fill all");
  await fetch('/package',{method:'POST',body:new URLSearchParams({cat,title,price})});
  location.reload();
}
async function delPkg(id){
  if(confirm("Delete package?")) {
    await fetch('/package/'+id,{method:'DELETE'});
    location.reload();
  }
}
setInterval(()=>location.reload(), 300000);
</script>
</body></html>`);
});

// ADMIN ENDPOINTS
app.post("/broadcast", async (req, res) => {
  const { text } = req.body;
  const users = await new Promise(r => db.all("SELECT DISTINCT phone FROM messages WHERE phone IS NOT NULL", (_, rows) => r(rows.map(x => x.phone))));
  for (const p of users) await send(p, { body: text });
  res.sendStatus(200);
});

app.post("/send", async (req, res) => {
  let { to, text, btn1, btn2 } = req.body;
  const buttons = [];
  if (btn1) buttons.push({type:"reply",reply:{id:"c1",title:btn1}});
  if (btn2 && buttons.push({type:"reply",reply:{id:"c2",title:btn2}});

  const targets = to ? [to] : await new Promise(r => db.all("SELECT DISTINCT phone FROM messages WHERE phone IS NOT NULL", (_, rows) => r(rows.map(x => x.phone))));
  for (const p of targets) await send(p, { body: text, buttons });
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

// BOT FLOW
const mainMenu = (to) => send(to, {
  body: "*Welcome to BlackLab Systems*\nKenya's #1 Instant Data Vendor\n\nChoose an option:",
  buttons: [
    {type:"reply",reply:{id:"packages",title:"See Packages"}},
    {type:"reply",reply:{id:"about",title:"About Us"}}
  ]
});

app.post("/webhook", async (req, res) => {
  try {
    const msgs = req.body.entry?.[0]?.changes?.[0]?.value?.messages || [];
    for (const msg of msgs) {
      if (processed.has(msg.id)) continue;
      processed.add(msg.id);

      const from = msg.from;
      const btn = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "";

      stats.received++;
      db.run("INSERT INTO messages (phone,direction,content) VALUES (?,?,?)", [from, "in", btn || msg.text?.body || "media"]);

      if (btn === "packages") {
        send(from, {
          body: "Select package type:",
          buttons: [
            {type:"reply",reply:{id:"cat_data",title:"Data Bundles"}},
            {type:"reply",reply:{id:"cat_minutes",title:"Voice Minutes"}},
            {type:"reply",reply:{id:"cat_sms",title:"SMS Bundles"}}
          ]
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
app.listen(PORT, () => console.log("BLACKLAB GOD MODE IS FULLY LIVE"));
