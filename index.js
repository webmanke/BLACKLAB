const express = require("express");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const db = new sqlite3.Database("./blacklab.db");

// INIT DATABASE
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    phone TEXT,
    direction TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    phone TEXT,
    mpesa TEXT,
    package TEXT,
    status TEXT DEFAULT 'pending',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY,
    category TEXT,
    title TEXT,
    price INTEGER
  )`);
  // Default packages (you can change/delete/add from dashboard)
  db.run("INSERT OR IGNORE INTO packages (category, title, price) VALUES "+
    "('data','1GB • Daily',29),('data','3GB • Weekly',69),('data','10GB • Monthly',179),('minutes','100 Minutes',50),('sms','500 SMS',30)");
});

let stats = { received: 0, sent: 0, startTime: Date.now() };
const processed = new Set();
const sessions = new Map();
const HEADER_IMG = "https://i.imgur.com/elSEhEg.jpeg";

// ====================== SEND MESSAGE (ONE MESSAGE WITH IMAGE) ======================
const send = async (to, payload) => {
  try {
    const full = {
      messaging_product: "whatsapp", to,
      type: "interactive",
      interactive: {
        type: "button",
        header: { type: "image", image: { link: HEADER_IMG } },
        ...payload
      }
    };
    await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, full, {
      headers: { Authorization: `Bearer ${WA_TOKEN}` }
    });
    stats.sent++;
    db.run("INSERT INTO messages (phone,direction,content) VALUES (?,?,?)", [to,"out",payload.body?.text || "Menu"]);
  } catch (e) {
    db.run("INSERT INTO messages (phone,direction,content) VALUES (?,?,?)", [to,"out","ERROR: "+e.message]);
  }
};

// ====================== DASHBOARD (GOD MODE) ======================
app.get("/", async (req, res) => {
  const uptime = Math.floor((Date.now() - stats.startTime)/1000);
  const h = String(Math.floor(uptime/3600)).padStart(2,"0");
  const m = String(Math.floor((uptime%3600)/60)).padStart(2,"0");
  const s = String(uptime%60).padStart(2,"0");

  const users = await new Promise(r => db.all("SELECT DISTINCT phone FROM messages WHERE phone IS NOT NULL ORDER BY timestamp DESC",(_,rows)=>r(rows)));
  const orders = await new Promise(r => db.all("SELECT * FROM orders ORDER BY id DESC LIMIT 20",(_,rows)=>r(rows)));
  const packages = await new Promise(r => db.all("SELECT * FROM packages",(_,rows)=>r(rows)));

  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BlackLab • God Mode</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<style>
  body{margin:0;font-family:'Inter',sans-serif;background:#f8fafc;color:#1e293b;font-size:14px}
  .header{background:linear-gradient(135deg,#0044ff,#0066ff);color:#fff;padding:2rem;text-align:center}
  .logo{font-size:2.5rem;font-weight:700}
  .container{max-width:1300px;margin:2rem auto;padding:0 1rem}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem;margin-bottom:2rem}
  .card{background:#fff;border-radius:12px;padding:1.5rem;box-shadow:0 4px 20px rgba(0,0,0,0.08);margin-bottom:1.5rem}
  .card h3{margin:0 0 1rem;font-size:1.1rem}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th,td{padding:10px;border:1px solid #ddd;text-align:left}
  th{background:#f1f5f9}
  input,textarea,select,button{width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #ccc}
  button{background:#10b981;color:#fff;border:none;cursor:pointer;font-weight:600}
  .ping{background:#0f172a;color:#0f0;padding:15px;border-radius:12px;text-align:center;font-family:monospace;font-size:1.1rem}
</style>
</head><body>
<div class="header"><h1 class="logo">BlackLab • GOD MODE</h1><div class="ping">PING: BOT IS ALIVE • ${new Date().toLocaleTimeString()}</div></div>
<div class="container">

<div class="grid">
  <div class="card"><h3>Stats</h3><strong>Received:</strong> \( {stats.received}<br><strong>Sent:</strong> \){stats.sent}<br><strong>Uptime:</strong> \( {h}: \){m}:${s}</div>
  <div class="card"><h3>Quick Broadcast</h3>
    <textarea id="btext" placeholder="Message to all users..."></textarea>
    <button onclick="broadcast()">BROADCAST TO ALL</button>
  </div>
</div>

<div class="card"><h3>Send Custom Message</h3>
  <input type="text" id="to" placeholder="Phone number (or leave empty for all)">
  <textarea id="text" rows="4" placeholder="Message text..."></textarea>
  <input type="text" id="btn1" placeholder="Button 1 text (optional)">
  <input type="text" id="btn2" placeholder="Button 2 text (optional)">
  <button onclick="customSend()">SEND MESSAGE</button>
</div>

<div class="card"><h3>Manage Packages</h3><table><tr><th>Category</th><th>Title</th><th>Price (KSh)</th><th>Action</th></tr>
  \( {packages.map(p=>`<tr><td> \){p.category}</td><td>\( {p.title}</td><td> \){p.price}</td><td><button onclick="delPkg(${p.id})">Delete</button></td></tr>`).join('')}
</table>
<form id="addpkg">
  <select name="cat"><option>data</option><option>minutes</option><option>sms</option></select>
  <input name="title" placeholder="Title">
  <input name="price" type="number" placeholder="Price">
  <button type="submit">ADD PACKAGE</button>
</form>
</div>

<div class="card"><h3>Recent Orders (20)</h3><table><tr><th>Time</th><th>Phone</th><th>M-Pesa</th><th>Package</th><th>Status</th></tr>
  \( {orders.map(o=>`<tr><td> \){new Date(o.timestamp).toLocaleString()}</td><td>\( {o.phone}</td><td> \){o.mpesa}</td><td>\( {o.package}</td><td> \){o.status}</td></tr>`).join('')}
</table></div>

<div class="card"><h3>User Statistics</h3>
  ${users.map(u=>`<div style="padding:8px;border-bottom:1px solid #eee;display:flex;justify-content:space-between">
    <strong>${u.phone}</strong>
    <span>Sent: ${await new Promise(r=>db.get("SELECT COUNT(*) c FROM messages WHERE phone=? AND direction='in'",[u.phone],(_,x)=>r(x.c||0)))} | 
          Received: ${await new Promise(r=>db.get("SELECT COUNT(*) c FROM messages WHERE phone=? AND direction='out'",[u.phone],(_,x)=>r(x.c||0)))}</span>
  </div>`).join('')}
</div>

</div>

<script>
async function broadcast(){ customSend(true); }
async function customSend(all=false){
  const to = all ? null : document.getElementById('to').value;
  const text = document.getElementById('text').value || document.getElementById('btext').value;
  const b1 = document.getElementById('btn1').value;
  const b2 = document.getElementById('btn2').value;
  if(!text) return alert("Message required");
  await fetch('/send',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({to, text, btn1:b1||null, btn2:b2||null})
  });
  alert("Sent!");
}
async function delPkg(id){
  await fetch('/delpkg/'+id,{method:'DELETE'});
  location.reload();
}
document.getElementById('addpkg').onsubmit = async e=>{
  e.preventDefault();
  const f = new FormData(e.target);
  await fetch('/addpkg', {method:'POST', body:f});
  location.reload();
};
setInterval(()=>location.reload(), 120000); // auto refresh every 2 min
</script>
</body></html>`);
});

