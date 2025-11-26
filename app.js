require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

// ==== CONFIG – SET THESE IN RENDER ENVIRONMENT VARIABLES ====
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;           // e.g. mysecretblacklab2025
const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;     // Permanent token from Meta
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;     // From WhatsApp > API Setup
const API_VERSION = 'v20.0';
// =============================================================

// Webhook verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK VERIFIED');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  res.sendStatus(200);
});

// Receive messages (POST)
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    if (body.object) {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const value = change.value;
          if (value.messages && value.messages[0]) {
            const message = value.messages[0];
            const from = message.from; // customer phone number

            // Always send the business button menu on any incoming message
            await sendButtonMenu(from);
          }
        }
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.sendStatus(500);
  }
});

// Send interactive button menu – the “best-in-class” business experience
async function sendButtonMenu(to) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'button',
      header: {
        type: 'text',
        text: 'BLACKLAB'
      },
      body: {
        text: 'Welcome to *BlackLab* – Premium WhatsApp Automation\n\nHow can we help your business today?'
      },
      footer: {
        text: '24/7 Instant Support'
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: 'SALES',
              title: 'Sales Inquiry'
            }
          },
          {
            type: 'reply',
            reply: {
              id: 'SUPPORT',
              title: 'Customer Support'
            }
          },
          {
            type: 'reply',
            reply: {
              id: 'INFO',
              title: 'Product Info'
            }
          }
        ]
      }
    }
  };

  await sendWhatsAppMessage(payload);

  // Also send a quick text reply so user knows it’s live
  setTimeout(async () => {
    await sendText(to, 'Choose an option below');
  }, 800);
}

// Handle button replies
app.post('/webhook', async (req, res) => {
  // (We merge both routes – Express will handle it)
  // This part runs when user presses a button
  try {
    const body = req.body;
    if (body.object && body.entry) {
      for (const entry of body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            const value = change.value;
            if (value.messages && value.messages[0]?.interactive) {
              const interactive = value.messages[0].interactive;
              const from = value.messages[0].from;

              if (interactive.type === 'button_reply') {
                const buttonId = interactive.button_reply.id;

                let replyText = '';
                switch (buttonId) {
                  case 'SALES':
                    replyText = 'A sales specialist will contact you within 5 minutes!\n\nPlease reply with your business name and needs.';
                    break;
                  case 'SUPPORT':
                    replyText = 'Support team is here! Please describe your issue and we’ll solve it instantly.';
                    break;
                  case 'INFO':
                    replyText = 'BlackLab is the most advanced WhatsApp business bot in 2025.\n• Interactive buttons\n• 24/7 automation\n• CRM integration ready\n\nWant a demo? Just type "demo"';
                    break;
                  default:
                    replyText = 'Thank you for contacting BlackLab!';
                }
                await sendText(from, replyText);
              }
            }
          }
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// Helper: send any WhatsApp message
async function sendWhatsAppMessage(data) {
  try {
    await axios.post(
      `https://graph.facebook.com/\( {API_VERSION}/ \){PHONE_NUMBER_ID}/messages`,
      data,
      {
        headers: {
          Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('WA Send Error:', error.response?.data || error.message);
  }
}

// Helper: send simple text
async function sendText(to, text) {
  await sendWhatsAppMessage({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text }
  });
}

// Root route so Render health check doesn’t fail
app.get('/', (req, res) => {
  res.send('BlackLab WhatsApp Bot is LIVE');
});

app.listen(PORT, () => {
  console.log(`BlackLab is running on port ${PORT}`);
  console.log(`Webhook URL: https://your-service.onrender.com/webhook`);
});
