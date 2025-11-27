import express from "express";
import bodyParser from "body-parser";
import { sendTemplate } from "./whatsapp.js";
import { getTemplateConfig } from "./templates.js";

const app = express();
app.use(bodyParser.json());

app.get("/webhook", (req, res) => {
  const verify = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (verify === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body?.toLowerCase() || "";

      const template = getTemplateConfig(text);
      if (template) {
        await sendTemplate(from, template.name, template.components);
      }
    }
  } catch (err) {
    console.log("Webhook error:", err.message);
  }

  return res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => {
  console.log("BlackLab bot running");
});
