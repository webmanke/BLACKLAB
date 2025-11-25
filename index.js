import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ENV variables
const token = process.env.WHATSAPP_TOKEN;
const phone_number_id = process.env.PHONE_NUMBER_ID;

// ---------- HELPER FUNCTIONS ----------

// Send typing indicator
async function sendTypingIndicator(to) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${phone_number_id}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "typing_on",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Typing error:", err.response?.data || err.message);
  }
}

// Send text
async function sendText(to, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${phone_number_id}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: {
          body: `${message}\n\n— Blacklab Systems`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Send text error:", err.response?.data || err.message);
  }
}

// ---------- MESSAGE HANDLER ----------
async function handleUserMessage(from, text) {
  const msg = text.trim().toLowerCase();

  const commands = {
    hi: "Hello! How can I assist you today?",
    hello: "Hello! How can I assist you today?",
    help: "Commands:\n- hi\n- help\n- about\n- menu",
    about:
      "I am Blacklab, your intelligent assistant built to serve users smoothly and smartly.",
    menu: "Main Menu:\n1. About Blacklab\n2. Help\n3. Features (coming soon)",
    default:
      "I didn’t understand that yet. Type *help* to see what I can do.",
  };

  const reply = commands[msg] || commands.default;
  await sendText(from, reply);
}

// ---------- WEBHOOK (POST) ----------
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body || "";

    await sendTypingIndicator(from);
    await handleUserMessage(from, text);

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// ---------- WEBHOOK VERIFICATION ----------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ---------- START SERVER ----------
app.listen(3000, () => console.log("Blacklab bot running smoothly 🚀"));      "I am Blacklab, your intelligent assistant. I'm here to make your experience smooth and efficient!",

    menu:
      "Main Menu:\n1. About Blacklab\n2. Help Center\n3. Coming Soon Features 🚀",

    default:
      "I'm not sure I understand that yet — but I'm learning! Type *help* to see what I can do."
  };

  const reply = commands[msg] || commands.default;
  await sendText(from, reply);
}

// ---------- WEBHOOK POST ----------
app.post("/webhook", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body || "";

    // Show typing animation
    await sendTypingIndicator(from);

    // Handle the message
    await handleUserMessage(from, text);

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error.response?.data || error);
    res.sendStatus(500);
  }
});

// ---------- WEBHOOK VERIFICATION ----------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const verify = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && verify === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// ---------- START SERVER ----------
app.listen(3000, () =>
  console.log("Blacklab bot running smoothly 🚀")
);                  reply: {
                    id: "help_option",
                    title: "Help"
                  }
                }
              ]
            }
          }
        },
        {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error sending message:", error.response?.data || error);
    res.sendStatus(500);
  }
});

app.listen(3000, () =>
  console.log("BlackLab bot running on port 3000 🚀")
);
