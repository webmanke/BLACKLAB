// admin.js — REAL-TIME, MOBILE-PERFECT, GOD-TIER DASHBOARD (FINAL)
const express = require("express");
const storage = require("./storage");
const axios = require("axios");
const router = express.Router();

// Live stats & logs
let stats = { received: 0, sent: 0 };
let logs = [];

router.stats = stats;
router.addLog = (type, phone, msg) => {
  logs.unshift({ id: Date.now(), time: new Date().toLocaleTimeString(), type, phone, msg: msg.slice(0, 80) });
  if (logs.length > 200) logs.pop();
  stats[type === "IN" ? "received" : "sent"]++;
};

// Send message
const sendMsg = async (to, text, btns = []) => {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          header: { type: "image", image: { link: "https://i.imgur.com/elSEhEg.jpeg" } },
          body: { text },
          footer: { text: "BlackLab • Instant Delivery" },
          action: { buttons: btns }
        }
      },
      { headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` } }
    );
    router.addLog("OUT", to, text);
  } catch (e) {
    console.error("Send error:", e.message);
  }
};

router.get("/", (req, res) => {
  const users = storage.getUsers();
  const packages = storage.getPackages();

  res.send(`<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BlackLab Empire</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
  <style>
    .active-link { @apply bg-blue-50 text-blue-700 border-l-4 border-blue-600; }
    .log-in { @apply bg-green-50 text-green-800 border-l-4 border-green-500; }
    .log-out { @apply bg-blue-50 text-blue-800 border-l-4 border-blue-500; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen" x-data="{ section: 'dashboard', selected: [] }">
  <!-- Mobile Menu Button -->
  <button @click="document.getElementById('sidebar').classList.toggle('-translate-x-full')" 
    class="lg:hidden fixed top-4 left-4 z-50 bg-white p-3 rounded-xl shadow-lg">
    <i class="fas fa-bars text-xl"></i>
  </button>

  <!-- Sidebar -->
  <aside id="sidebar" class="fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-xl transform -translate-x-full lg:translate-x-0 transition">
    <div class="p-6 border-b">
      <h1 class="text-2xl font-black text-blue-600">BlackLab</h1>
      <p class="text-xs text-gray-500">Empire Control</p>
    </div>
    <nav class="p-4">
      <button @click="section='dashboard'" :class="section==='dashboard' ? 'active-link' : ''" class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 mb-2">
        <i class="fas fa-tachometer-alt"></i> Dashboard
      </button>
      <button @click="section='customers'" :class="section==='customers' ? 'active-link' : ''" class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 mb-2">
        <i class="fas fa-users"></i> Customers <span class="ml-auto bg-gray-200 px-2 py-1 rounded-full text-xs">${users.length}</span>
      </button>
      <button @click="section='packages'" :class="section==='packages' ? 'active-link' : ''" class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 mb-2">
        <i class="fas fa-box"></i> Packages
      </button>
      <button @click="section='broadcast'" :class="section==='broadcast' ? 'active-link' : ''" class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 mb-2">
        <i class="fas fa-bullhorn"></i> Broadcast
      </button>
      <button @click="section='logs'" :class="section==='logs' ? 'active-link' : ''" class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3">
        <i class="fas fa-history"></i> Logs
      </button>
    </nav>
  </aside>

  <!-- Main -->
  <main class="lg:ml-64 p-6 pt-20 lg:pt-6">
    <!-- Dashboard -->
    <div x-show="section === 'dashboard'">
      <h2 class="text-3xl font-bold mb-8">Live Dashboard</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-6" hx-get="/stats" hx-trigger="every 3s" hx-swap="outerHTML"></div>
    </div>

    <!-- Customers -->
    <div x-show="section === 'customers'" class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-3xl font-bold">Customers</h2>
        <div class="text-sm text-gray-600">Selected: <span x-text="selected.length"></span></div>
      </div>
      <div class="bg-white rounded-2xl shadow overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-50"><tr><th class="px-6 py-4 text-left text-xs font-medium text-gray-500">PHONE</th><th class="text-center">SELECT</th></tr></thead>
          <tbody class="divide-y">
            ${users.map(p => `
            <tr>
              <td class="px-6 py-4 font-medium">${p}</td>
              <td class="text-center">
                <input type="checkbox" value="\( {p}" @change="selected.includes(' \){p}') ? selected.splice(selected.indexOf('\( {p}'),1) : selected.push(' \){p}')">
              </td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Packages -->
    <div x-show="section === 'packages'" class="space-y-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-3xl font-bold">Packages</h2>
        <button @click="document.getElementById('addModal').showModal()" class="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-bold">+ Add Package</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6" hx-get="/packages" hx-trigger="load, every 30s"></div>
    </div>

    <!-- Broadcast -->
    <div x-show="section === 'broadcast'" class="max-w-2xl mx-auto">
      <h2 class="text-3xl font-bold mb-8 text-center">Send Broadcast</h2>
      <div class="bg-white rounded-2xl shadow p-8 space-y-6">
        <div>
          <label class="block text-sm font-medium mb-2">Message</label>
          <textarea x-model="msg" rows="5" class="w-full border rounded-xl p-4 focus:ring-2 focus:ring-blue-500"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <input x-model="btn1" placeholder="Button 1" class="border rounded-xl px-4 py-3">
          <input x-model="btn2" placeholder="Button 2" class="border rounded-xl px-4 py-3">
        </div>
        <button @click="sendBroadcast()" :disabled="selected.length===0" 
          class="w-full py-4 rounded-xl font-bold text-white transition" 
          :class="selected.length>0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'">
          Send to <span x-text="selected.length"></span> customers
        </button>
      </div>
    </div>

    <!-- Logs -->
    <div x-show="section === 'logs'">
      <h2 class="text-3xl font-bold mb-6">Live Message Logs</h2>
      <div class="bg-white rounded-2xl shadow overflow-hidden" hx-get="/logs" hx-trigger="every 2s" hx-swap="innerHTML"></div>
    </div>
  </main>

  <!-- Add Package Modal -->
  <dialog id="addModal" class="rounded-2xl p-8 w-full max-w-md">
    <h3 class="text-2xl font-bold mb-6">New Package</h3>
    <select id="cat" class="w-full border rounded-xl p-3 mb-4">
      <option>data</option><option>minutes</option><option>sms</option>
    </select>
    <input id="title" placeholder="Name" class="w-full border rounded-xl p-3 mb-4">
    <input id="price" type="number" placeholder="Price" class="w-full border rounded-xl p-3 mb-6">
    <div class="flex gap-4">
      <button onclick="this.closest('dialog').close()" class="flex-1 bg-gray-200 py-3 rounded-xl">Cancel</button>
      <button onclick="addPkg()" class="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold">Add</button>
    </div>
  </dialog>

  <script>
    const { section, selected, msg = '', btn1 = '', btn2 = '' } = Alpine.store('app', { section, selected, msg, btn1, btn2);
    async function sendBroadcast() {
      if (!msg.value) return alert("Write a message");
      await fetch('/broadcast', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({targets: selected, text: msg.value, btn1: btn1.value, btn2: btn2.value})
      });
      alert("Sent to " + selected.length + " customers!");
      selected.length = 0;
      msg.value = btn1.value = btn2.value = '';
    }
    function addPkg() {
      fetch('/add-package', {
        method: 'POST',
        body: new URLSearchParams({
          cat: document.getElementById('cat').value,
          title: document.getElementById('title').value,
          price: document.getElementById('price').value
        })
      }).then(() => location.reload());
    }
  </script>
</body>
</html>`);
});

// Real-time endpoints
router.get("/stats", (req, res) => {
  res.send(`
    <div class="bg-white rounded-2xl shadow p-6 border"><div class="text-gray-500 text-sm">Received</div><div class="text-4xl font-bold text-green-600">${stats.received}</div></div>
    <div class="bg-white rounded-2xl shadow p-6 border"><div class="text-gray-500 text-sm">Sent</div><div class="text-4xl font-bold text-blue-600">${stats.sent}</div></div>
    <div class="bg-white rounded-2xl shadow p-6 border"><div class="text-gray-500 text-sm">Customers</div><div class="text-4xl font-bold text-purple-600">${storage.getUsers().length}</div></div>
    <div class="bg-white rounded-2xl shadow p-6 border"><div class="text-gray-500 text-sm">Packages</div><div class="text-4xl font-bold text-orange-600">${storage.getPackages().length}</div></div>
  `);
});

router.get("/logs", (req, res) => {
  res.send(`
    <table class="w-full text-sm">
      <thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left">Time</th><th>Type</th><th>Phone</th><th>Message</th></tr></thead>
      <tbody>
        ${logs.length === 0 ? '<tr><td colspan="4" class="text-center py-8 text-gray-500">No logs yet</td></tr>' :
          logs.map(l => `<tr class="${l.type==='IN'?'log-in':'log-out'}">
            <td class="px-6 py-3">${l.time}</td>
            <td><span class="px-3 py-1 rounded-full text-xs font-bold">${l.type}</span></td>
            <td class="font-medium">${l.phone}</td>
            <td>${l.msg}</td>
          </tr>`).join("")}
      </tbody>
    </table>
  `);
});

router.get("/packages", (req, res) => {
  const pkgs = storage.getPackages();
  res.send(pkgs.map(p => `
    <div class="bg-white rounded-2xl shadow p-6 border">
      <div class="flex justify-between mb-4">
        <span class="text-xs font-medium text-gray-500 uppercase">${p.category}</span>
        <button onclick="if(confirm('Delete?')) fetch('/delete-package/${p.id}',{method:'DELETE'}).then(()=>location.reload())" class="text-red-600">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      <h3 class="text-xl font-bold">${p.title}</h3>
      <p class="text-3xl font-bold text-green-600>KSh ${p.price}</p>
    </div>
  `).join(""));
});

// Keep existing routes
router.post("/add-package", (req, res) => {
  const { cat, title, price } = req.body;
  storage.addPackage({ category: cat, title, price: Number(price) });
  res.sendStatus(200);
});

router.delete("/delete-package/:id", (req, res) => {
  storage.deletePackage(Number(req.params.id));
  res.sendStatus(200);
});

router.post("/broadcast", async (req, res) => {
  let { targets, text, btn1, btn2 } = req.body;
  if (!Array.isArray(targets)) return res.sendStatus(400);
  const buttons = [];
  if (btn1) buttons.push({ type: "reply", reply: { id: "1", title: btn1 } });
  if (btn2) buttons.push({ type: "reply", reply: { id: "2", title: btn2 } });
  for (const to of targets) await sendMsg(to, text, buttons);
  res.sendStatus(200);
});

module.exports = router;
