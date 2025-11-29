const axios = require("axios");
const storage = require("./storage");

const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const HEADER_IMG = "https://i.imgur.com/elSEhEg.jpeg";
const FOOTER = "BlackLab • Instant • 24/7";

const sessions = new Map();
const processed = new Set();

const send = async (to, { body, buttons = [] }) => {
  try {
    await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
      messaging_product: "whatsapp", to,
      type: "interactive",
      interactive: {
        type: "button",
        header: { type: "image", image: { link: HEADER_IMG } },
        body: { text: body },
        footer: { text: FOOTER },
        action: { buttons }
      }
    }, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
    storage.addUser(to);
  } catch (e) { console.error("Send failed:", e.message); }
};

const mainMenu = (to) => send(to, {
  body: "*Welcome to BlackLab Systems*\nKenya's #1 Instant Vendor\n\nChoose:",
  buttons: [
    { type: "reply", reply: { id: "packages", title: "See Packages" } },
    { type: "reply", reply: { id: "about", title: "About Us" } },
    { type: "reply", reply: { id: "contact", title: "Contact" } }
  ]
});

module.exports = {
  verify: (req, res) => {
    if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === process.env.VERIFY_TOKEN)
      return res.send(req.query["hub.challenge"]);
    res.sendStatus(403);
  },
  handle: async (req, res) => {
    try {
      for (const msg of req.body.entry?.[0]?.changes?.[0]?.value?.messages || []) {
        if (processed.has(msg.id)) continue;
        processed.add(msg.id);
        const from = msg.from;
        const btn = msg.interactive?.button_reply?.id || "";
        if (btn === "packages") {
          send(from, { body: "Select type:", buttons: [
            { type: "reply", reply: { id: "cat_data", title: "Data" } },
            { type: "reply", reply: { id: "cat_minutes", title: "Minutes" } },
            { type: "reply", reply: { id: "cat_sms", title: "SMS" } }
          ]});
        } else {
          mainMenu(from);
        }
      }
      res.sendStatus(200);
    } catch (e) { res.sendStatus(500); }
  }
};
