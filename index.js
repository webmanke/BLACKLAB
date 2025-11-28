const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Live logs storage
const logs = [];
const addLog = (type, from, text) => {
  const entry = {
    time: new Date().toLocaleTimeString("en-KE", { hour12: false }),
    type, // 'in' | 'out' | 'system'
    from: from || "",
    text: text.slice(0, 200)
  };
  logs.push(entry);
  if (logs.length > 500) logs.shift();
};

// ==================== PROFESSIONAL DASHBOARD WITH LIVE LOGS ====================
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>BlackLab Systems • Live Dashboard</title>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
  <style>
    :root{--p:#0066ff;--s:#00ba34;--d:#111;--l:#f8f9fa;}
    body{margin:0;font-family:'Inter',sans-serif;background:#fff;color:#222;}
    header{background:linear-gradient(135deg,var(--p),#00d4ff);color:#fff;text-align:center;padding:50px 20px;border-radius:0 0 25px 25px;}
    .logo{font-size:5rem;font-weight:900;margin:0;background:linear-gradient(90deg,#fff,#ddd);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
    .status{display:inline-block;padding:10px 25px;background:var(--s);border-radius:50px;font-weight:bold;}
    .container{max-width:1100px;margin:0 auto;padding:20px;}
    .card{background:#fff;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.1);padding:25px;margin:30px 0;}
    .logs{max-height:600px;overflow-y:auto;background:#0d0d0d;color:#0f0;font-family:'Courier New',monospace;padding:15px;border-radius:10px;}
    .in{color:#00ff88;}
    .out{color:#88ccff;}
    .sys{color:#ffcc00;}
    .time{color:#888;margin-right:10px;}
    footer{text-align:center;padding:40px;color:#666;}
    .blink{animation:b 1s infinite;}@keyframes b{50%{opacity:0.4;}}
  </style>
</head>
<body>
  <header>
    <h1 class="logo">BlackLab</h1>
    <p style="font-size:1.8rem;margin:15px 0;">WhatsApp Bot Dashboard</p>
    <div class="status">ONLINE <i class="fas fa-circle blink"></i></div>
  </header>

  <div class="container">
    <div class="card">
      <h2><i class="fas fa-terminal"></i> Real-Time Logs</h2>
      <div class="logs" id="logs"><div style="color:#666;padding:20px;text-align:center;">Waiting for activity…</div></div>
    </div>
  </div>

  <footer>© 2025 BlackLab Systems • Made with ❤️ in Kenya • ${new Date().toLocaleDateString()}</footer>

  <script>
    const logDiv = document.getElementById('logs');
    const es = new EventSource('/logs');
    es.onmessage = e => {
      const d = JSON.parse(e.data);
      const line = document.createElement('div');
      line.innerHTML = \`<span class="time">[\${d.time}]</span>
        <span class="\${d.type === 'in' ? 'in' : d.type === 'out' ? 'out' : 'sys'}">
          \${d.type === 'in' ? '←' : '→'} \${d.from ? d.from + ':' : ''} \${d.text}
        </span>\`;
      logDiv.appendChild(line);
      logDiv.scrollTop = logDiv.scrollHeight;
    };
  </script>
</body>
</html>`);
});

// ==================== LIVE LOGS STREAM (SSE) ====================
app.get("/logs", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });
  res.flushHeaders();

  logs.forEach(l => res.write(`data: ${JSON.stringify(l)}\n\n`));

  const interval = setInterval(() => {
    if (logs.length > 0) {
      const recent = logs.slice(-5);
      recent.forEach(l => res.write(`data: ${JSON.stringify(l)}\n\n`));
    }
  }, 2000);

  req.on("close", () => clearInterval(interval));
});

// ==================== WEBHOOK VERIFICATION ====================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

// ==================== SEND + LOG ====================
const send = async (to, payload) => {
  try {
    await axios.post(\`https://graph.facebook.com/v20.0/\${PHONE_NUMBER_ID}/messages\`, payload, {
      headers: { Authorization: \`Bearer \${WA_TOKEN}\` }
    });
    addLog("out", to.slice(-10), payload.text?.body || payload.type || "interactive");
  } catch (e) {
    addLog("out", "ERROR", e.response?.data?.error?.message || e.message);
  }
};

// ==================== MENUS ====================
const mainMenu = async (to) => send(to, {
  messaging_product: "whatsapp", to,
  type: "interactive",
  interactive: {
    type: "button",
    header: { type: "text", text: "BlackLab" },
    body: { text: "Welcome to *BlackLab Systems*\\n\\nHow can we help you today?" },
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

const bundlesList = async (to) => send(to, {
  messaging_product: "whatsapp", to,
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

const about = async (to) => {
  await send(to, {
    messaging_product: "whatsapp", to,
    type: "image",
    image: {
      link: "https://i.imgur.com/8Qz8KZm.jpeg",
      caption: "*BlackLab Systems*\\n\\nKenya's #1 instant data vendor.\\n\\n• Delivery in seconds\\n• Lowest prices\\n• 24/7 service\\n\\nThank you for choosing us!"
    }
  });
  setTimeout(() => send(to, {
    messaging_product: "whatsapp", to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Need anything else?" },
      footer: { text: "BlackLab Systems" },
      action: { buttons: [{ type: "reply", reply: { id: "main", title: "Back to Menu" } }] }
    }
 2500);
};

// ==================== WEBHOOK ====================
let lastMsgId = "";
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg || msg.message_id === lastMsgId) return res.sendStatus(200);
    lastMsgId = msg.message_id;

    const from = msg.from;
    const text = msg.text?.body || "";
    const id = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "";

    addLog("in", from.slice(-10), text || id || "media");

    if (id === "buy") return await bundlesList(from);
    if (id === "about") return await about(from);
    if (id === "main") return await mainMenu(from);
    if (id === "balance") {
      await send(from, { messaging_product: "whatsapp", to: from, type: "text", text: { body: "Balance check coming soon!" } });
      setTimeout(() => mainMenu(from), 5000);
      return res.sendStatus(200);
    }
    if (id.startsWith("b_")) {
      const map = { b_1gb: "1 GB → KSh 29", b_3gb: "3 GB → KSh 69", b_5gb: "5 GB → KSh 99", b_10gb: "10 GB → KSh 179", b_20gb: "20 GB → KSh 329", b_night: "Unlimited Night → KSh 49" };
      await send(from, { messaging_product: "whatsapp", to: from, type: "text", text: { body: \`You selected *\${map[id]}*\\n\\nYou will receive an M-Pesa STK Push shortly.\\nPlease accept the prompt to complete purchase.\` } });
      setTimeout(() => mainMenu(from), 8000);
      return res.sendStatus(200);
    }

    // Default → main menu
    await mainMenu(from);
    res.sendStatus(200);
  } catch (e) {
    addLog("out", "ERROR", e.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  addLog("system", "START", \`Server live on port \${PORT}\`);
  console.log(\`BlackLab Bot + Dashboard → https://your-app.onrender.com\`);
});
