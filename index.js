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
  db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, direction TEXT, content TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, mpesa TEXT, recipient TEXT, package TEXT, status TEXT DEFAULT 'pending', timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS packages (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT, title TEXT, price INTEGER)`);

  // Default packages
  const pkgs = [
    ["data", "1GB • 24hrs", 29], ["data", "3GB • 7 Days", 69], ["data", "10GB • 30 Days", 179], ["data", "Unlimited Night", 49],
    ["minutes", "100 Minutes", 50], ["sms", "500 SMS", 30]
  ];
  const stmt = db.prepare("INSERT OR IGNORE INTO packages (category, title, price) VALUES (?, ?, ?)");
  pkgs.forEach(p => stmt.run(p));
  stmt.finalize();
});

let stats = { received: 0, sent: 0, startTime: Date.now() };
const processed = new Set();
const sessions = new Map();
const HEADER_IMG = "https://i.imgur.com/elSEhEg.jpeg";
const FOOTER = "BlackLab Systems • Instant Delivery • 24/7";

// UNIVERSAL SEND
const send = async (to, { body, buttons = [] }) => {
  try {
    const payload = {
      messaging_product: "whatsapp", to,
      type: "interactive",
      interactive: {
        type: "button",
        header: { type: "image", image: { link: HEADER_IMG } },
        body: { text: body },
        footer: { text: FOOTER },
        action: { buttons }
      }
    };
    await axios.post(`https://graph.facebook.com/v20.0/\( {PHONE_NUMBER_ID}/messages`, payload, { headers: { Authorization: `Bearer \){WA_TOKEN}` } });
    stats.sent++;
    db.run("INSERT INTO messages (phone,direction,content) VALUES (?,?,?)", [to, "out", body.split("\n")[0]]);
  } catch (e) { console.error("Send error:", e.message); }
};

// MAIN MENU
const mainMenu = (to) => send(to, {
  body: "*Welcome to BlackLab Systems*\nKenya's #1 Instant Data Vendor\n\nChoose an option:",
  buttons: [
    { type: "reply", reply: { id: "packages", title: "See Packages" } },
    { type: "reply", reply: { id: "about", title: "About Us" } },
    { type: "reply", reply: { id: "contact", title: "Contact Us" } }
  ]
});

// PACKAGE CATEGORIES
const packageMenu = (to) => send(to, {
  body: "Select package type:",
  buttons: [
    { type: "reply", reply: { id: "data", title: "Data Bundles" } },
    { type: "reply", reply: { id: "minutes", title: "Voice Minutes" } },
    { type: "reply", reply: { id: "sms", title: "SMS Bundles" } }
  ]
});

// SHOW PACKAGES
const showPackages = async (to, cat) => {
  const rows = await new Promise(r => db.all("SELECT * FROM packages WHERE category=?", [cat], (_, rows) => r(rows)));
  const buttons = rows.slice(0, 3).map(p => ({ type: "reply", reply: { id: `pkg_${p.id}`, title: p.title } }));
  send(to, {
    body: `*{${cat.toUpperCase()} PACKAGES}*\nChoose your bundle:`,
    buttons
  });
};

