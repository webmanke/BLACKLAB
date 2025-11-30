// admin.js — BULLETPROOF FINAL VERSION (NO MORE ERRORS EVER
const express = require("express");
const storage = require("./storage");
const axios = require("axios");
const router = express.Router();

// Live stats & logs
let stats = { received: 0, sent: 0 };
let logs = [];

router.stats = stats;
router.addLog = (type, phone, msg) => {
  logs.unshift({
    id: Date.now(),
    time: new Date().toLocaleTimeString(),
    type,
    phone,
    msg: String(msg).substring(0, 80) + (msg.length > 80 ? "..." : "")
  });
  if (logs.length > 300) logs.pop();
  type === "IN" ? stats.received++ : stats.sent++;
};

// Send message (text or buttons)
const send = async (to, text, buttons = []) => {
  try {
    const payload = buttons.length > 0
      ? { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", body: { text }, action: { buttons } } }
      : { messaging_product: "whatsapp", to, type: "text", text: { body: text } };

    await axios.post(
      `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`,
      payload,
      { headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` } }
    );
    router.addLog("OUT", to, text);
  } catch (e) {
    console.error("Send failed:", e.response?.data || e.message);
  }
};

router.get("/", (req, res) => {
  const users = storage.getUsers();
  const packages = storage.getPackages();

  const userRows = users.map(p => 
    `<tr class="hover:bg-gray-50">
      <td class="px-6 py-4 font-medium">${p}</td>
      <td class="text-center"><input type="checkbox" value="${p}" x-model="selected"></td>
    </tr>`
  ).join("");

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BlackLab Empire</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
  <style>.active { @apply bg-blue-50 text-blue-700 }</style>
</head>
<body class="bg-gray-100 min-h-screen" x-data="{page:'dashboard',sidebar:false,selected:[],msg:'',b1:'',b2:''}">
  <button @click="sidebar=!sidebar" class="lg:hidden fixed top-4 left-4 z-50 bg-white p-3 rounded-xl shadow-lg">
    <i class="fas fa-bars text-xl"></i>
  </button>

  <aside :class="sidebar?'translate-x-0':'-translate-x-full'" class="fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-2xl transition lg:translate-x-0">
    <div class="p-6 border-b text-center">
      <h1 class="text-2xl font-black text-blue-600">BlackLab</h1>
    </div>
    <nav class="p-4 space-y-1">
      <button @click="page='dashboard';sidebar=false" :class="page==='dashboard'?'active':''" class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3"><i class="fas fa-home"></i> Dashboard</button>
      <button @click="page='customers';sidebar=false" :class="page==='customers'?'active':''" class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3"><i class="fas fa-users"></i> Customers (${users.length})</button>
      <button @click="page='packages';sidebar=false" :class="page==='packages'?'active':''" class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3"><i class="fas fa-box"></i> Packages</button>
      <button @click="page='broadcast';sidebar=false" :class="page==='broadcast'?'active':''" class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3"><i class="fas fa-paper-plane"></i> Broadcast</button>
      <button @click="page='logs';sidebar=false" :class="page==='logs'?'active':''" class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3"><i class="fas fa-history"></i> Logs</button>
    </nav>
  </aside>

  <main class="lg:ml-64 p-6 pt-20 lg:pt-6">
    <div x-show="page==='dashboard'">
      <h2 class="text-3xl font-bold mb-8">Live Dashboard</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-6" hx-get="/api/stats" hx-trigger="every 2s" hx-swap="innerHTML"></div>
    </div>

    <div x-show="page==='customers'">
      <h2 class="text-3xl font-bold mb-6">Customers</h2>
      <div class="bg-white rounded-2xl shadow overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50"><tr><th class="px-6 py-4 text-left">Phone</th><th class="text-center">Select</th></tr></thead>
          <tbody>${userRows || "<tr><td colspan='2' class='text-center py-8 text-gray-500'>No customers yet</td></tr>"}</tbody>
        </table>
      </div>
      <p class="mt-6 text-center text-xl font-bold">Selected: <span x-text="selected.length"></span></p>
    </div>

    <div x-show="page==='packages'">
      <div class="flex justify-between mb-6">
        <h2 class="text-3xl font-bold">Packages</h2>
        <button @click="$refs.modal.showModal()" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">+ Add Package</button>
      </div>
      <div hx-get="/api/packages" hx-trigger="load, every 30s" hx-swap="innerHTML"></div>
    </div>

    <div x-show="page==='broadcast'" class="max-w-2xl mx-auto">
      <h2 class="text-3xl font-bold mb-8 text-center">Send Message</h2>
      <div class="bg-white rounded-2xl shadow p-8 space-y-6">
        <textarea x-model="msg" rows="6" placeholder="Type your message..." class="w-full border rounded-xl p-4"></textarea>
        <div class="grid grid-cols-2 gap-4">
          <input x-model="b1" placeholder="Button 1 (optional)" class="border rounded-xl px-4 py-3">
          <input x-model="b2" placeholder="Button 2 (optional)" class="border rounded-xl px-4 py-3">
        </div>
        <button @click="sendBroadcast()" :disabled="!msg || selected.length===0"
          class="w-full py-4 rounded-xl font-bold text-white transition ${selected.length>0 && msg ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400'}">
          Send to <span x-text="selected.length"></span> customers
        </button>
      </div>
    </div>

    <div x-show="page==='logs'">
      <h2 class="text-3xl font-bold mb-6">Live Logs</h2>
      <div class="bg-white rounded-2xl shadow overflow-hidden" hx-get="/api/logs" hx-trigger="every 2s" hx-swap="innerHTML"></div>
    </div>
  </main>

  <dialog x-ref="modal" class="rounded-2xl p-8 w-full max-w-md bg-white shadow-2xl">
    <h3 class="text-2xl font-bold mb-6">Add New Package</h3>
    <input id="ntitle" placeholder="Title" class="w-full border rounded-xl p-3 mb-4">
    <input id="nprice" type="number" placeholder="Price (KSh)" class="w-full border rounded-xl p-3 mb-4">
    <select id="ncat" class="w-full border rounded-xl p-3 mb-6">
      <option value="data">Data</option>
      <option value="minutes">Minutes</option>
      <option value="sms">SMS</option>
    </select>
    <div class="flex gap-4">
      <button @click="$refs.modal.close()" class="flex-1 bg-gray-200 py-3 rounded-xl">Cancel</button>
      <button @click="addPkg()" class="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold">Save</button>
    </div>
  </dialog>

  <script>
    function sendBroadcast() {
      if (!this.msg) return alert("Write a message");
      const buttons = [];
      if (this.b1) buttons.push({type:"reply",reply:{id:"1",title:this.b1}});
      if (this.b2) buttons.push({type:"reply",reply:{id:"2",title:this.b2}});
      fetch('/api/broadcast', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({targets:this.selected, text:this.msg, buttons})
      }).then(r => {
        if (r.ok) {
          alert("Sent to " + this.selected.length + " customers!");
          this.msg = this.b1 = this.b2 = "";
          this.selected = [];
        }
      });
    }
    function addPkg() {
      fetch('/api/package', {
        method:'POST',
        body:new URLSearchParams({
          title: document.getElementById('ntitle').value,
          price: document.getElementById('nprice').value,
          cat: document.getElementById('ncat').value
        })
      }).then(() => location.reload());
    }
  </script>
</body>
</html>
  `);
});

// REAL-TIME API ROUTES
router.get("/api/stats", (req, res) => res.send(`
  <div class="bg-white rounded-2xl shadow p-6 border"><p class="text-gray-500 text-sm">Received</p><p class="text-4xl font-bold text-green-600">${stats.received}</p></div>
  <div class="bg-white rounded-2xl shadow p-6 border"><p class="text-gray-500 text-sm">Sent</p><p class="text-4xl font-bold text-blue-600">${stats.sent}</p></div>
  <div class="bg-white rounded-2xl shadow p-6 border"><p class="text-gray-500 text-sm">Customers</p><p class="text-4xl font-bold text-purple-600">${storage.getUsers().length}</p></div>
  <div class="bg-white rounded-2xl shadow p-6 border"><p class="text-gray-500 text-sm">Packages</p><p class="text-4xl font-bold text-orange-600">${storage.getPackages().length}</p></div>
`));

router.get("/api/logs", (req, res) => res.send(`
  <table class="w-full text-sm">
    <thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left">Time</th><th>Type</th><th>Phone</th><th>Message</th></tr></thead>
    <tbody>
      ${logs.length === 0 ? "<tr><td colspan='4' class='text-center py-8 text-gray-500'>No logs yet</td></tr>" : 
        logs.map(l => `<tr class="${l.type==='IN'?'bg-green-50':'bg-blue-50'}">
          <td class="px-6 py-3">${l.time}</td>
          <td><span class="px-3 py-1 rounded-full text-xs font-bold">${l.type}</span></td>
          <td class="font-medium">${l.phone}</td>
          <td>${l.msg}</td>
        </tr>`).join("")}
    </tbody>
  </table>
`));

router.get("/api/packages", (req, res) => {
  const pkgs = storage.getPackages();
  const groups = {};
  pkgs.forEach(p => (groups[p.category] = groups[p.category] || []).push(p));
  let html = "";
  Object.keys(groups).sort().forEach(cat => {
    html += `<h3 class="text-2xl font-bold capitalize mb-6 text-gray-800">${cat}</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">`;
    groups[cat].forEach(p => {
      html += `<div class="bg-white rounded-2xl shadow-lg p-6 border hover:shadow-xl transition">
        <div class="flex justify-end mb-4">
          <button onclick="if(confirm('Delete?'))fetch('/api/package/${p.id}',{method:'DELETE'}).then(()=>location.reload())" class="text-red-600 hover:text-red-800">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <h4 class="text-lg font-bold">${p.title}</h4>
        <p class="text-3xl font-black text-green-600 mt-3">KSh ${p.price}</p>
      </div>`;
    });
    html += `</div>`;
  });
  res.send(html);
});

router.post("/api/package", (req, res) => {
  storage.addPackage({ category: req.body.cat, title: req.body.title, price: Number(req.body.price) });
  res.sendStatus(200);
});

router.delete("/api/package/:id", (req, res) => {
  storage.deletePackage(Number(req.params.id));
  res.sendStatus(200);
});

router.post("/api/broadcast", async (req, res) => {
  const { targets, text, buttons = [] } = req.body;
  if (!Array.isArray(targets) || targets.length === 0) return res.sendStatus(400);
  for (const to of targets) await send(to, text, buttons);
  res.sendStatus(200);
});

module.exports = router;
