// admin.js — FINAL 100% WORKING GOD-TIER DASHBOARD
const express = require("express");
const storage = require("./storage");
const axios = require("axios");
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
    content: String(content).substring(0, 100)
  });
  if (messageLog.length > 500) messageLog.pop();
};

// Send WhatsApp message
const sendWhatsAppMessage = async (to, text, buttons = []) => {
  try {
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
    await axios.post(
      `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`,
      payload,
      { headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` } }
    );
    stats.sent++;
    router.logMessage("OUT", to, text);
  } catch (e) {
    console.error("Send failed:", e.response?.data || e.message);
  }
};

router.get("/", (req, res) => {
  const users = storage.getUsers();
  const packages = storage.getPackages();

  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  const h = String(Math.floor(uptime / 3600)).padStart(2, "0");
  const m = String(Math.floor((uptime % 3600) / 60)).padStart(2, "0");
  const s = String(uptime % 60).padStart(2, "0");

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BlackLab • Empire Control</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet">
  <style>
    .sidebar-active { @apply bg-blue-50 text-blue-700 border-r-4 border-blue-600; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen flex">
  <aside class="w-64 bg-white shadow-lg fixed h-full">
    <div class="p-6 border-b">
      <h1 class="text-2xl font-bold text-blue-600">BlackLab</h1>
      <p class="text-sm text-gray-500">Empire Control</p>
    </div>
    <nav class="mt-6">
      <a href="#dashboard" class="sidebar-active flex items-center gap-3 px-6 py-4 text-sm font-medium"><i class="fas fa-home"></i> Dashboard</a>
      <a href="#customers" class="flex items-center gap-3 px-6 py-4 text-sm font-medium hover:bg-gray-50"><i class="fas fa-users"></i> Customers</a>
      <a href="#packages" class="flex items-center gap-3 px-6 py-4 text-sm font-medium hover:bg-gray-50"><i class="fas fa-box"></i> Packages</a>
      <a href="#broadcast" class="flex items-center gap-3 px-6 py-4 text-sm font-medium hover:bg-gray-50"><i class="fas fa-bullhorn"></i> Broadcast</a>
      <a href="#logs" class="flex items-center gap-3 px-6 py-4 text-sm font-medium hover:bg-gray-50"><i class="fas fa-history"></i> Logs</a>
    </nav>
    <div class="absolute bottom-0 w-full p-6 border-t text-xs text-gray-500">Uptime: \( {h}h \){m}m ${s}s</div>
  </aside>

  <main class="ml-64 p-8 flex-1">
    <section id="dashboard">
      <h2 class="text-3xl font-bold mb-8">Dashboard</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="bg-white rounded-2xl shadow p-6"><div class="text-gray-500 text-sm">Received</div><div class="text-4xl font-bold text-green-600">${stats.received}</div></div>
        <div class="bg-white rounded-2xl shadow p-6"><div class="text-gray-500 text-sm">Sent</div><div class="text-4xl font-bold text-blue-600">${stats.sent}</div></div>
        <div class="bg-white rounded-2xl shadow p-6"><div class="text-gray-500 text-sm">Customers</div><div class="text-4xl font-bold text-purple-600">${users.length}</div></div>
        <div class="bg-white rounded-2xl shadow p-6"><div class="text-gray-500 text-sm">Packages</div><div class="text-4xl font-bold text-orange-600">${packages.length}</div></div>
      </div>
    </section>

    <section id="customers" class="hidden">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-3xl font-bold">Customers</h2>
        <button onclick="selectAll()" class="bg-gray-200 px-4 py-2 rounded-lg text-sm">Select All</button>
      </div>
      <div class="bg-white rounded-2xl shadow overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50"><tr><th class="px-6 py-4 text-left">Phone</th><th class="text-right px-6">Action</th></tr></thead>
          <tbody class="divide-y">
            ${users.length === 0 ? '<tr><td colspan="2" class="text-center py-8 text-gray-500">No customers yet</td></tr>' : 
              users.map(p => 
                `<tr>
                  <td class="px-6 py-4"><input type="checkbox" value="\( {p}" class="mr-3 selected-customers"> <strong> \){p}</strong></td>
                  <td class="text-right px-6"><button onclick="openBroadcast(['${p}'])" class="text-blue-600 hover:underline">Message</button></td>
                </tr>`
              ).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section id="packages" class="hidden">
      <div class="flex justify-between mb-6">
        <h2 class="text-3xl font-bold">Packages</h2>
        <button onclick="document.getElementById('addModal').classList.remove('hidden')" class="bg-blue-600 text-white px-6 py-3 rounded-xl">+ Add Package</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${packages.map(p => `
          <div class="bg-white rounded-2xl shadow p-6 border hover:shadow-xl transition">
            <div class="flex justify-between mb-4">
              <span class="text-xs font-medium text-gray-500 uppercase">${p.category}</span>
              <button onclick="deletePkg(${p.id})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
            </div>
            <h3 class="text-xl font-bold">${p.title}</h3>
            <p class="text-3xl font-bold text-green-600 mt-3">KSh ${p.price}</p>
          </div>
        `).join("")}
      </div>
    </section>

    <section id="broadcast" class="hidden">
      <h2 class="text-3xl font-bold mb-8">Broadcast Message</h2>
      <div class="bg-white rounded-2xl shadow p-8 max-w-2xl mx-auto">
        <textarea id="msgText" rows="6" class="w-full border rounded-xl p-4" placeholder="Your message..."></textarea>
        <div class="grid grid-cols-2 gap-4 mt-4">
          <input id="btn1" placeholder="Button 1" class="border rounded-xl px-4 py-3">
          <input id="btn2" placeholder="Button 2" class="border rounded-xl px-4 py-3">
        </div>
        <button onclick="openBroadcast()" class="mt-6 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-4 rounded-xl">
          SEND TO SELECTED
        </button>
      </div>
    </section>

    <section id="logs" class="hidden">
      <h2 class="text-3xl font-bold mb-6">Message Logs</h2>
      <div class="bg-white rounded-2xl shadow overflow-hidden text-sm">
        <table class="w-full">
          <thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left">Time</th><th>Type</th><th>Phone</th><th>Message</th></tr></thead>
          <tbody>
            ${messageLog.length === 0 ? '<tr><td colspan="4" class="text-center py-8 text-gray-500">No logs yet</td></tr>' :
              messageLog.map(l => `
                <tr class="${l.type === 'IN' ? 'bg-green-50' : 'bg-blue-50'}">
                  <td class="px-6 py-3">${l.time}</td>
                  <td><span class="px-3 py-1 rounded-full text-xs font-bold">${l.type}</span></td>
                  <td class="font-medium">${l.phone}</td>
                  <td class="text-gray-700">\( {l.content} \){l.content.length === 100 ? '...' : ''}</td>
                </tr>
              `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  </main>

  <!-- Add Package Modal -->
  <div id="addModal" class="fixed inset-0 bg-black bg-opacity-60 hidden flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl p-8 w-full max-w-md">
      <h3 class="text-2xl font-bold mb-6">Add Package</h3>
      <select id="cat" class="w-full border rounded-xl px-4 py-3 mb-4">
        <option>data</option><option>minutes</option><option>sms</option>
      </select>
      <input id="title" placeholder="Name" class="w-full border rounded-xl px-4 py-3 mb-4">
      <input id="price" type="number" placeholder="Price (KSh)" class="w-full border rounded-xl px-4 py-3 mb-6">
      <div class="flex gap-4">
        <button onclick="this.closest('#addModal').classList.add('hidden')" class="flex-1 bg-gray-200 py-3 rounded-xl">Cancel</button>
        <button onclick="addPkg()" class="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold">Add</button>
      </div>
    </div>
  </div>

  <!-- Broadcast Modal -->
  <div id="broadcastModal" class="fixed inset-0 bg-black bg-opacity-60 hidden flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl p-8 w-full max-w-lg">
      <h3 class="text-2xl font-bold mb-4">Send to <span id="count">0</span> customers</h3>
      <textarea id="finalText" rows="5" class="w-full border rounded-xl p-4 mb-4"></textarea>
      <div class="grid grid-cols-2 gap-4 mb-6">
        <input id="finalBtn1" placeholder="Button 1" class="border rounded-xl px-4 py-3">
        <input id="finalBtn2" placeholder="Button 2" class="border rounded-xl px-4 py-3">
      </div>
      <button onclick="sendNow()" class="w-full bg-green-600 text-white font-bold py-4 rounded-xl">SEND NOW</button>
    </div>
  </div>

  <script>
    const sections = document.querySelectorAll('section');
    document.querySelectorAll('nav a').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const target = link.getAttribute('href');
        sections.forEach(s => s.classList.add('hidden'));
        document.querySelector(target).classList.remove('hidden');
        document.querySelectorAll('nav a').forEach(a => a.classList.remove('sidebar-active'));
        link.classList.add('sidebar-active');
      });
    });

    function selectAll() {
      document.querySelectorAll('.selected-customers').forEach(c => c.checked = true);
    }

    let selected = [];
    function openBroadcast(single = null) {
      selected = single || Array.from(document.querySelectorAll('.selected-customers:checked')).map(c => c.value);
      if (selected.length === 0) return alert("Select at least one customer");
      document.getElementById('count').textContent = selected.length;
      document.getElementById('finalText').value = document.getElementById('msgText').value;
      document.getElementById('finalBtn1').value = document.getElementById('btn1').value;
      document.getElementById('finalBtn2').value = document.getElementById('btn2').value;
      document.getElementById('broadcastModal').classList.remove('hidden');
    }

    function sendNow() {
      const text = document.getElementById('finalText').value.trim();
      const b1 = document.getElementById('finalBtn1').value.trim();
      const b2 = document.getElementById('finalBtn2').value.trim();
      if (!text) return alert("Message required");
      fetch('/broadcast', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({targets: selected, text, btn1: b1 || null, btn2: b2 || null})
      }).then(() => {
        alert("Sent to " + selected.length + " customers!");
        document.getElementById('broadcastModal').classList.add('hidden');
      });
    }

    function addPkg() {
      const cat = document.getElementById('cat').value;
      const title = document.getElementById('title').value.trim();
      const price = document.getElementById('price').value;
      if (!title || !price) return alert("Fill all fields");
      fetch('/add-package', {
        method: 'POST',
        body: new URLSearchParams({cat, title, price})
      }).then(() => location.reload());
    }

    function deletePkg(id) {
      if (confirm("Delete this package?")) {
        fetch('/delete-package/' + id, {method: 'DELETE'}).then(() => location.reload());
      }
    }

    setInterval(() => location.reload(), 60000);
  </script>
</body>
</html>`);
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
  let { targets, text, btn1, btn2 } = req.body;
  if (!Array.isArray(targets)) targets = [];
  const buttons = [];
  if (btn1) buttons.push({ type: "reply", reply: { id: "1", title: btn1 } });
  if (btn2) buttons.push({ type: "reply", reply: { id: "2", title: btn2 } });

  for (const to of targets) {
    await sendWhatsAppMessage(to, text, buttons);
  }
  res.sendStatus(200);
});

module.exports = router;
