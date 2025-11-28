const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// In-memory logs for dashboard
let logs = [];
const log = (dir, phone = "", text = "") => {
  logs.push({
    t: new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    d: dir, // in / out
    p: phone ? phone.slice(-5) : "",
    m: text.substring(0, 120)
  });
  if (logs.length > 400) logs = logs.slice(-400);
};

// CLEAN & PREMIUM DASHBOARD
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BlackLab Systems • Control Panel</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body{margin:0;font-family:'Inter',sans-serif;background:#f8f9fc;color:#1a1a1a;line-height:1.5}
  .header{background:linear-gradient(135deg,#0044ff,#0077ff);color:white;padding:2rem 1rem;text-align:center}
  .logo{font-size:2.4rem;font-weight:700;margin:0;letter-spacing:-1px}
  .status{padding:0.4rem 1rem;background:#00ff88;color:#000;border-radius:2rem;font-size:0.9rem;font-weight:600}
  .main{max-width:1100px;margin:0 auto;padding:1.5rem}
  .card{background:white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.06);overflow:hidden}
  .card h2{background:#f1f3f9;padding:1rem 1.5rem;margin:0;font-size:1.1rem;font-weight:600;color:#333}
  .logs{padding:1rem;background:#0c0c0c;color:#0f0;font:0.92rem 'JetBrains Mono',monospace;height:560px;overflow-y:auto}
  .log{display:flex;gap:12px;margin:4px 0}
  .t{color:#666;width:70px;flex-shrink:0}
  .in{color:#00ff9d}
  .out{color:#6ebdff}
  footer{text-align:center;padding:2rem;color:#777;font-size:0.9rem}
</style>
</head>
<body>
<div class="header">
  <h1 class="logo">BlackLab</h1>
  <div class="status">ONLINE • LIVE</div>
</div>
<div class="main">
  <div class="card">
    <h2>Real-Time Activity</h2>
    <div class="logs" id="l">Connecting to bot...</div>
  </div>
</div>
<footer>© 2025 BlackLab Systems • Instant Data • Kenya</footer>

<script>
  const l = document.getElementById('l');
  const es = new EventSource('/logs');
  es.onmessage = e => {
    const o = JSON.parse(e.data);
    const line = document.createElement('div');
    line.className = 'log';
    line.innerHTML = `<span class="t">[\( {o.t}]</span><span class=" \){o.d==='in'?'in':'out'}">\( {o.d==='in'?'←':'→'} \){o.p?o.p+': ':''}${o.m}</span>`;
    l.appendChild(line);
    l.scrollTop = l.scrollHeight;
  };
</script>
</body>
</html>`);
});

// LIVE LOGS STREAM
app.get("/logs", (req, res) => {
  res.set({"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive"});
  res.flushHeaders();
  logs.forEach(x => res.write("data: "+JSON.stringify(x)+"\n\n"));
  const int = setInterval(() => logs.slice(-8).forEach(x => res.write("data: "+JSON.stringify(x)+"\n\n")), 1800);
  req.on("close", () => clearInterval(int));
});

// WEBHOOK VERIFY
app.get("/webhook", (req,res) => {
  if (req.query["hub.mode"]==="subscribe" && req.query["hub.verify_token"]===VERIFY_TOKEN)
    return res.send(req.query["hub.challenge"]);
  res.sendStatus(403);
});

// SEND MESSAGE + LOG
const send = async (to, payload) => {
  try {
    await axios.post("https://graph.facebook.com/v20.0/"+PHONE_NUMBER_ID+"/messages", payload, {
      headers: { Authorization: "Bearer "+WA_TOKEN }
    });
    log("out", to, payload.text?.body || payload.interactive?"Menu":"Media");
  } catch (e) {
    log("out", "", "ERROR: "+(e.response?.data?.error?.message || e.message));
  }
};

// MENUS
const mainMenu = to => send(to, {messaging_product:"whatsapp",to,type:"interactive",interactive:{
  type:"button",header:{type:"text",text:"BlackLab"},
  body:{text:"Welcome to *BlackLab Systems*\n\nHow can we help you today?"},
  footer:{text:"BlackLab Systems"},
  action:{buttons:[
    {type:"reply",reply:{id:"buy",title:"Buy Data"}},
    {type:"reply",reply:{id:"balance",title:"Check Balance"}},
    {type:"reply",reply:{id:"about",title:"About Us"}}
  ]}
}});

const bundles = to => send(to, {messaging_product:"whatsapp",to,type:"interactive",interactive:{
  type:"list",header:{type:"text",text:"Data Bundles"},
  body:{text:"Choose your package — valid 30 days"},
  footer:{text:"BlackLab Systems"},
  action:{button:"View Bundles",sections:[{
    rows:[
      {id:"p1",title:"1 GB • KSh 29"},
      {id:"p3",title:"3 GB • KSh 69"},
      {id:"p5",title:"5 GB • KSh 99"},
      {id:"p10",title:"10 GB • KSh 179"},
      {id:"p20",title:"20 GB • KSh 329"},
      {id:"night",title:"Unlimited Night • KSh 49"}
    ]
  }]}
}});

// WEBHOOK — BULLETPROOF
let lastMsgId = "";
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg || msg.message_id === lastMsgId) return res.sendStatus(200);
    lastMsgId = msg.message_id;

    const from = msg.from;
    const btn = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "";

    log("in", from, msg.text?.body || btn || "media");

    if (btn === "buy") return bundles(from);
    if (btn === "about") {
      await send(from, {messaging_product:"whatsapp",to:from,type:"text",text:{body:"*BlackLab Systems*\nKenya's fastest instant data vendor.\n• Delivery in seconds\n• Best prices\n• 24/7"}});
      setTimeout(()=>mainMenu(from),4000);
      return res.sendStatus(200);
    }
    if (btn) { // any bundle selected
      await send(from, {messaging_product:"whatsapp",to:from,type:"text",text:{body:"You selected a bundle!\n\nM-Pesa STK Push coming in seconds.\nAccept to receive data instantly!"}});
      setTimeout(()=>mainMenu(from),7000);
      return res.sendStatus(200);
    }

    // First message or anything else → show main menu
    mainMenu(from);
    res.sendStatus(200);
  } catch (e) {
    log("out", "", "ERROR: "+e.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log("out", "", "BlackLab Bot LIVE – Dashboard ready");
  console.log("Deployed and working perfectly");
});
