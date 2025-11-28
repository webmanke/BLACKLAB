const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// environment variables (UPPERCASE)
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Webhook verification
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token === VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    } else {
        return res.sendStatus(403);
    }
});

// Incoming messages
app.post("/webhook", async (req, res) => {
    try {
        const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

        if (message && message.from) {
            await sendInteractiveButtons(message.from);
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("Webhook error:", err.message);
        res.sendStatus(500);
    }
});

// Send interactive buttons
async function sendInteractiveButtons(to) {
    const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

    const data = {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
            type: "button",
            body: {
                text: "Welcome to BlackLab!\nChoose an option:"
            },
            action: {
                buttons: [
                    {
                        type: "reply",
                        reply: {
                            id: "buy_bundle",
                            title: "Buy Data Bundle"
                        }
                    },
                    {
                        type: "reply",
                        reply: {
                            id: "check_balance",
                            title: "Check Balance"
                        }
                    }
                ]
            }
        }
    };

    try {
        await axios.post(url, data, {
            headers: {
                Authorization: `Bearer ${WA_TOKEN}`,
                "Content-Type": "application/json"
            }
        });

        console.log("Interactive message sent to:", to);
    } catch (error) {
        console.error("Error sending interactive message:", error.response?.data || error.message);
    }
}

// Home
app.get("/", (req, res) => {
    res.send("BlackLab WhatsApp Bot running with UPPERCASE env variables!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started on port " + PORT));
