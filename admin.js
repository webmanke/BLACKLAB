// admin.js — FINAL GOD-TIER VERSION (EVERYTHING WORKS)
const express = require("express");
const storage = require("./storage");
const axios = require("axios");
const router = express.Router();

// Stats & Logs
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
  if (logs.length > 500) logs.pop();
  type === "IN" ? stats.received++ : stats.sent++;
};

const sendMessage = async (to, text, buttons = []) => {
  try {
    const payload = buttons.length > 0
      ? {
          messaging_product: "whatsapp",
          to,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text },
            footer: { text: "BlackLab • Instant Delivery" },
            action: { buttons }
          }
        }
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

  const userRows = users.length === 0
    ? "<tr><td colspan='2' class='text-center py-12 text-gray-500'>No customers yet</td></tr>"
    : users.map(p => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 font-medium">${p}</td>
        <td class="text-center"><input type="checkbox" value="${p}" x-model="selected"></td>
      </tr>
    `).join("");

  const groupedPackages = packages.reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BlackLab • Empire Control</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
  <style>.active{@apply bg-blue-50 text-blue-700 border-l-4 border-blue-600}</style>
</head>
<body class="bg-gray-900 text-white min-h-screen" x-data="app()">
  <button @click="sidebar=!sidebar" class="lg:hidden fixed top-4 left-4 z-50 bg-white text-black p-3 rounded-xl shadow-lg">
    <i class="fas fa-bars text-xl"></i>
  </button>

  <aside :class="sidebar?'translate-x-0':'-translate-x-full'" class="fixed inset-y-0 left-0 z-40 w-64 bg-gray-800 shadow-2xl transition lg:translate-x-0">
    <div class="p-6 border-b border-gray-700 text-center">
      <h1 class="text-3xl font-black text-blue-500">BlackLab</h1>
      <p class="text-xs text-gray-400">Empire Control Panel</p>
    </div>
    <nav class="p-4 space-y-2">
      <button @click="page='dashboard';sidebar=false" :class="page==='dashboard'?'active':''" class="w-full text-left px-6 py-4 rounded-lg flex items-center gap-4 text-lg"><i class="fas fa-tachometer-alt"></i> Dashboard</button>
      <button @click="page='customers';sidebar=false" :class="page==='customers'?'active':''" class="w-full text-left px-6 py-4 rounded-lg flex items-center gap-4 text-lg"><i class="fas fa-users"></i> Customers (${users.length})</button>
      <button @click="page='packages';sidebar=false" :class="page==='packages'?'active':''" class="w-full text-left px-6 py-4 rounded-lg flex items-center gap-4 text-lg"><i class="fas fa-box"></i> Packages</button>
      <button @click="page='broadcast';sidebar=false" :class="page==='broadcast'?'active':''" class="w-full text-left px-6 py-4 rounded-lg flex items-center gap-4 text-lg"><i class="fas fa-paper-plane"></i> Broadcast</button>
      <button @click="page='logs';sidebar=false" :class="page==='logs'?'active':''" class="w-full text-left px-6 py-4 rounded-lg flex items-center gap-4 text-lg"><i class="fas fa-history"></i> Logs</button>
      <button @click="page='about';sidebar=false" class="w-full text-left px-6 py-4 rounded-lg flex items-center gap-4 text-lg hover:bg-gray-700"><i class="fas fa-info-circle"></i> About Us</button>
      <button @click="page='contact';sidebar=false" class="w-full text-left px-6 py-4 rounded-lg flex items-center gap-4 text-lg hover:bg-gray-700"><i class="fas fa-headset"></i> Contact</button>
    </nav>
  </aside>

  <main class="lg:ml-64 p-8 pt-20 lg:pt-8">
    <!-- Dashboard -->
    <div x-show="page==='dashboard'">
      <h2 class="text-4xl font-black mb-8">Empire Dashboard</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-6" hx-get="/api/stats" hx-trigger="every 2s" hx-swap="innerHTML"></div>
    </div>

    <!-- Customers -->
    <div x-show="page==='customers'">
      <h2 class="text-4xl font-black mb-8">Customers</h2>
      <div class="bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        <table class="w-full"><thead class="bg-gray-700"><tr><th class="px-6 py-4 text-left">Phone</th><th>Select</th></tr></thead>
          <tbody>${userRows}</tbody>
        </table>
      </div>
      <div class="mt-8 text-center text-2xl font-bold text-blue-400"><span x-text="selected.length"></span> selected</div>
    </div>

    <!-- Packages -->
    <div x-show="page==='packages'">
      <div class="flex justify-between items-center mb-10">
        <h2 class="text-4xl font-black">All Packages</h2>
        <button @click="$refs.modal.showModal()" class="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-xl text-xl font-bold shadow-lg">+ Add Package</button>
      </div>
      <div class="space-y-12">
        ${['data', 'minutes', 'sms'].map(cat => {
          const items = groupedPackages[cat] || [];
          if (items.length === 0) return '';
          return `<div>
            <h3 class="text-3xl font-black mb-6 text-blue-400 capitalize">${cat}</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              ${items.map(p => `<div class="bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700 hover:border-blue-500 transition">
                <div class="flex justify-end mb-4">
                  <button onclick="if(confirm('Delete \( {p.title}?'))fetch('/api/package/ \){p.id}',{method:'DELETE'}).then(()=>location.reload())" class="text-red-500 hover:text-red-400"><i class="fas fa-trash"></i></button>
                </div>
                <h4 class="text-xl font-bold">${p.title}</h4>
                <p class="text-4xl font-black text-green-400 mt-4">KSh ${p.price}</p>
              </div>`).join("")}
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>

    <!-- Broadcast -->
    <div x-show="page==='broadcast'" class="max-w-3xl mx-auto">
      <h2 class="text-4xl font-black text-center mb-10">Send Broadcast</h2>
      <div class="bg-gray-800 rounded-3xl shadow-2xl p-10 space-y-8">
        <textarea x-model="msg" rows="8" placeholder="Your message..." class="w-full bg-gray-900 border border-gray-700 rounded-2xl p-6 text-lg"></textarea>
        <div class="grid grid-cols-2 gap-6">
          <input x-model="b1" placeholder="Button 1" class="bg-gray-900 border border-gray-700 rounded-2xl px-6 py-4">
          <input x-model="b2" placeholder="Button 2" class="bg-gray-900 border border-gray-700 rounded-2xl px-6 py-4">
        </div>
        <button @click="sendBroadcast()" :disabled="!msg || selected.length===0"
          class="w-full py-6 rounded-2xl font-black text-2xl transition"
          :class="selected.length > 0 && msg ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700' : 'bg-gray-600'">
          SEND TO <span x-text="selected.length"></span> CUSTOMERS
        </button>
      </div>
    </div>

    <!-- Logs -->
    <div x-show="page==='logs'">
      <h2 class="text-4xl font-black mb-8">Live Message Logs</h2>
      <div class="bg-gray-800 rounded-2xl shadow-xl overflow-hidden" hx-get="/api/logs" hx-trigger="every 2s" hx-swap="innerHTML"></div>
    </div>

    <!-- About Us -->
    <div x-show="page==='about'" class="max-w-4xl mx-auto text-center">
      <h2 class="text-5xl font-black mb-10">About BlackLab</h2>
      <div class="bg-gray-800 rounded-3xl p-12 shadow-2xl">
        <p class="text-2xl leading-relaxed">We are Kenya's #1 instant airtime & data delivery system.</p>
        <p class="text-xl mt-6 text-gray-400">100% automated • 24/7 • Zero delays • Trusted by thousands</p>
        <p class="text-3xl font-bold text-blue-400 mt-10">Your success is our mission.</p>
      </div>
    </div>

    <!-- Contact -->
    <div x-show="page==='contact'" class="max-w-4xl mx-auto text-center">
      <h2 class="text-5xl font-black mb-10">Contact Us</h2>
      <div class="bg-gray-800 rounded-3xl p-12 shadow-2xl space-y-8">
        <p class="text-2xl">Support: <span class="text-blue-400 font-bold">+254 700 000 000</span></p>
        <p class="text-2xl">Email: <span class="text-blue-400 font-bold">support@blacklab.ke</span></p>
        <p class="text-xl text-gray-400">Response within 5 minutes • 24/7</p>
      </div>
    </div>
  </main>

  <!-- Add Package Modal -->
  <dialog x-ref="modal" class="bg-gray-800 rounded-3xl p-10 w-full max-w-lg text-white shadow-2xl">
    <h3 class="text-3xl font-black mb-8">Add New Package</h3>
    <input id="title" placeholder="Package Name" class="w-full bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-6 text-lg">
    <input id="price" type="number" placeholder="Price (KSh)" class="w-full bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-6 text-lg">
    <select id="cat" class="w-full bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-8 text-lg">
      <option value="data">Data</option>
      <option value="minutes">Minutes</option>
      <option value="sms">SMS</option>
    </select>
    <div class="flex gap-6">
      <button @click="$refs.modal.close()" class="flex-1 bg-gray-700 py-5 rounded-2xl text-xl font-bold">Cancel</button>
      <button @click="addPackage()" class="flex-1 bg-blue-600 hover:bg-blue-700 py-5 rounded-2xl text-xl font-bold">Save Package</button>
    </div>
  </dialog>

  <script>
    function app() {
      return {
        page: 'dashboard', sidebar: false, selected: [], msg: '', b1: '', b2: '',
        sendBroadcast() {
          if (!this.msg.trim()) return alert("Message required");
          const buttons = [];
          if (this.b1.trim()) buttons.push({type:"reply", reply:{id:"1", title:this.b1.trim()}});
          if (this.b2.trim()) buttons.push({type:"reply", reply:{id:"2", title:this.b2.trim()}});
          fetch('/api/broadcast', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({targets: this.selected, text: this.msg, buttons})
          }).then(() => {
            alert("Sent to " + this.selected.length + " customers!");
            this.msg = this.b1 = this.b2 = "";
          });
        },
        addPackage() {
          const title = document.getElementById('title').value.trim();
          const price = document.getElementById('price').value;
          const cat = document.getElementById('cat').value;
          if (!title || !price) return alert("Fill all fields");
          fetch('/api/package', {
            method: 'POST',
            body: new URLSearchParams({title, price, cat})
          }).then(() => location.reload());
        }
      }
    }
  </script>
