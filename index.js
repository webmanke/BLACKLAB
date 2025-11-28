const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// Load environment variables
const VERIFY_TOKEN = process.env.verify_token;
const WA_TOKEN = process.env.wa_token;
const PHONE_NUMBER_ID = process.env.phone_number_id;

// Webhook Verification
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

// Handle incoming messages
app.post("/webhook", async (req, res) => {
    try {
        const body = req.body;

        if (body.object) {
            const entry = body.entry?.[0];
            const changes = entry.changes?.[0];
            const message = changes.value.messages?.[0];

            if (message && message.from) {
                const from = message.from;
                await sendInteractiveButtons(from);
            }
        }

        res.sendStatus(200);
    } catch (e) {
        console.error("Webhook Error:", e.message);
        res.sendStatus(500);
    }
});

// Function to send interactive buttons
async function sendInteractiveButtons(to) {
    const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

    const data = {
        messaging_product: "whatsapp",
        to: to,
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

        console.log("Interactive buttons sent to:", to);
    } catch (error) {
        console.error("Error sending interactive message:", error.response?.data || error.message);
    }
}

// Home route
app.get("/", (req, res) => {
    res.send("BlackLab WhatsApp bot is running with ENV variables + interactive buttons!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
