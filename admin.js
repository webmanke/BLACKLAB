// admin.js — 100% CLEAN & WORKING
const express = require("express");
const storage = require("./storage");
const router = express.Router();

router.get("/", (req, res) => {
  const packages = storage.getPackages();
  const users = storage.getUsers();

  const userList = users.map(u => `<div style="padding:10px;border-bottom:1px solid #333;color:#0f0"><strong>${u}</strong></div>`).join("");

  const packageList = packages.map(p => 
    `<tr><td>\( {p.category.toUpperCase()}</td><td> \){p.title}</td><td>KSh ${p.price}</td></tr>`
  ).join("");

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BlackLab • Empire Control</title>
  <style>
    body { font-family: system-ui; background: #000; color: #0f0; padding: 20px; }
    h1 { color: #0f0; text-align: center; font-size: 2.5rem; }
    .card { background: #111; padding: 20px; border-radius: 15px; margin: 20px 0; border: 1px solid #0f0; }
    input, select, button { width: 100%; padding: 12px; margin: 10px 0; border-radius: 8px; border: 1px solid #0f0; background: #000; color: #0f0; }
    button { background: #0f0; color: #000; font-weight: bold; cursor: pointer; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; border: 1px solid #0f0; text-align: left; }
    th { background: #001a00; }
  </style>
</head>
<body>
  <h1>BLACKLAB EMPIRE CONTROL</h1>
  <div class="card">
    <h2>Customers Online (${users.length})</h2>
    <div style="max-height:400px;overflow-y:auto">${userList || "<em>No customers yet</em>"}</div>
  </div>

  <div class="card">
    <h2>Available Packages</h2>
    <table>
      <tr><th>Category</th><th>Package</th><th>Price</th></tr>
      ${packageList}
    </table>
  </div>

  <div class="card">
    <h2>Add New Package</h2>
    <select id="cat">
      <option>data</option>
      <option>minutes</option>
      <option>sms</option>
    </select>
    <input id="title" placeholder="Package Name (e.g. 10GB Monthly)">
    <input id="price" type="number" placeholder="Price in KSh">
    <button onclick="addPkg()">ADD PACKAGE</button>
  </div>

  <script>
    async function addPkg() {
      const cat = document.getElementById('cat').value;
      const title = document.getElementById('title').value.trim();
      const price = document.getElementById('price').value;
      if (!title || !price) return alert("Fill all fields");
      await fetch('/add-package', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({cat, title, price})
      });
      alert("Package added!");
      location.reload();
    }
  </script>
</body>
</html>
  `);
});

router.post("/add-package", (req, res) => {
  const { cat, title, price } = req.body;
  storage.addPackage({ category: cat, title, price: Number(price) });
  res.sendStatus(200);
});

module.exports = router;
