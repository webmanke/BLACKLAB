const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN; // Set this to a secret string, e.g., 'blacklab-secret'
const waToken = process.env.WA_ACCESS_TOKEN; // Your permanent WhatsApp access token
const phoneNumberId = process.env.PHONE_NUMBER_ID; // Your WhatsApp Phone Number ID
const apiVersion = 'v20.0'; // Update if Meta changes it (check docs)

// Webhook verification (GET request)
app.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const token = req.query['hub.verify_token'];

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Handle incoming webhooks (POST request)
app.post('/', async (req, res) => {
  const body = req.body;
  console.log('Incoming webhook:', JSON.stringify(body, null, 2));

  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry[0];
    const change = entry.changes[0];
    const message = change.value.messages ? change.value.messages[0] : null;

    if (message) {
      const from = message.from; // Sender's phone number
      const msgType = message.type;

      if (msgType === 'text') {
        // Respond with business menu using interactive buttons
        await sendInteractiveButtons(from, 'Welcome to BlackLab! How can we assist your business today?');
      } else if (msgType === 'interactive' && message.interactive.type === 'button_reply') {
        // Handle button press (e.g., echo choice; extend for business logic like routing to support)
        const buttonId = message.interactive.button_reply.id;
        let responseText = `You selected: ${buttonId}. `;
        if (buttonId === 'sales') responseText += 'Our sales team will contact you shortly.';
        else if (buttonId === 'support') responseText += 'Please describe your issue.';
        else if (buttonId === 'info') responseText += 'BlackLab offers premium business bots.';
        await sendTextMessage(from, responseText);
      }
    }
  }

  res.status(200).end();
});

// Function to send text message
async function sendTextMessage(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/\( {apiVersion}/ \){phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      },
      { headers: { Authorization: `Bearer ${waToken}` } }
    );
    console.log('Text message sent');
  } catch (error) {
    console.error('Error sending text:', error.response.data);
  }
}

// Function to send interactive buttons (business menu)
async function sendInteractiveButtons(to, bodyText) {
  try {
    await axios.post(
      `https://graph.facebook.com/\( {apiVersion}/ \){phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'sales', title: 'Sales Inquiry' } },
              { type: 'reply', reply: { id: 'support', title: 'Customer Support' } },
              { type: 'reply', reply: { id: 'info', title: 'Product Info' } },
            ],
          },
        },
      },
      { headers: { Authorization: `Bearer ${waToken}` } }
    );
    console.log('Interactive buttons sent');
  } catch (error) {
    console.error('Error sending buttons:', error.response.data);
  }
}

app.listen(port, () => {
  console.log(`BlackLab bot listening on port ${port}`);
});
