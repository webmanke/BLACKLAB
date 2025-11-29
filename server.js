const express = require("express");
require("./storage");
const bot = require("./bot");
const admin = require("./admin");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", admin);
app.get("/webhook", bot.verify);
app.post("/webhook", bot.handle);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BLACKLAB EMPIRE IS LIVE ON PORT ${PORT}`);
  console.log(`Dashboard: https://your-app.onrender.com`);
});
