const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Prevent processing the same message twice (stops loops forever)
const processedMessages = new Set();

// ==================== PROFESSIONAL LANDING PAGE ====================
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>BlackLab Systems • WhatsApp Bot</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
  <style>
    body{font-family:'Segoe UI',sans-serif;margin:0;background:#fff;color:#1a1a1a;line-height:1.6;}
    .container{max-width:900px;margin:0 auto;padding:40px 20px;text-align:center;}
    .logo{font-size:4.5rem;font-weight:900;background:linear-gradient(135deg,#0066ff,#00ff88);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
    .status{color:#00ba34;font-weight:600;}
    .features{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:25px;margin:50px 0;}
    .card{background:#f8f9fa;padding:30px;border-radius:15px;box-shadow:0 5px 15px rgba(0,0,0,0.05);transition:0.3s;}
    .card:hover{transform:translateY(-8px);box-shadow:0 15px 30px rgba(0,0,0,0.1);}
    .icon{font-size:2.5rem;margin-bottom:15px;color:#0066ff;}
    footer{padding:30px;background:#0f0f23;color:#ccc;font-size:0.9rem;}
  </style>
</head>
<body>
  <div class="container">
    <h1 class="logo">BlackLab</h1>
    <p style="font-size:1.6rem;margin:10px 0">
      WhatsApp Bot is <span class="status">ONLINE & STABLE</span>
    </p>
    <p style="color:#555;max-width:600px;margin:20px auto;">
      Instant data bundles • M-Pesa STK Push • 24/7 automated service
    </p>

    <div class="features">
      <div class="card"><i class="icon fas fa-bolt"></i><h3>Instant Delivery</h3><p>Data in under 10 seconds</p></div>
      <div class="card"><i class="icon fas fa-shield-alt"></i><h3>Secure</h3><p>Official WhatsApp Cloud API</p></div>
      <div class="card"><i class="icon fas fa-headset"></i><h3>24/7 Support</h3><p>Always here to help</p></div>
      <div class="card"><i class="icon fas fa-mobile-alt"></i><h3>M-Pesa Ready</h3><p>Pay with STK Push</p></div>
    </div>
  </div>
  <footer>© 2025 BlackLab Systems • Made with ❤️ in Kenya</footer>
</body>
</html>
  `);
});

// ==================== WEBHOOK VERIFICATION ====================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

// ==================== MENUS ====================
async function sendMainMenu(to) {
  await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
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
  }, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
}

async function sendBundlesList(to) {
  await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: "All Data Bundles" },
      body: { text: "Select your package — valid for 30 days" },
      footer: { text: "BlackLab Systems" },
      action: {
        button: "View Bundles",
        sections: [{
          rows: [
            { id: "b_1gb", title: "1 GB", description: "KSh 29 only" },
            { id: "b_3gb", title: "3 GB", description: "KSh 69 only" },
            { id: "b_5gb", title: "5 GB", description: "KSh 99 only" },
            { id: "b_10gb", title: "10 GB", description: "KSh 179 only" },
            { id: "b_20gb", title: "20 GB", description: "KSh 329 only" },
            { id: "b_night", title: "Unlimited Night", description: "KSh 49 · 12am–6am" }
          ]
        }]
      }
    }
  }, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
}

async function sendAbout(to) {
  // Image first
  await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: {
      link: "https://i.imgur.com/8Qz8KZm.jpeg", // ← change to your real logo later
      caption: "*BlackLab Systems*\n\nKenya's fastest & most reliable data reseller.\n\n• Instant activation\n• Best prices guaranteed\n• 24/7 support\n• Trusted by thousands\n\nThank you for choosing us!"
    }
  }, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });

  // Back button after 2 seconds
  setTimeout(() => {
    axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Anything else?" },
        footer: { text: "BlackLab Systems" },
        action: {
          buttons: [{ type: "reply", reply: { id: "main", title: "Back to Menu" } }]
        }
      }
    }, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
  }, 2000);
}

// ==================== MAIN WEBHOOK ====================
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg || processedMessages.has(msg.message_id)) return res.sendStatus(200);
    processedMessages.add(msg.message_id);

    const from = msg.from;
    const buttonId = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id;

    // Buy Data → show list
    if (buttonId === "buy") {
      return await sendBundlesList(from);
    }

    // About Us → image + back button
    if (buttonId === "about") {
      return await sendAbout(from);
    }

    // Back to main menu
    if (buttonId === "main") {
      return await sendMainMenu(from);
    }

    // Check Balance (placeholder)
    if (buttonId === "balance") {
      await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: "whatsapp",
        to: from,
        type: "text",
        text: { body: "Balance check feature coming soon!\nWe are integrating with Safaricom API." }
      }, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
      setTimeout(() => sendMainMenu(from), 5000);
      return res.sendStatus(200);
    }

    // Bundle selected from the list
    if (buttonId?.startsWith("b_")) {
      const map = {
        b_1gb: {name: "1 GB", price: 29},
        b_3gb: {name: "3 GB", price: 69},
        b_5gb: {name: "5 GB", price: 99},
        b_10gb: {name: "10 GB", price: 179},
        b_20gb: {name: "20 GB", price: 329},
        b_night: {name: "Unlimited Night", price: 49}
      };

      const {name, price} = map[buttonId];

      await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: "whatsapp",
        to: from,
        type: "text",
        text: { body: `You selected *\( {name}* for *KSh \){price}*\n\nYou will receive an M-Pesa STKSh Push shortly.\n\nPlease accept the prompt on your phone to complete purchase.\n\nData delivered instantly after payment!` }
      }, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });

      // Return to main menu after 8 seconds (no spam)
      setTimeout(() => sendMainMenu(from), 8000);
      return res.sendStatus(200);
    }

    // Default = show main menu
    await sendMainMenu(from);
    res.sendStatus(200);
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BlackLab Bot running perfectly on port ${PORT}`));
