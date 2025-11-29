// admin.js — PREMIUM MODERN DASHBOARD (2025 EDITION)
const express = require("express");
const storage = require("./storage");
const path = require("path");
const router = express.Router();

// Simple stats tracker
let stats = { received: 0, sent: 0 };
router.stats = stats; // Allow bot.js to update

router.get("/", (req, res) => {
  const packages = storage.getPackages();
  const users = storage.getUsers();

  const userList = users.map(phone => `
    <tr>
      <td class="px-4 py-3">${phone}</td>
      <td class="text-right">
        <button onclick="openChat('${phone}')" 
          class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition">
          Message
        </button>
      </td>
    </tr>
  `).join("") || "<tr><td colspan='2' class='text-center py-8 text-gray-500'>No customers yet</td></tr>";

  const packageList = packages.map(p => `
    <div class="bg-gray-50 rounded-xl p-5 flex justify-between items-center hover:shadow-md transition">
      <div>
        <div class="font-semibold text-gray-800">${p.title}</div>
        <div class="text-sm text-gray-500">${p.category.toUpperCase()}</div>
      </div>
      <div class="flex items-center gap-4">
        <div class="text-2xl font-bold text-green-600">KSh ${p.price}</div>
      </div>
    </div>
  `).join("");

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BlackLab • Admin Panel</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
  <script defer src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"></script>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Header -->
  <header class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
      <div class="flex items-center gap-3">
        <svg class="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 12v2h2v-2H9zm0-6h2v5H9V6z"/>
        </svg>
        <h1 class="text-2xl font-bold text-gray-800">BlackLab Admin</h1>
      </div>
      <div class="text-sm text-gray-500">
        <span class="font-medium">${new Date().toLocaleString()}</span>
      </div>
    </div>
  </header>

  <div class="max-w-7xl mx-auto px-6 py-8">
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
      <div class="bg-white rounded-2xl shadow-sm p-6 border">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-500 text-sm">Messages Received</p>
            <p class="text-3xl font-bold text-gray-800 mt-1">${stats.received}</p>
          </div>
          <svg class="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm p-6 border">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-500 text-sm">Messages Sent</p>
            <p class="text-3xl font-bold text-gray-800 mt-1">${stats.sent}</p>
          </div>
          <svg class="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
          </svg>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm p-6 border">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-500 text-sm">Active Customers</p>
            <p class="text-3xl font-bold text-gray-800 mt-1">${users.length}</p>
          </div>
          <svg class="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
        </div>
      </div>
    </div>

    <div class="grid lg:grid-cols-2 gap-8">
      <!-- Customers -->
      <div class="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div class="px-6 py-5 border-b bg-gray-50">
          <h2 class="text-xl font-bold text-gray-800">Customers</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <tbody class="divide-y divide-gray-200">
              ${userList}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Packages -->
      <div>
        <div class="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          <h2 class="text-xl font-bold text-gray-800 mb-6">Packages</h2>
          <div class="space-y-4">
            ${packageList}
          </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border p-6">
          <h3 class="text-lg font-semibold mb-4">Add New Package</h3>
          <div class="space-y-4">
            <select id="cat" class="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="data">Data Bundle</option>
              <option value="minutes">Voice Minutes</option>
              <option value="sms">SMS Bundle</option>
            </select>
            <input id="title" placeholder="Package name (e.g. 10GB Monthly)" class="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
            <input id="price" type="number" placeholder="Price in KSh" class="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
            <button onclick="addPackage()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition">
              ADD PACKAGE
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Message Modal -->
  <div id="chatModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
      <div class="px-6 py-4 border-b flex justify-between items-center">
        <h3 class="font-bold text-lg">Send Message</h3>
        <button onclick="document.getElementById('chatModal').classList.add('hidden')" class="text-gray-500 hover:text-gray-700">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="p-6">
        <input id="msgPhone" type="text" readonly class="w-full px-4 py-3 border rounded-xl bg-gray-100 mb-4">
        <textarea id="msgText" rows="5" placeholder="Type your message..." class="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
        <button onclick="sendMessage()" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl mt-4 transition">
          SEND MESSAGE
        </button>
      </div>
    </div>
  </div>

  <script>
    function openChat(phone) {
      document.getElementById('msgPhone').value = phone;
      document.getElementById('chatModal').classList.remove('hidden');
      document.getElementById('msgText').focus();
    }
    async function sendMessage() {
      const phone = document.getElementById('msgPhone').value;
      const text = document.getElementById('msgText').value.trim();
      if (!text) return alert("Write a message");
      await fetch('/send', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({to: phone, text})
      });
      alert("Message sent to " + phone);
      document.getElementById('chatModal').classList.add('hidden');
      document.getElementById('msgText').value = '';
    }
    async function addPackage() {
      const cat = document.getElementById('cat').value;
      const title = document.getElementById('title').value.trim();
      const price = document.getElementById('price').value;
      if (!title || !price) return alert("Fill all fields");
      await fetch('/add-package', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({cat, title, price})
      });
      location.reload();
    }
    // Auto refresh every 30 seconds
    setInterval(() => location.reload(), 30000);
  </script>
</body>
</html>
  `);
});

// Keep your existing routes
router.post("/add-package", (req, res) => {
  const { cat, title, price } = req.body;
  storage.addPackage({ category: cat, title, price: Number(price) });
  res.sendStatus(200);
});

module.exports = router;
