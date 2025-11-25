import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ENV variables
const token = process.env.WHATSAPP_TOKEN;
const phone_number_id = process.env.PHONE_NUMBER_ID;

// ---------- HELPER FUNCTIONS ----------

// Send typing indicator (looks natural)
async function sendTypingIndicator(to) {
  await axios.post(
    `https://graph.facebook.com/v20.0/${phone_number_id}/messages`,
    {
      messaging_product: "whatsapp",
      to: to,
      type: "typing_on"
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );
}

// Send normal text message
async function sendText(to, message) {
  await axios.post(
    `https://graph.facebook.com/v20.0/${phone_number_id}/messages`,
    {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: {
        body: `${message}\n\n— Blacklab Systems`
      }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );
}

// ---------- MESSAGE HANDLER (COMMAND SYSTEM) ----------
async function handleUserMessage(from, text) {
  const msg = text.trim().toLowerCase();

  // COMMANDS
  const commands = {
    hi: "Hello! How can I assist you today?",
    hello: "Hello! How can I assist you today?",

    help: "Here are the commands you can use:\n- hi\n- help\n- about\n- menu",

    about:
      "I am Blacklab, your intelligent assistant. I'm here to make your experience smooth and efficient!",

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
