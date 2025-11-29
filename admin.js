const express = require("express");
const storage = require("./storage");
const axios = require("axios");
const router = express.Router();

router.get("/", (req, res) => {
  const pkgs = storage.getPackages();
  const users = storage.getUsers();
  res.send(`<!DOCTYPE html><html><head><title>BlackLab Empire</title><style>body{font-family:system-ui;background:#000;color:#0f0;padding:20px}h1{color:#0f0}table,button,input{margin:10px 0;padding:10px;border-radius:10px}</style></head><body>
    <h1>BLACKLAB EMPIRE CONTROL</h1>
    <h2>Customers (${users.length})</h2>
    \( {users.map(u=>`<div> \){u}</div>`).join('')}
    <h2>Packages</h2>
    <table><tr><th>Title</th><th>Price</th></tr>\( {pkgs.map(p=>`<tr><td> \){p.title}</td><td>KSh ${p.price}</td></tr>`).join('')}</table>
    <h3>Add Package</h3>
    <select id="c"><option>data</option><option>minutes</option><option>sms</option></select>
    <input id="t" placeholder="Title"><input id="p" placeholder="Price" type="number">
    <button onclick="fetch('/add',{method:'POST',body:new URLSearchParams({c:document.getElementById('c').value,t:document.getElementById('t').value,p:document.getElementById('p').value})}).then(()=>location.reload())">ADD</button>
  </body></html>`);
});

router.post("/add", (req, res) => {
  const { c, t, p } = req.body;
  storage.addPackage({ category: c, title: t, price: Number(p) });
  res.sendStatus(200);
});

module.exports = router;