// DASHBOARD — SUPER GOD MODE
app.get("/", async (req, res) => {
  const users = await new Promise(r => db.all("SELECT DISTINCT phone FROM messages ORDER BY timestamp DESC LIMIT 100", (_, rows) => r(rows)));
  const orders = await new Promise(r => db.all("SELECT * FROM orders ORDER BY id DESC LIMIT 20", (_, rows) => r(rows)));
  const packages = await new Promise(r => db.all("SELECT * FROM packages", (_, rows) => r(rows)));

  const userList = users.map(u => `
    <div style="padding:12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center">
      <strong>${u.phone}</strong>
      <button onclick="sendTo('${u.phone}')" style="background:#10b981;color:#fff;border:none;padding:8px 16px;border-radius:8px">Message</button>
    </div>`).join('');

  const pkgList = packages.map(p => `<tr><td>\( {p.category}</td><td> \){p.title}</td><td>KSh \( {p.price}</td><td><button onclick="del( \){p.id})" style="background:#ef4444;color:#fff;padding:6px 12px;border:none;border-radius:6px">Delete</button></td></tr>`).join('');

  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BlackLab • SUPER BOT</title>
  <style>
    body{font-family:Arial;background:#f8fafc;color:#333;margin:0}
    .header{background:linear-gradient(135deg,#0044ff,#0066ff);color:#fff;padding:2rem;text-align:center}
    .logo{font-size:2.8rem;font-weight:900}
    .ping{background:#000;color:#0f0;padding:12px;font:1.4rem monospace}
    .container{max-width:1200px;margin:2rem auto;padding:1rem}
    .card{background:#fff;border-radius:16px;padding:2rem;box-shadow:0 10px 30px rgba(0,0,0,0.1);margin-bottom:2rem}
    button{background:#10b981;color:#fff;border:none;padding:12px 20px;border-radius:10px;cursor:pointer;font-weight:bold}
    input,textarea,select{width:100%;padding:12px;margin:8px 0;border-radius:10px;border:1px solid #ccc}
  </style>
  </head><body>
  <div class="header"><h1 class="logo">BlackLab SUPER BOT</h1><div class="ping">LIVE • ${new Date().toLocaleString()}</div></div>
  <div class="container">
    <div class="card"><h2>Customers (\( {users.length})</h2><div style="max-height:400px;overflow-y:auto"> \){userList || "No customers yet"}</div></div>
    <div class="card"><h2>Send Message</h2>
      <input id="to" placeholder="Phone (leave empty = all)"><textarea id="msg" rows="4" placeholder="Message"></textarea>
      <input id="b1" placeholder="Button 1"><input id="b2" placeholder="Button 2">
      <button onclick="sendMsg()">SEND</button>
    </div>
    <div class="card"><h2>Packages</h2><table style="width:100%"><tr><th>Cat</th><th>Title</th><th>Price</th><th></th></tr>${pkgList}</table></div>
    <div class="card"><h2>Recent Orders</h2><table style="width:100%"><tr><th>Time</th><th>Phone</th><th>Package</th><th>Status</th></tr>
      \( {orders.map(o=>`<tr><td> \){new Date(o.timestamp).toLocaleString()}</td><td>\( {o.phone}</td><td> \){o.package}</td><td>${o.status}</td></tr>`).join('')}
    </table></div>
  </div>
  <script>
    function sendTo(p){document.getElementById('to').value=p;}
    async function sendMsg(){
      const to = document.getElementById('to').value || null;
      const msg = document.getElementById('msg').value;
      const b1 = document.getElementById('b1').value || null;
      const b2 = document.getElementById('b2').value || null;
      if(!msg) return alert("Write message");
      await fetch('/admin-send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,msg,b1,b2})});
      alert("Sent!");
    }
    async function del(id){if(confirm("Delete?")){await fetch('/pkg/'+id,{method:'DELETE'});location.reload();}}
  </script>
  </body></html>`);
});

// ADMIN SEND
app.post("/admin-send", async (req, res) => {
  let { to, msg, b1, b2 } = req.body;
  const buttons = [];
  if (b1) buttons.push({ type: "reply", reply: { id: "1", title: b1 } });
  if (b2) buttons.push({ type: "reply", reply: { id: "2", title: b2 } });
  const targets = to ? [to] : await new Promise(r => db.all("SELECT DISTINCT phone FROM messages", (_, rows) => r(rows.map(x => x.phone))));
  for (const p of targets) await send(p, { body: msg, buttons });
  res.sendStatus(200);
});

app.delete("/pkg/:id", (req, res) => {
  db.run("DELETE FROM packages WHERE id=?", [req.params.id]);
  res.sendStatus(200);
});

// WEBHOOK — FULL FLOW
app.post("/webhook", async (req, res) => {
  try {
    const msgs = req.body.entry?.[0]?.changes?.[0]?.value?.messages || [];
    for (const msg of msgs) {
      if (processed.has(msg.id)) continue;
      processed.add(msg.id);

      const from = msg.from;
      const btn = msg.interactive?.button_reply?.id || "";
      const text = msg.text?.body?.trim() || "";

      stats.received++;
      db.run("INSERT INTO messages (phone,direction,content) VALUES (?,?,?)", [from, "in", btn || text]);

      if (btn === "packages") { packageMenu(from); continue; }
      if (["data","minutes","sms"].includes(btn)) { showPackages(from, btn); continue; }
      if (btn === "about") { send(from, { body: "*About BlackLab Systems*\n\nKenya's fastest instant vendor since 2024.\n• 1M+ bundles delivered\n• 100% automated\n• Lowest prices\n• Instant delivery\n• 24/7 support\n\nThank you for trusting us!", buttons: [{ type: "reply", reply: { id: "main", title: "Back to Menu" } }] }); continue; }
      if (btn === "contact") { send(from, { body: "*Contact Us*\nPhone: +254 712 345 678\nEmail: support@blacklab.co.ke\nWe reply in <2 mins!", buttons: [{ type: "reply", reply: { id: "main", title: "Back" } }] }); continue; }
      if (btn === "main") { mainMenu(from); continue; }

      mainMenu(from);
    }
    res.sendStatus(200);
  } catch (e) { res.sendStatus(500); }
});

app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN)
    return res.send(req.query["hub.challenge"]);
  res.sendStatus(403);
});

app.listen(process.env.PORT || 3000, () => console.log("BLACKLAB SUPER BOT IS LIVE AND UNSTOPPABLE"));
