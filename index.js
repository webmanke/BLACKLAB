const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Store logs + messages for live dashboard
const logs = [];
const addLog = (type, from, text) => {
  const time = new Date().toLocaleTimeString("en-KE", { hour12: false });
  logs.push({ time, type, from, text });
  if (logs.length > 500) logs.shift(); // keep last 500 entries
};

// =============== PROFESSIONAL WEBSITE WITH LIVE LOGS ===============
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>BlackLab Systems • Live Dashboard</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
  <style>
    :root { --primary: #0066ff; --success: #00ba34; --dark: #111; --light: #f8f9fa; }
    body {font-family: 'Inter', sans-serif; margin:0; background:#fff; color:#222;}
    .container {max-width:1100px; margin:0 auto; padding:20px;}
    header {text-align:center; padding:40px 20px; background:linear-gradient(135deg,#0066ff,#00d4ff); color:white; border-radius:0 0 20px 20px;}
    .logo {font-size:4.5rem; font-weight:900; margin:0; background:linear-gradient(90deg,#fff,#eee); -webkit-background-clip:text; -webkit-text-fill-color:transparent;}
    .status {display:inline-block; padding:8px 20px; background:#00ba34; color:white; border-radius:50px; font-weight:bold;}
    .dashboard {margin-top:-30px;}
    .card {background:white; border-radius:15px; box-shadow:0 10px 30px rgba(0,0,0,0.1); padding:25px; margin:20px 0;}
    .logs {max-height:600px; overflow-y:auto; background:#0a0a0a; color:#0f0; padding:15px; border-radius:10px; font-family: 'Courier New', monospace; font-size:0.95rem;}
    .log-in {color:#00ff88;}
    .log-out {color:#88ccff;}
    .log-time {color:#aaa; margin-right:10px;}
    footer {text-align:center; padding:30px; color:#666; font-size:0.9rem;}
    .blink {animation: blink 1s infinite;}
    @keyframes blink {50%{opacity:0.5;}}
  </style>
</head>
<body>
  <header>
    <h1 class="logo">BlackLab</h1>
    <p style="font-size:1.8rem; margin:10px 0;">WhatsApp Bot Live Dashboard</p>
    <div class="status">ONLINE <i class="fas fa-circle blink"></i></div>
  </header>

  <div class="container dashboard">
    <div class="card">
      <h2><i class="fas fa-chart-line"></i> Real-Time Activity Log</h2>
      <div class="logs" id="logs">
        <div style="color:#666; text-align:center; padding:20px;">Waiting for messages...</div>
      </div>
    </div>
  </div>

  <footer>© 2025 BlackLab Systems • Made with ❤️ in Kenya • ${new Date().toLocaleString()}</footer>

  <script>
    const logDiv = document.getElementById('logs');
    const es = new EventSource('/logs');
    es.onmessage = function(e) {
      const data = JSON.parse(e.data);
      const line = document.createElement('div');
      line.innerHTML = `<span class="log-time">[${data.time}]</span> 
                        <span class="${data.type === 'in' ? 'log-in' : 'log-out'}">
                          \( {data.type === 'in' ? '←' : '→'} \){data.from ? data.from + ':' : ''} ${data.text}
                        </span>`;
      logDiv.appendChild(line);
      logDiv.scrollTop = logDiv.scrollHeight;
      if (logDiv.children.length > 1) logDiv.children[0].remove();
    };
  </script>
</body>
</html>
  `);
});

// =============== LIVE LOGS STREAM (SSE) ===============
app.get("/logs", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send existing logs
  logs.forEach(log => res.write(`data: ${JSON.stringify(log)}\n\n`));

  // Keep connection open and push new logs
  const interval = setInterval(() => {
    if (logs.length > 0) {
      const recent = logs.slice(-10);
      recent.forEach(log => res.write(`data: ${JSON.stringify(log)}\n\n`));
    }
  }, 2000);

  req.on("close", () => clearInterval(interval));
});

// =============== WEBHOOK VERIFICATION ===============
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

// =============== SEND MESSAGE + LOG ===============
async function sendAndLog(to, payload) {
  try {
    await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, payload, {
      headers: { Authorization: `Bearer ${WA_TOKEN}` }
    });
    addLog("out", to.slice(-10), payload.type === "text" ? payload.text.body : payload.type.toUpperCase());
  } catch (e) {
    addLog("out", "ERROR", e.response?.data?.error?.message || e.message);
  }
}

// =============== MENUS ===============
const sendMainMenu = async (to) => {
  await sendAndLog(to, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: { type: "text", text: "BlackLab" },
      body: { text: "Welcome to *BlackLab Systems*\n\nHow can we help you today?" },
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
};

const sendBundlesList = async (to) => {
  await sendAndLog(to, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: "Data Bundles" },
      body: { text: "Choose your package — valid 30 days" },
      footer: { text: "BlackLab Systems" },
      action: {
        button: "View Bundles",
        sections: [{
          rows: [
            { id: "b_1gb", title: "1 GB → KSh 29", description: "Daily & weekly" },
            { id: "b_3gb", title: "3 GB → KSh 69", description: "Most popular" },
            { id: "b_5gb", title: "5 GB → KSh 99", description: "Best value" },
            { id: "b_10gb", title: "10 GB → KSh 179", description: "Heavy user" },
            { id: "b_20gb", title: "20 GB → KSh 329", description: "Power user" },
            { id: "b_night", title: "Unlimited Night → KSh 49", description: "12am–6am" }
          ]
        }]
      }
    }
  });
};

const sendAbout = async (to) => {
  await sendAndLog(to, {
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: {
      link: "https://i.imgur.com/8Qz8KZm.jpeg",
      caption: "*BlackLab Systems*\n\nKenya's #1 instant data vendor.\n\n• Delivery in seconds\n• Lowest prices\n• 24/7 automated\n• Trusted by thousands\n\nThank you for choosing us!"
    }
  });

  setTimeout(() => sendAndLog(to, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Need anything else?" },
      footer: { text: "BlackLab Systems" },
      action: { buttons: [{ type: "reply", reply: { id: "main", title: "Back to Menu" } }] }
    }
  }), 2500);
};

// =============== MAIN WEBHOOK – BULLETPROOF ===============
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text?.body || "";
    const buttonId = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "";

    // Log incoming
    addLog("in", from.slice(-10), text || buttonId || "media/unknown");

    // Prevent duplicates
    if (global.lastProcessed === msg.message_id) return res.sendStatus(200);
    global.lastProcessed = msg.message_id;

    // Handle commands
    if (buttonId === "buy") {
      await sendBundlesList(from);
    }
    else if (buttonId === "about") {
      await sendAbout(from);
    }
    else if (buttonId === "main") {
      await sendMainMenu(from);
    }
    else if (buttonId === "balance") {
      await sendAndLog(from, {
        messaging_product: "whatsapp", to: from, type: "text",
        text: { body: "Balance check coming soon!\nWe are connecting to Safaricom API." }
      });
      setTimeout(() => sendMainMenu(from), 5000);
    }
    else if (buttonId.startsWith("b_")) {
      const map = { b_1gb: "1 GB → KSh 29", b_3gb: "3 GB → KSh 69", b_5gb: "5 GB → KSh 99", b_10gb: "10 GB → KSh 179", b_20gb: "20 GB → KSh 329", b_night: "Unlimited Night → KSh 49" };
      const pkg = map[buttonId] || buttonId;

      await sendAndLog(from, {
        messaging_product: "whatsapp",
        to: from,
        type: "text",
        text: { body: `You selected *${pkg}*\n\nYou will receive an M-Pesa STK Push shortly.\n\nPlease accept the prompt to complete purchase.\n\nData delivered in seconds!` }
      });

      setTimeout(() => sendMainMenu(from), 8000);
    }
    else {
      // First message or text → show main menu
      await sendMainMenu(from);
    }

    res.sendStatus(200);
  } catch (err) {
    addLog("out", "ERROR", err.response?.data?.error?.message || err.message);
    console.error(err);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  addLog("system", "SERVER", `BlackLab Bot started – listening on port ${PORT}`);
  console.log(`BlackLab Bot LIVE with real-time dashboard → https://your-app.onrender.com`);
});
