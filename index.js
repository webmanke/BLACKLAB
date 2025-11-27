import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import { menuTemplate } from "./templates.js";

const app = express();
app.use(bodyParser.json());

const token = process.env.WHATSAPP_TOKEN; // Your permanent token
const verifyToken = "blacklabverify";

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const tokenCheck = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && tokenCheck) {
    if (mode === "subscribe" && tokenCheck === verifyToken) {
      console.log("Webhook verified!");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

app.post("/webhook", async (req, res) => {
  const data = req.body;

  if (data.object && data.entry) {
    for (const entry of data.entry) {
      const changes = entry.changes;
      if (changes) {
        for (const change of changes) {
          const messages = change.value.messages;
          if (messages) {
            for (const message of messages) {
              const from = message.from;
              const text = message.text?.body;

              if (text?.toLowerCase() === "menu") {
                await sendMessage(from, menuTemplate);
              }
            }
          }
        }
      }
    }
  }

  res.sendStatus(200);
});

async function sendMessage(to, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v17.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        ...message
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (err) {
    console.error("Template send error:", err.response?.data || err.message);
  }
}

app.listen(process.env.PORT || 3000, () => {
  console.log("BlackLab bot running...");
});
