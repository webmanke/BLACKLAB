// server.js — FINAL WORKING VERSION
const express = require("express");
const bodyParser = require("body-parser");
const admin = require("./admin");
const bot = require("./bot");        // ← THIS IS CORRECT
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

// ADMIN DASHBOARD
app.use("/", admin);

// WHATSAPP WEBHOOK
app.get("/webhook", bot.webhook);    // ← GET for verification
app.post("/webhook", bot.webhook);   // ← POST for messages

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BLACKLAB EMPIRE RUNNING ON PORT ${PORT}`);
  console.log(`DASHBOARD: https://your-url.onrender.com`);
  console.log(`BOT LIVE & READY`);
});
