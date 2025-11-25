import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ENV Variables
const token = process.env.WHATSAPP_TOKEN;
const phone_number_id = process.env.PHONE_NUMBER_ID;
const verify_token = process.env.VERIFY_TOKEN;

// -------------------------------------------------------
// SEND TEXT
// -------------------------------------------------------
async function sendText(to, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${phone_number_id}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: `${message}\n\n— Blacklab Systems` },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("sendText error:", error.response?.data || error);
  }
}

// -------------------------------------------------------
// HANDLE USER MESSAGE
// -------------------------------------------------------
async function handleIncomingMessage(from, text) {
  const msg = text.trim().toLowerCase();

  // BASIC COMMANDS (Your custom replies)
  if (msg === "hi" || msg === "hello") {
    return sendText(from, "Hello! How can I assist you today?");
  }

  if (msg === "help") {
    return sendText(
      from,
      "Here are the commands you can use:\n- hi\n- help\n- about\n- menu"
    );
  }

  if (msg === "about") {
    return sendText(
      from,
      "I am Blacklab, your intelligent WhatsApp assistant."
    );
  }

  if (msg === "menu") {
    return sendText(
      from,
      "Main Menu:\n1. About Blacklab\n2. Help\n3. More features coming soon 🚀"
    );
  }

  // DEFAULT
  return sendText(
    from,
    "I didn't understand that yet. Type *help* to see available commands."
  );
}

// -------------------------------------------------------
// WEBHOOK POST
// -------------------------------------------------------
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body || "";

    await handleIncomingMessage(from, text);

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook POST error:", error);
    res.sendStatus(500);
  }
});

// -------------------------------------------------------
// WEBHOOK VERIFY
// -------------------------------------------------------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verify_token) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// -------------------------------------------------------
app.listen(3000, () => {
  console.log("Blacklab bot running successfully 🚀");
});