// ====================== ADMIN ENDPOINTS ======================
app.post("/send", async (req, res) => {
  let { to, text, btn1, btn2 } = req.body;
  const users = await new Promise(r => db.all("SELECT DISTINCT phone FROM messages WHERE phone IS NOT NULL",(_,rows)=>r(rows.map(x=>x.phone))));
  const targets = to ? [to] : users;

  for (const phone of targets) {
    const buttons = [];
    if (btn1) buttons.push({type:"reply",reply:{id:"b1",title:btn1}});
    if (btn2) buttons.push({type:"reply",reply:{id:"b2",title:btn2}});

    const payload = { body: { text } };
    if (buttons.length>0) payload.action = { buttons };

    await send(phone, payload);
  }
  res.sendStatus(200);
});

app.post("/addpkg", (req, res) => {
  const { cat, title, price } = req.body;
  db.run("INSERT INTO packages (category,title,price) VALUES (?,?,?)",[cat,title,price]);
  res.sendStatus(200);
});

app.delete("/delpkg/:id", (req, res) => {
  db.run("DELETE FROM packages WHERE id=?", [req.params.id]);
  res.sendStatus(200);
});

// ====================== BOT FLOW (BEST IN CLASS) ======================
const mainMenu = (to) => send(to, {
  body: { text: "*Welcome to BlackLab Systems*\nKenya's #1 Instant Bundles\n\nChoose an option:" },
  action: { buttons: [
    {type:"reply",reply:{id:"packages",title:"See Packages"}},
    {type:"reply",reply:{id:"about",title:"About Us"}}
  ]}
});

