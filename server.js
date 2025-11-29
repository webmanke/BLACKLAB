const express = require("express");
require("./storage"); // Loads storage first
const bot = require("./bot");
const admin = require("./admin");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/", admin);        // Dashboard at yourdomain.onrender.com
app.get("/webhook", bot.verify);
app.post("/webhook", bot.handle);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BLACKLAB EMPIRE RUNNING ON PORT ${PORT}`);
  console.log(`Dashboard → https://your-app.onrender.com`);
});
