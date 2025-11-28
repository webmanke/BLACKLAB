const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Simple log storage for the website
let logs = [];
const addLog = (dir, phone = "", msg = "") => {
  logs.push({
    time: new Date().toLocaleTimeString("en-KE"),
    dir,
    phone: phone ? phone.slice(-5) : "",
    msg: msg.substring(0, 150)
  });
  if (logs.length > 300) logs = logs.slice(-300);
};

// =============== BEAUTIFUL PROFESSIONAL WEBSITE ===============
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BlackLab Systems • Live</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700&display=swap" rel="stylesheet">
  <style>
    body{margin:0;font-family:'Inter',sans-serif;background:#fff;color:#111}
    header{background:linear-gradient(135deg,#0055ff,#00ddff);color:white;text-align:center;padding:60px 20px}
    h1{font-size:4.5rem;margin:0;background:linear-gradient(90deg,#fff,#eee);background-clip:text;-webkit-background-clip:text;color:transparent}
    .status{padding:10px 25px;background:#00ff44;color:#000;border-radius:50px;font-weight:bold}
    .container{max-width:1000px;margin:20px auto;padding:20px}
    .card{background:white;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.1);padding:30px}
    .logs{background:#0a0a0a;color:#0f0;font-family:monospace;padding:20px;border-radius:12px;max-height:600px;overflow-y:auto}
    .in{color:#00ff88}
    .out{color:#88ccff}
    .time{color:#888;margin-right:10px}
    footer{text-align:center;padding:40px;color:#666}
  </style>
</head>
<body>
<header>
  <h1>BlackLab</h1>
  <p style="font-size:2rem;margin:15px 0">WhatsApp Bot is <span class="status">LIVE</span></p>
</header>
<div class="container">
  <div class="card">
    <h2>Real-Time Logs</h2</h2>
    <div class="logs" id="logs">Waiting for messages...</div>
  </div>
</div>
<footer>© 2025 BlackLab Systems • Kenya</footer>

<script>
  const es = new EventSource("/logs");
  es.onmessage = function(e) {
    const d = JSON.parse(e.data);
    const line = document.createElement("div");
    line.innerHTML = '<span class="time">[' + d.time + ']</span> ' +
      '<span class="' + (d.dir==='in'?'in':'out') + '">' +
      (d.dir==='in'?'←':'→') + ' ' + (d.phone ? d.phone + ': ' : '') + d.msg + '</span>';
    document.getElementById("logs").appendChild(line);
    document.getElementById("logs").scrollTop = 99999;
  };
</script>
</body>
</html>
  `);
});

// =============== LIVE LOGS ENDPOINT ===============
app.get("/logs", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });
  res.flushHeaders();
  logs.forEach(l => res.write("data: " + JSON.stringify(l) + "\n\n"));
  const i = setInterval(() => {
    logs.slice(-5).forEach(l => res.write("data: " + JSON.stringify(l) + "\n\n"));
  }, 2000);
  req.on("close", () => clearInterval(i));
});

// =============== WEBHOOK VERIFY ===============
app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// =============== SEND MESSAGE ===============
const send = async (to, payload) => {
  try {
    await axios.post("https://graph.facebook.com/v20.0/" + PHONE_NUMBER_ID + "/messages", payload, {
      headers: { Authorization: "Bearer " + WA_TOKEN }
    });
    addLog("out", to, payload.text?.body || payload.type || "menu");
  } catch (e) {
    addLog("out", "", "ERROR: " + (e.response?.data?.error?.message || e.message));
  }
};

const mainMenu = (to) => send(to, {
  messaging_product: "whatsapp", to,
  type: "interactive",
  interactive: {
    type: "button",
    header: { type: "text", text: "BlackLab" },
    body: { text: "Welcome to *BlackLab Systems*\n\nChoose:" },
    footer: { text: "BlackLab Systems" },
    action: {
      buttons: [
        { type: "reply", reply: { id: "buy", title: "Buy Data" } },
        { type: "reply", reply: { id: "balance", title: "Check Balance" } },
        { type: "reply", reply: { id: "about", title: "About Us" } }
      ]
    }
  }
});

const bundles = (to) => send(to, {
  messaging_product: "whatsapp", to,
  type: "interactive",
  interactive: {
    type: "list",
    header: { type: "text", text: "Data Bundles" },
    body: { text: "Pick your package (30 days)" },
    footer: { text: "BlackLab Systems" },
    action: {
      button: "Show Bundles",
      sections: [{
        rows: [
          { id: "b1", title: "1 GB  • KSh 29" },
          { id: "b3", title: "3 GB  • KSh 69" },
          { id: "b5", title: "5 GB  • KSh 99" },
          { id: "b10", title: "10 GB • KSh 179" },
          { id: "b20", title: "20 GB • KSh 329" },
          { id: "night", title: "Unlimited Night • KSh 49" }
        ]
      }]
    }
  }
});

// =============== WEBHOOK ===============
let lastId = "";
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg || msg.message_id === lastId) return res.sendStatus(200);
    lastId = msg.message_id;

    const from = msg.from;
    const id = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "";

    addLog("in", from, msg.text?.body || id || "media");

    if (id === "buy") return bundles(from);
    if (id === "about") {
      await send(from, { messaging_product: "whatsapp", to: from, type: "text", text: { body: "*BlackLab Systems*\nKenya's fastest data vendor.\nInstant • Cheap • 24/7" } });
      setTimeout(() => mainMenu(from), 4000);
      return res.sendStatus(200);
    }
    if (id.startsWith("b") || id === "night") {
      await send(from, { messaging_product: "whatsapp", to: from, type: "text", text: { body: "You chose a bundle!\n\nM-Pesa STK Push coming in seconds...\nAccept to get data instantly!" } });
      setTimeout(() => mainMenu(from), 7000);
      return res.sendStatus(200);
    }

    // First message or anything else → main menu
    mainMenu(from);
    res.sendStatus(200);
  } catch (e) {
    addLog("out", "", "ERROR: " + e.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  addLog("out", "", "BlackLab Bot started – port " + PORT);
  console.log("LIVE → https://" + (process.env.RENDER_EXTERNAL_HOSTNAME || "your-app.onrender.com"));
});
