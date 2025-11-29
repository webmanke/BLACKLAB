const axios = require("axios");
const storage = require("./storage");

const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const HEADER_IMG = "https://i.imgur.com/elSEhEg.jpeg";
const FOOTER = "BlackLab Systems • Instant • Trusted • 24/7";

const sessions = new Map();
const processed = new Set();

const send = async (to, { body, buttons = [] }) => {
  const payload = {
    messaging_product: "whatsapp", to,
    type: "interactive",
    interactive: {
      type: "button",
      header: { type: "image", image: { link: HEADER_IMG } },
      body: { text: body },
      footer: { text: FOOTER },
      action: { buttons }
    }
  };
  await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, payload, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` }
  });
  storage.addUser(to);
};

const mainMenu = (to) => send(to, {
  body: "*Welcome to BlackLab Systems*\nKenya's #1 Instant Bundles\n\nWhat do you want?",
  buttons: [
    { type: "reply", reply: { id: "packages", title: "See Packages" } },
    { type: "reply", reply: { id: "about", title: "About Us" } },
    { type: "reply", reply: { id: "contact", title: "Contact Us" } }
  ]
});

const showPackages = async (to, cat) => {
  const pkgs = storage.getPackages().filter(p => p.category === cat);
  const buttons = pkgs.slice(0, 3).map(p => ({ type: "reply", reply: { id: `buy_${p.id}`, title: p.title } }));
  send(to, { body: `*${cat.toUpperCase()} BUNDLES*\nChoose:`, buttons });
};

module.exports = {
  verify: (req, res) => {
    if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === process.env.VERIFY_TOKEN)
      return res.send(req.query["hub.challenge"]);
    res.sendStatus(403);
  },
  handle: async (req, res) => {
    try {
      const msgs = req.body.entry?.[0]?.changes?.[0]?.value?.messages || [];
      for (const msg of msgs) {
        if (processed.has(msg.id)) continue;
        processed.add(msg.id);

        const from = msg.from;
        const btn = msg.interactive?.button_reply?.id || "";

        if (btn === "packages") {
          send(from, {
            body: "Select category:",
            buttons: [
              [
              { type: "reply", reply: { id: "cat_data", title: "Data" } },
              { type: "reply", reply: { id: "cat_minutes", title: "Minutes" } },
              { type: "reply", reply: { id: "cat_sms", title: "SMS" } }
            ]
          });
        } else if (btn.startsWith("cat_")) {
          showPackages(from, btn.split("_")[1]);
        } else if (btn === "about") {
          send(from, { body: "*About Us*\nFastest vendor in Kenya\n1M+ bundles sold\n100% instant", buttons: [{ type: "reply", reply: { id: "main", title: "Back" } }] });
        } else if (btn === "contact") {
          send(from, { body: "*Contact*\n+254 712 345 678\nsupport@blacklab.co.ke", buttons: [{ type: "reply", reply: { id: "main", title: "Back" } }] });
        } else if (btn === "main") {
          mainMenu(from);
        } else {
          mainMenu(from);
        }
      }
      res.sendStatus(200);
    } catch (e) { res.sendStatus(500); }
  }
};
