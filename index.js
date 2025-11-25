import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "blacklabverify";

// WEBHOOK VERIFY
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// MAIN BOT LOGIC
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;

      // Send interactive message with footer
      await axios.post(
        `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: "Hello 👋, welcome to BlackLab!"
            },
            footer: {
              text: "BlackLab Systems"
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: {
                    id: "status_option",
                    title: "Status"
                  }
                },
                {
                  type: "reply",
                  reply: {
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
