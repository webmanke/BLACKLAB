import express from "express";
import axios from "axios";
import qs from "qs";
import "dotenv/config";

const app = express();
app.use(express.json());

// ----------------------
// TEMP SESSION MEMORY
// ----------------------
const sessions = {}; 
function getSession(user) {
  if (!sessions[user]) sessions[user] = {};
  return sessions[user];
}

// ----------------------
// SEND MESSAGE HELPER
// ----------------------
async function sendMessage(to, messageObj) {
  try {
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
      data: {
        messaging_product: "whatsapp",
        to,
        ...messageObj,
      },
    });
  } catch (err) {
    console.error("WhatsApp API Error:", err.response?.data || err.message);
  }
}

// ----------------------
// MAIN REPLY HANDLER
// ----------------------
async function handleIncomingMessage(from, body, type) {
  const session = getSession(from);

  // ------------------------
  // BUTTON CLICKS
  // ------------------------
  if (type === "interactive") {
    const buttonId = body?.interactive?.button_reply?.id;

    if (buttonId === "ENTER_NAME") {
      session.awaiting = "name";
      return sendMessage(from, {
        text: { body: "Great! Please enter your name:" }
      });
    }

    if (buttonId === "ENTER_EMAIL") {
      session.awaiting = "email";
      return sendMessage(from, {
        text: { body: "Please type your email address:" }
      });
    }

    if (buttonId === "SHOW_INFO") {
      return sendMessage(from, {
        text: { body: `Here’s what I know so far:\n\nName: ${session.name || "Not set"}\nEmail: ${session.email || "Not set"}` }
      });
    }

    return sendMessage(from, { text: { body: "I clicked a button but didn’t understand which!" } });
  }

  // ------------------------
  // NORMAL TEXT MESSAGES
  // ------------------------
  const text = body?.text?.body?.trim();

  if (session.awaiting === "name") {
    session.name = text;
    session.awaiting = null;

    return sendMessage(from, {
      text: { body: `Nice to meet you, ${session.name}!` }
    });
  }

  if (session.awaiting === "email") {
    session.email = text;
    session.awaiting = null;

    return sendMessage(from, {
      text: { body: `Your email *${session.email}* has been saved!` }
    });
  }

  // ------------------------
  // DEFAULT MENU MESSAGE
  // ------------------------
  return sendMessage(from, {
    text: { body: "Choose one option below 👇" },
    "type": "interactive",
    "interactive": {
      "type": "button",
      "body": { "text": "What would you like to do?" },
      "action": {
        "buttons": [
          {
            "type": "reply",
            "reply": { "id": "ENTER_NAME", "title": "Enter Name" }
          },
          {
            "type": "reply",
            "reply": { "id": "ENTER_EMAIL", "title": "Enter Email" }
          },
          {
            "type": "reply",
            "reply": { "id": "SHOW_INFO", "title": "Show Saved Info" }
          }
        ]
      }
    }
  });
}

// ----------------------
// WEBHOOK VERIFY
// ----------------------
app.get("/webhook", (req, res) => {
  let VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// ----------------------
// RECEIVE MESSAGES
// ----------------------
app.post("/webhook", (req, res) => {
  const data = req.body;

  try {
    const message = data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;
    const type = message.type;

    handleIncomingMessage(from, message, type);

    res.sendStatus(200);
  } catch (e) {
    console.error("Webhook error:", e);
    res.sendStatus(500);
  }
});

// ----------------------
app.listen(process.env.PORT || 3000, () => {
  console.log("Bot running...");
});
