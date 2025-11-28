const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// Environment variables (UPSTASH/RENDER style - UPPERCASE)
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// In-memory sessions: phone → current menu state
const sessions = new Map();

// Webhook verification
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token === VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// Send menu function
async function sendMenu(to, menuKey = "main") {
    const menus = {
        main: {
            header: "BlackLab,
            body: "Welcome to *BlackLab*!\n\nHow can we help you today?",
            buttons: [
                { id: "buy_bundle", title: "Buy Data Bundle" },
                { id: "check_balance", title: "Check Balance" },
                { id: "support", title: "Talk to Support" },
                { id: "about", title: "About BlackLab" }
            ]
        },
        buy_bundle: {
            header: "Data Bundles",
            body: "Choose your data bundle:\n\nAll bundles valid for 30 days",
            buttons: [
                { id: "bundle_1gb", title: "1GB → R29" },
                { id: "bundle_5gb", title: "5GB → R99" },
                { id: "bundle_10gb", title: "10GB → R179" },
                { id: "back_main", title: "Back to Main" }
            ]
        }
        // Add more menus later easily here
    };

    const menu = menus[menuKey] || menus.main;

    const data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
            type: "button",
            header: {
                type: "text",
                text: menu.header
            },
            body: {
                text: menu.body
            },
            footer: {
                text: "built with ❤️ by blacklab tech"
            },
            action: {
                buttons: menu.buttons.map(btn => ({
                    type: "reply",
                    reply: {
                        id: btn.id,
                        title: btn.title
                    }
                }))
            }
        }
    };

    try {
        await axios.post(
            `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            data,
            {
                headers: {
                    Authorization: `Bearer ${WA_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );
        console.log(`Menu "\( {menuKey}" sent to \){to}`);
    } catch (error) {
        console.error("Failed to send menu:", error.response?.data || error.message);
    }
}

// Handle incoming messages & button clicks
app.post("/webhook", async (req, res) => {
    try {
        const entry = req.body.entry?.[0]?.changes?.[0]?.value;
        const message = entry?.messages?.[0];
        const from = message?.from;

        if (!from) return res.sendStatus(200);

        // Button reply clicked
        if (message?.interactive?.button_reply?.id) {
            const buttonId = message.interactive.button_reply.id;

            if (buttonId === "buy_bundle") {
                sessions.set(from, "buy_bundle");
                return await sendMenu(from, "buy_bundle");
            }

            if (buttonId === "back_main") {
                sessions.delete(from);
                return await sendMenu(from, "main");
            }

            if (buttonId.startsWith("bundle_")) {
                const bundleName = buttonId.replace("bundle_", "").replace("_", " ");
                await axios.post(
                    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
                    {
                        messaging_product: "whatsapp",
                        to: from,
                        type: "text",
                        text: {
                            {
                                body: `You selected *${bundleName.toUpperCase()}*!\n\nWe'll send you payment details in a moment.\n\nThank you for choosing BlackLab!`
                            }
                    },
                    { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
                );
                // Return to main menu after 4 seconds
                setTimeout(() => {
                    sessions.delete(from);
                    sendMenu(from, "main");
                }, 4000);
                return res.sendStatus(200);
            }

            // Add more button actions here in future
        }

        // Any text or first message → show main menu
        sessions.delete(from);
        await sendMenu(from, "main");

        res.sendStatus(200);
    } catch (err) {
        console.error("Webhook error:", err.message);
        res.sendStatus(500);
    }
});

// Home route
app.get("/", (req, res) => {
    res.send("BlackLab WhatsApp Bot is LIVE & READY built with ❤️ by blacklab tech");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`BlackLab Bot running on port ${PORT}`);
});