const chooseCategory = (to) => send(to, {
  body: { text: "Select package type:" },
  action: { buttons: [
    {type:"reply",reply:{id:"cat_data",title:"Data"}},
    {type:"reply",reply:{id:"cat_minutes",title:"Minutes"}},
    {type:"reply",reply:{id:"cat_sms",title:"SMS"}}
  ]}
});

const showPackages = async (to, cat) => {
  const pkgs = await new Promise(r => db.all("SELECT * FROM packages WHERE category=?",[cat],(_,rows)=>r(rows)));
  const buttons = pkgs.slice(0,3).map(p => ({type:"reply",reply:{id:"pkg_"+p.id,title:p.title}}));
  send(to, {
    body: { text: `*${cat.toUpperCase()} PACKAGES*\nChoose one:` },
    action: { buttons }
  });
};

// ====================== WEBHOOK ======================
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
      db.run("INSERT INTO messages (phone,direction,content) VALUES (?,?,?)",[from,"in",text||btn||"media"]);

      const ses = sessions.get(from) || {};

      if (btn === "packages") { chooseCategory(from); continue; }
      if (btn.startsWith("cat_")) { showPackages(from, btn.split("_")[1]); continue; }
      if (btn.startsWith("pkg_")) {
        sessions.set(from, {step:"mpesa"});
        send(from, { body: { text: "Buy for:\n• Myself → your number will be used\n• Someone else → enter their details" }, action: { buttons: [
          {type:"reply",reply:{id:"self",title:"Myself"}},
          {type:"reply",reply:{id:"other",title:"Someone Else"}}
        ]}});
        continue;
      }
      if (btn === "self") {
        sessions.delete(from);
        db.run("INSERT INTO orders (phone,package,status) VALUES (?,?,?)",[from, "Selected Package", "awaiting_payment"]);
        send(from, { body: { text: "Perfect! M-Pesa STK Push coming in seconds...\nAccept to get bundle instantly!" }});
        continue;
      }
      if (btn === "other") {
        sessions.set(from, {step:"mpesa"});
        send(from, { body: { text: "Send the *M-Pesa number* that will pay (07xxxxxxxx)" }});
        continue;
      }

      if (ses.step === "mpesa" && text.match(/^0[67]\d{8}$/)) {
        sessions.set(from, {step:"recipient", mpesa:text});
        send(from, { body: { text: `M-Pesa: *${text}*\n\nNow send the *recipient number* to receive bundle` }});
        continue;
      }
      if (ses.step === "recipient" && text.match(/^0[67]\d{8}$/)) {
        sessions.delete(from);
        db.run("INSERT INTO orders (phone,mpesa,package,status) VALUES (?,?,?,?)",[from, ses.mpesa, "Selected Package", "awaiting_payment"]);
        send(from, { body: { text: "Order recorded!\nM-Pesa STK Push sent to "+ses.mpesa+"\nBundle delivered instantly after payment!" }});
        continue;
      }

      mainMenu(from);
    }
    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(500);
  }
});

app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN)
    return res.send(req.query["hub.challenge"]);
  res.sendStatus(403);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("BlackLab GOD MODE LIVE"));