</body>
</html>`);
});

// API Routes
router.get("/api/stats", (req, res) => res.send(`
  <div class="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700"><p class="text-gray-400">Received</p><p class="text-5xl font-black text-green-400">${stats.received}</p></div>
  <div class="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700"><p class="text-gray-400">Sent</p><p class="text-5xl font-black text-blue-400">${stats.sent}</p></div>
  <div class="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700"><p class="text-gray-400">Customers</p><p class="text-5xl font-black text-purple-400">${storage.getUsers().length}</p></div>
  <div class="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700"><p class="text-gray-400">Packages</p><p class="text-5xl font-black text-orange-400">${storage.getPackages().length}</p></div>
`));

router.get("/api/logs", (req, res) => {
  const rows = logs.length ? logs.map(l => `<tr class="${l.type==='IN'?'bg-green-900':'bg-blue-900'}">
    <td class="px-6 py-4">${l.time}</td>
    <td><span class="px-4 py-2 rounded-full text-xs font-bold \( {l.type==='IN'?'bg-green-600':'bg-blue-600'}"> \){l.type}</span></td>
    <td class="font-bold">${l.phone}</td>
    <td>${l.msg}</td>
  </tr>`).join("") : "<tr><td colspan='4' class='text-center py-16 text-gray-500'>No logs yet</td></tr>";
  res.send(`<table class="w-full text-lg"><thead class="bg-gray-700"><tr><th class="px-6 py-4 text-left">Time</th><th>Type</th><th>Phone</th><th>Message</th></tr></thead><tbody>${rows}</tbody></table>`);
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
  if (!Array.isArray(targets) || !text) return res.sendStatus(400);
  for (const to of targets) await sendMessage(to, text, buttons);
  res.sendStatus(200);
});

module.exports = router;
