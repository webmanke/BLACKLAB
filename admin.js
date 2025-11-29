const express = require("express");
const storage = require("./storage");
const axios = require("axios");
const router = express.Router();

const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const HEADER_IMG = "https://i.imgur.com/elSEhEg.jpeg";
const FOOTER = "BlackLab Systems • Instant • 24/7";

router.get("/", async (req, res) => {
  const packages = storage.getPackages();
  const orders = storage.getOrders();
  const users = storage.getUsers();

  const userList = users.map(p => `
    <div style="padding:10px;border-bottom:1px solid #eee;display:flex;justify-content:space-between">
      <strong>${p}</strong>
      <button onclick="fill('${p}')">Message</button>
    </div>`).join('');

  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BlackLab • EMPIRE CONTROL</title>
  <style>
    body{font-family:system-ui;background:#0f172a;color:#e2e8f0;margin:0}
    .h{background:#1e293b;padding:2rem;text-align:center;color:#60a5fa}
    .logo{font-size:3rem;font-weight:900}
    .c{max-width:1200px;margin:2rem auto;padding:1rem}
    .card{background:#1e293b;border-radius:16px;padding:2rem;margin-bottom:2rem;box-shadow:0 10px 30px rgba(0,0,0,0.5)}
    input,textarea,button,select{width:100%;padding:14px;margin:8px 0;border-radius:12px;border:none}
    button{background:#60a5fa;color:#000;font-weight:bold;cursor:pointer}
    table{width:100%;border-collapse:collapse}
    th,td{padding:12px;border:1px solid #334155;text-align:left}
    th{background:#334155}
  </style>
  </head><body>
  <div class="h"><div class="logo">BLACKLAB EMPIRE</div><div style="margin-top:10px;font-size:1.5rem">LIVE • ${new Date().toLocaleString()}</div></div>
  <div class="c">
    <div class="card"><h2>Customers (\( {users.length})</h2> \){userList}</div>
    <div class="card"><h2>Send Message</h2>
      <input id="to" placeholder="Phone (optional)"><textarea id="msg" rows="5" placeholder="Your message..."></textarea>
      <input id="b1" placeholder="Button 1"><input id="b2" placeholder="Button 2">
      <button onclick="send()">SEND TO ALL OR ONE</button>
    </div>
    <div class="card"><h2>Packages</h2><table><tr><th>Cat</th><th>Title</th><th>Price</th></tr>
      \( {packages.map(p=>`<tr><td> \){p.category}</td><td>\( {p.title}</td><td> \){p.price}</td></tr>`).join('')}
    </table>
      <select id="cat"><option>data</option><option>minutes</option><option>sms</option></select>
      <input id="title" placeholder="Title"><input id="price" placeholder="Price" type="number">
      <button onclick="add()">ADD PACKAGE</button>
    </div>
  </div>
  <script>
    function fill(p){ document.getElementById('to').value = p; }
    async function send(){
      const to = document.getElementById('to').value || null;
      const msg = document.getElementById('msg').value;
      const b1 = document.getElementById('b1').value || null;
      const b2 = document.getElementById('b2').value || null;
      await fetch('/send', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,msg,b1,b2})});
      alert("Sent!");
    }
    async function add(){
      const cat = document.getElementById('cat').value;
      const title = document.getElementById('title').value;
      const price = document.getElementById('price').value;
      await fetch('/addpkg', {method:'POST',body:new URLSearchParams({cat,title,price})});
      location.reload();
    }
  </script>
  </body></html>`);
});

router.post("/send", async (req, res) => {
  let { to, msg, b1, b2 } = req.body;
  const buttons = [];
  if (b1) buttons.push({ type: "reply", reply: { id: "1", title: b1 } });
  if (b2) buttons.push({ type: "reply", reply: { id: "2", title: b2 } });
  const targets = to ? [to] : storage.getUsers();
  for (const p of targets) {
    await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
      messaging_product: "whatsapp", to: p,
      type: "interactive",
      interactive: { type: "button", header: { type: "image", image: { link: HEADER_IMG } }, body: { text: msg }, footer: { text: FOOTER }, action: { buttons } }
    }, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
  }
  res.sendStatus(200);
});

router.post("/addpkg", (req, res) => {
  const { cat, title, price } = req.body;
  storage.addPackage({ id: Date.now(), category: cat, title, price: Number(price) });
  res.sendStatus(200);
});

module.exports = router;
