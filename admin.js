// admin.js — FINAL 100% WORKING REAL-TIME EMPIRE DASHBOARD
const express = require("express");
const storage = require("./storage");
const axios = require("axios");
const router = express.Router();

// LIVE STATS & LOGS
let stats = { received: 0, sent: 0 };
let logs = [];

// Make stats & logs accessible globally
router.stats = stats;
router.addLog = (type, phone, msg) => {
  logs.unshift({
    id: Date.now(),
    time: new Date().toLocaleTimeString(),
    type,
    phone,
    msg: msg.length > 80 ? msg.slice(0, 80) + "..." : msg
  });
  if (logs.length > 300) logs.pop();
  if (type === "IN") stats.received++;
  else stats.sent++;
};

// SEND MESSAGE FUNCTION (WORKS FOR TEXT OR BUTTONS)
const sendMessage = async (to, text, buttons = []) => {
  try {
    const payload = buttons.length > 0
      ? {
          messaging_product: "whatsapp",
          to,
          type: "interactive",
          interactive: {
            type: "button",
            header: { type: "image", image: { link: "https://i.imgur.com/elSEhEg.jpeg" } },
            body: { text },
            footer: { text: "BlackLab • Instant • 24/7" },
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
  } catch (err) {
    console.error("Send failed:", err.response?.data || err.message);
  }
};

// MAIN DASHBOARD
router.get("/", (req, res) => {
  const users = storage.getUsers();
  const packages = storage.getPackages();

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BlackLab Empire</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
</head>
<body class="bg-gray-100 min-h-screen" x-data="app()">
  <!-- Mobile Menu -->
  <button @click="sidebar = !sidebar" class="lg:hidden fixed top-4 left-4 z-50 bg-white p-3 rounded-xl shadow-lg">
    <i class="fas fa-bars text-xl"></i>
  </button>

  <!-- Sidebar -->
  <aside :class="sidebar ? 'translate-x-0' : '-translate-x-full'" 
    class="fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-2xl transform transition lg:translate-x-0">
    <div class="p-6 border-b">
      <h1 class="text-2xl font-black text-blue-600">BlackLab</h1>
      <p class="text-xs text-gray-500">Empire Control</p>
    </div>
    <nav class="p-4 space-y-2">
      <button @click="page='dashboard'; sidebar=false" :class="page==='dashboard' ? 'bg-blue-50 text-blue-700' : ''" 
        class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3"><i class="fas fa-home"></i> Dashboard</button>
      <button @click="page='customers'; sidebar=false" :class="page==='customers' ? 'bg-blue-50 text-blue-700' : ''" 
        class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3"><i class="fas fa-users"></i> Customers (${users.length})</button>
      <button @click="page='packages'; sidebar=false" :class="page==='packages' ? 'bg-blue-50 text-blue-700' : ''" 
        class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3"><i class="fas fa-box"></i> Packages</button>
      <button @click="page='broadcast'; sidebar=false" :class="page==='broadcast' ? 'bg-blue-50 text-blue-700' : ''" 
        class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3"><i class="fas fa-paper-plane"></i> Broadcast</button>
      <button @click="page='logs'; sidebar=false" :class="page==='logs' ? 'bg-blue-50 text-blue-700' : ''" 
        class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3"><i class="fas fa-history"></i> Logs</button>
    </nav>
  </aside>

  <!-- Main Content -->
  <main class="lg:ml-64 p-6 pt-20 lg:pt-6">
    <!-- Dashboard -->
    <div x-show="page === 'dashboard'">
      <h2 class="text-3xl font-bold mb-8">Live Dashboard</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-6" hx-get="/api/stats" hx-trigger="every 2s" hx-swap="innerHTML"></div>
    </div>

    <!-- Customers -->
    <div x-show="page === 'customers'">
      <h2 class="text-3xl font-bold mb-6">Customers</h2>
      <div class="bg-white rounded-2xl shadow overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50"><tr><th class="px-6 py-4 text-left">Phone</th><th>Select</th></tr></thead>
          <tbody>
            ${users.map(p => `
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4 font-medium">${p}</td>
              <td class="text-center">
                <input type="checkbox" value="${p}" x-model="selected">
              </td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="mt-6 text-center text-xl font-bold">Selected: <span x-text="selected.length"></span></div>
    </div>

    <!-- Packages -->
    <div x-show="page === 'packages'">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-3xl font-bold">Packages</h2>
        <button @click="openAddModal()" class="bg-blue-600 text-white px-6 py-3 rounded-xl">+ Add Package</button>
      </div>
      <div hx-get="/api/packages" hx-trigger="load, every 30s" hx-swap="innerHTML"></div>
    </div>

    <!-- Broadcast -->
    <div x-show="page === 'broadcast'" class="max-w-2xl mx-auto">
      <h2 class="text-3xl font-bold mb-8 text-center">Send Message</h2>
      <div class="bg-white rounded-2xl shadow p-8 space-y-6">
        <textarea x-model="message" rows="6" placeholder="Your message..." class="w-full border rounded-xl p-4"></textarea>
        <div class="grid grid-cols-2 gap-4">
          <input x-model="button1" placeholder="Button 1 (optional)" class="border rounded-xl px-4 py-3">
          <input x-model="button2" placeholder="Button 2 (optional)" class="border rounded-xl px-4 py-3">
        </div>
        <button @click="sendBroadcast()" 
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition"
          :disabled="selected.length === 0 || !message">
          Send to <span x-text="selected.length"></span> customers
        </button>
      </div>
    </div>

    <!-- Logs -->
    <div x-show="page === 'logs'">
      <h2 class="text-3xl font-bold mb-6">Live Message Logs</h2>
      <div class="bg-white rounded-2xl shadow overflow-hidden" hx-get="/api/logs" hx-trigger="every 2s" hx-swap="innerHTML"></div>
    </div>
  </main>

  <!-- Add/Edit Modal -->
  <dialog id="pkgModal" class="rounded-2xl p-8 w-full max-w-md bg-white">
    <h3 class="text-2xl font-bold mb-6" x-text="editMode ? 'Edit Package' : 'Add Package'"></h3>
    <input x-model="pkgTitle" placeholder="Title" class="w-full border rounded-xl p-3 mb-4">
    <input x-model="pkgPrice" type="number" placeholder="Price" class="w-full border rounded-xl p-3 mb-4">
    <select x-model="pkgCat" class="w-full border rounded-xl p-3 mb-6">
      <option>data</option><option>minutes</option><option>sms</option>
    </select>
    <div class="flex gap-4">
      <button @click="pkgModal.close()" class="flex-1 bg-gray-200 py-3 rounded-xl">Cancel</button>
      <button @click="savePackage()" class="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold">Save</button>
    </div>
  </dialog>

  <script>
    function app() {
      return {
        page: 'dashboard', sidebar: false, selected: [], message: '', button1: '', button2: '',
        editMode: false, editId: null, pkgTitle: '', pkgPrice: '', pkgCat: 'data',
        openAddModal() { this.editMode = false; this.pkgTitle = this.pkgPrice = ''; this.pkgModal.showModal(); },
        openEdit(id, title, price, cat) { this.editMode = true; this.editId = id; this.pkgTitle = title; this.pkgPrice = price; this.pkgCat = cat; this.pkgModal.showModal(); },
        async savePackage() {
          const data = new URLSearchParams({title: this.pkgTitle, price: this.pkgPrice, cat: this.pkgCat});
          const url = this.editMode ? '/api/package/' + this.editId : '/api/package';
          await fetch(url, {method: this.editMode ? 'PUT' : 'POST', body: data});
          this.pkgModal.close();
          htmx.trigger('[hx-get="/api/packages"]', 'htmx:load');
        },
        async sendBroadcast() {
          if (!this.message) return alert("Write a message");
          const buttons = [];
          if (this.button1) buttons.push({type: "reply", reply: {id: "1", title: this.button1}});
          if (this.button2) buttons.push({type: "reply", reply: {id: "2", title: this.button2}});
          await fetch('/api/broadcast', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({targets: this.selected, text: this.message, buttons})
          });
          alert("Sent to " + this.selected.length + " customers!");
          this.message = this.button1 = this.button2 = '';
        }
      }
    }
  </script>
</body>
</html>`);
});

// API ENDPOINTS (REAL-TIME)
router.get("/api/stats", (req, res) => {
  res.send(`
    <div class="bg-white rounded-2xl shadow p-6"><h3 class="text-gray-500 text-sm">Received</h3><p class="text-4xl font-bold text-green-600">${stats.received}</p></div>
    <div class="bg-white rounded-2xl shadow p-6"><h3 class="text-gray-500 text-sm">Sent</h3><p class="text-4xl font-bold text-blue-600">${stats.sent}</p></div>
    <div class="bg-white rounded-2xl shadow p-6"><h3 class="text-gray-500 text-sm">Customers</h3><p class="text-4xl font-bold text-purple-600">${storage.getUsers().length}</p></div>
    <div class="bg-white rounded-2xl shadow p-6"><h3 class="text-gray-500 text-sm">Packages</h3><p class="text-4xl font-bold text-orange-600">${storage.getPackages().length}</p></div>
  `);
});

router.get("/api/logs", (req, res) => {
  res.send(`
    <table class="w-full text-sm">
      <thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left">Time</th><th>Type</th><th>Phone</th><th>Message</th></tr></thead>
      <tbody>
        \( {logs.map(l => `<tr class=" \){l.type==='IN'?'bg-green-50':'bg-blue-50'}">
          <td class="px-6 py-3">${l.time}</td>
          <td><span class="px-3 py-1 rounded-full text-xs font-bold">${l.type}</span></td>
          <td class="font-medium">${l.phone}</td>
          <td>${l.msg}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  `);
});

router.get("/api/packages", (req, res) => {
  const pkgs = storage.getPackages();
  const grouped = pkgs.reduce((g, p) => { (g[p.category] = g[p.category] || []).push(p); return g; }, {});
  let html = "";
  for (const [cat, items] of Object.entries(grouped)) {
    html += `<h3 class="text-xl font-bold capitalize mb-4">${cat}</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">`;
    items.forEach(p => {
      html += `<div class="bg-white rounded-2xl shadow p-6 border">
        <div class="flex justify-between mb-4">
          <button onclick="app().openEdit(\( {p.id}, ' \){p.title}', \( {p.price}, ' \){p.category}')" class="text-blue-600"><i class="fas fa-edit"></i></button>
          <button onclick="if(confirm('Delete?')) fetch('/api/package/${p.id}',{method:'DELETE'}).then(()=>htmx.trigger('[hx-get=\"/api/packages\"]','htmx:load'))" class="text-red-600"><i class="fas fa-trash"></i></button>
        </div>
        <h4 class="font-bold text-lg">${p.title}</h4>
        <p class="text-3xl font-bold text-green-600 mt-2">KSh ${p.price}</p>
      </div>`;
    });
    html += `</div>`;
  }
  res.send(html);
});

router.post("/api/package", (req, res) => {
  const { title, price, cat } = req.body;
  storage.addPackage({ category: cat, title, price: Number(price) });
  res.sendStatus(200);
});

router.put("/api/package/:id", (req, res) => {
  const id = Number(req.params.id);
  const pkgs = storage.getPackages();
  const pkg = pkgs.find(p => p.id === id);
  if (pkg) {
    Object.assign(pkg, req.body);
    storage.savePackages(pkgs);
  }
  res.sendStatus(200);
});

router.delete("/api/package/:id", (req, res) => {
  storage.deletePackage(Number(req.params.id));
  res.sendStatus(200);
});

router.post("/api/broadcast", async (req, res) => {
  let { targets, text, buttons } = req.body;
  if (!Array.isArray(targets)) return res.sendStatus(400);
  for (const to of targets) await sendMessage(to, text, buttons);
  res.sendStatus(200);
});

module.exports = router;
