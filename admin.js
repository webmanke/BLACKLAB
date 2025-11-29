// admin.js — THE ULTIMATE BLACKLAB EMPIRE PANEL (2025 EDITION)
const express = require("express");
const storage = require("./storage");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// Stats & Logs
let stats = { received: 0, sent: 0, startTime: Date.now() };
let messageLog = [];

router.stats = stats;
router.logMessage = (type, phone, content) => {
  messageLog.unshift({
    time: new Date().toLocaleString(),
    type,
    phone,
    content: content.substring(0, 100)
  });
  if (messageLog.length > 500) messageLog.pop();
};

// Helper to send message (used by broadcast & single)
const sendWhatsAppMessage = async (to, text, buttons = []) => {
  const axios = require("axios");
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: { type: "image", image: { link: "https://i.imgur.com/elSEhEg.jpeg" } },
      body: { text },
      footer: { text: "BlackLab Systems • Instant • 24/7" },
      action: { buttons }
    }
  };
  try {
    await axios.post(`https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      data: payload,
      headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` }
    });
    stats.sent++;
    router.logMessage("OUT", to, text);
  } catch (e) { console.error("Send failed:", e.message); }
};

router.get("/", (req, res) => {
  const users = storage.getUsers();
  const packages = storage.getPackages();

  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  const h = String(Math.floor(uptime / 3600)).padStart(2, "0");
  const m = String(Math.floor((uptime % 3600) / 60)).padStart(2, "0");
  const s = String(uptime % 60).padStart(2, "0");

  res.send(`
<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BlackLab • Empire Control Center</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet">
  <script defer src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <style>
    .sidebar-active { @apply bg-blue-50 text-blue-700 border-r-4 border-blue-600; }
    .log-in { @apply bg-green-50 text-green-800 border-green-200; }
    .log-out { @apply bg-blue-50 text-blue-800 border-blue-200; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen flex">
  <!-- Sidebar -->
  <aside class="w-64 bg-white shadow-lg">
    <div class="p-6 border-b">
      <h1 class="text-2xl font-bold text-blue-600">BlackLab</h1>
      <p class="text-sm text-gray-500">Empire Control</p>
    </div>
    <nav class="mt-6">
      <a href="#dashboard" class="sidebar-active flex items-center gap-3 px-6 py-4 text-sm font-medium"><i class="fas fa-home"></i> Dashboard</a>
      <a href="#customers" class="flex items-center gap-3 px-6 py-4 text-sm font-medium hover:bg-gray-50"><i class="fas fa-users"></i> Customers</a>
      <a href="#packages" class="flex items-center gap-3 px-6 py-4 text-sm font-medium hover:bg-gray-50"><i class="fas fa-box"></i> Packages</a>
      <a href="#broadcast" class="flex items-center gap-3 px-6 py-4 text-sm font-medium hover:bg-gray-50"><i class="fas fa-bullhorn"></i> Broadcast</a>
      <a href="#logs" class="flex items-center gap-3 px-6 py-4 text-sm font-medium hover:bg-gray-50"><i class="fas fa-history"></i> Message Logs</a>
    </nav>
    <div class="absolute bottom-0 p-6 w-full border-t">
      <div class="text-xs text-gray-500">Uptime: \( {h}h \){m}m ${s}s</div>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="flex-1 overflow-y-auto">
    <div class="max-w-6xl mx-auto p-8">

      <!-- Dashboard -->
      <section id="dashboard">
        <h2 class="text-3xl font-bold mb-8">Dashboard</h2>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div class="bg-white rounded-2xl shadow p-6 border"><div class="text-gray-500 text-sm">Received</div><div class="text-4xl font-bold text-green-600">${stats.received}</div></div>
          <div class="bg-white rounded-2xl shadow p-6 border"><div class="text-gray-500 text-sm">Sent</div><div class="text-4xl font-bold text-blue-600">${stats.sent}</div></div>
          <div class="bg-white rounded-2xl shadow p-6 border"><div class="text-gray-500 text-sm">Customers</div><div class="text-4xl font-bold text-purple-600">${users.length}</div></div>
          <div class="bg-white rounded-2xl shadow p-6 border"><div class="text-gray-500 text-sm">Packages</div><div class="text-4xl font-bold text-orange-600">${packages.length}</div></div>
        </div>
      </section>

      <!-- Customers -->
      <section id="customers" class="hidden">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-3xl font-bold">Customers</h2>
          <button onclick="selectAll()" class="bg-gray-200 px-4 py-2 rounded-lg text-sm">Select All</button>
        </div>
        <div class="bg-white rounded-2xl shadow overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50"><tr><th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Phone</th><th class="text-right px-6">Action</th></tr></thead>
            <tbody class="divide-y">
              ${users.map(p => `
              <tr>
                <td class="px-6 py-4"><input type="checkbox" value="\( {p}" class="mr-3 selected-customers"> <strong> \){p}</strong></td>
                <td class="text-right px-6"><button onclick="openBroadcastModal(['${p}'])" class="text-blue-600 hover:underline text-sm">Message</button></td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Packages -->
      <section id="packages" class="hidden">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-3xl font-bold">Packages</h2>
          <button onclick="document.getElementById('addPkgModal').classList.remove('hidden')" class="bg-blue-600 text-white px-6 py-3 rounded-xl">+ Add Package</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          ${packages.map(p => `
          <div class="bg-white rounded-2xl shadow p-6 border hover:shadow-xl transition">
            <div class="flex justify-between items-start mb-4">
              <span class="text-xs font-medium text-gray-500 uppercase">${p.category}</span>
              <button onclick="deletePkg(${p.id})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
            </div>
            <h3 class="text-xl font-bold">${p.title}</h3>
            <p class="text-3xl font-bold text-green-600 mt-3">KSh ${p.price}</p>
          </div>`).join("")}
        </div>
      </section>

      <!-- Broadcast -->
      <section id="broadcast" class="hidden">
        <h2 class="text-3xl font-bold mb-8">Send Broadcast</h2>
        <div class="bg-white rounded-2xl shadow p-8 max-w-2xl">
          <textarea id="bText" rows="6" class="w-full border rounded-xl p-4 focus:ring-2 focus:ring-blue-500" placeholder="Your message..."></textarea>
          <div class="grid grid-cols-2 gap-4 mt-4">
            <input id="b1" placeholder="Button 1 (e.g. View Packages)" class="border rounded-xl px-4 py-3">
            <input id="b2" placeholder="Button 2 (e.g. Contact Us)" class="border rounded-xl px-4 py-3">
          </div>
          <button onclick="sendBroadcast()" class="mt-6 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-4 rounded-xl hover:shadow-lg transition">
            SEND TO SELECTED CUSTOMERS
          </button>
        </div>
      </section>

      <!-- Logs -->
      <section id="logs" class="hidden">
        <h2 class="text-3xl font-bold mb-6">Message Logs</h2>
        <div class="bg-white rounded-2xl shadow overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left">Time</th><th>Type</th><th>Phone</th><th>Message</th></tr></thead>
            <tbody>
              ${messageLog.map(l => `
              <tr class="${l.type==='IN'?'log-in':'log-out'} border-l-4">
                <td class="px-6 py-3">${l.time}</td>
                <td><span class="px-3 py-1 rounded-full text-xs font-medium">${l.type}</span></td>
                <td class="font-medium">${l.phone}</td>
                <td class="text-gray-600">\( {l.content} \){l.content.length===100?'...':''}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  </main>

  <!-- Add Package Modal -->
  <div id="addPkgModal" class="fixed inset-0 bg-black bg-opacity-60 hidden flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl p-8 w-full max-w-md">
      <h3 class="text-2xl font-bold mb-6">Add New Package</h3>
      <select id="newCat" class="w-full border rounded-xl px-4 py-3 mb-4"><option>data</option><option>minutes</option><option>sms</option></select>
      <input id="newTitle" placeholder="Package name" class="w-full border rounded-xl px-4 py-3 mb-4">
      <input id="newPrice" type="number" placeholder="Price (KSh)" class="w-full border rounded-xl px-4 py-3 mb-6">
      <div class="flex gap-4">
        <button onclick="document.getElementById('addPkgModal').classList.add('hidden')" class="flex-1 bg-gray-200 py-3 rounded-xl">Cancel</button>
        <button onclick="addNewPackage()" class="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold">Add</button>
      </div>
    </div>
  </div>

  <!-- Broadcast Modal (for single too) -->
  <div id="broadcastModal" class="fixed inset-0 bg-black bg-opacity-60 hidden flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl p-8 w-full max-w-lg">
      <h3 class="text-2xl font-bold mb-4">Send Message</h3>
      <textarea id="modalText" rows="5" class="w-full border rounded-xl p-4"></textarea>
      <div class="grid grid-cols-2 gap-4 mt-4">
        <input id="modalB1" placeholder="Button  Button 1" class="border rounded-xl px-4 py-3">
        <input id="modalB2" placeholder="  Button 2" class="border rounded-xl px-4 py-3">
      </div>
      <button onclick="confirmSend()" class="mt-6 w-full bg-green-600 text-white font-bold py-4 rounded-xl">
        SEND NOW
      </button>
    </div>
  </div>

  <script>
    const sections = ['dashboard','customers','packages','broadcast','logs'];
    const links = document.querySelectorAll('nav a');
    links.forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.getAttribute('href').substring(1);
      sections.forEach(s => document.getElementById(s).classList.add('hidden'));
      document.getElementById(id).classList.remove('hidden');
      links.forEach(l => l.classList.remove('sidebar-active'));
      a.classList.add('sidebar-active');
    }));

    function selectAll() {
      document.querySelectorAll('.selected-customers').forEach(c => c.checked = true);
    }

    let broadcastTargets = [];
    function openBroadcastModal(targets) {
      broadcastTargets = targets || Array.from(document.querySelectorAll('.selected-customers:checked')).map(c => c.value);
      if (broadcastTargets.length === 0) return alert("Select at least one customer");
      document.getElementById('broadcastModal').classList.remove('hidden');
    }

    function confirmSend() {
      const text = document.getElementById('modalText').value.trim();
      const b1 = document.getElementById('modalB1').value.trim();
      const b2 = document.getElementById('modalB2').value.trim();
      if (!text) return alert("Write a message");

      fetch('/broadcast', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({targets: broadcastTargets, text, btn1: b1||null, btn2: b2||null})
      }).then(() => {
        alert("Sent to " + broadcastTargets.length + " customers!");
        document.getElementById('broadcastModal').classList.add('hidden');
      });
    }

    function addNewPackage() {
      const cat = document.getElementById('newCat').value;
      const title = document.getElementById('newTitle').value.trim();
      const price = document.getElementById('newPrice').value;
      if (!title || !price) return alert("Fill all");
      fetch('/add-package', {method:'POST', body:new URLSearchParams({cat,title,price})})
        .then(() => location.reload());
    }

    function deletePkg(id) {
      if(confirm("Delete this package?")) {
        fetch('/delete-package/'+id, {method:'DELETE'}).then(() => location.reload());
      }
    }

    setInterval(() => location.reload(), 45000);
  </script>
</body>
</html>
  `);
});

// Routes
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
  const { targets, text, btn1, btn2 } = req.body;
  const buttons = [];
  if (btn1) buttons.push({ type: "reply", reply: { id: "b1", title: btn1 } });
  if (btn2) buttons.push({ type: "reply", reply: { id: "b2", title: btn2 } });

  for (targets || []).forEach(to => sendWhatsAppMessage(to, text, buttons));
  res.sendStatus(200);
});

module.exports = router;
