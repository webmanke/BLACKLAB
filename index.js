import express from "express";
import axios from "axios";
import "dotenv/config";

const app = express();
app.use(express.json());

// ---------------------------
// CONFIG (from env)
// ---------------------------
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// ---------------------------
// SIMPLE IN-MEMORY SESSIONS
// ---------------------------
const sessions = {}; // { "<phone>": { awaiting: null|'first_name'|'last_name', firstName, lastName } }
function getSession(from) {
  if (!sessions[from]) sessions[from] = { awaiting: null, firstName: null, lastName: null };
  return sessions[from];
}

// ---------------------------
// HELPER: send an API request
// messagePayload should include: type and either text OR interactive (exact WA payload shape)
// ---------------------------
async function sendWhatsApp(from, messagePayload) {
  try {
    const body = {
      messaging_product: "whatsapp",
      to: from,
      ...messagePayload
    };

    await axios.post(
      `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
      body,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (err) {
    console.error("WhatsApp send error:", err.response?.data || err.message);
  }
}

// ---------------------------
// Convenience wrappers
// ---------------------------
async function sendText(from, plainText) {
  // add footer to normal text too (as part of body)
  await sendWhatsApp(from, {
    type: "text",
    text: { body: `${plainText}\n\n— BlackLab Systems` }
  });
}

async function sendInteractiveMenu(from) {
  // A menu that only appears when user types "menu" (or we explicitly call this).
  await sendWhatsApp(from, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "BlackLab Menu — choose an action:" },
      footer: { text: "BlackLab Systems" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "REGISTER", title: "Register" } },
          { type: "reply", reply: { id: "SHOW_INFO", title: "Show Saved Info" } },
          { type: "reply", reply: { id: "CLEAR", title: "Clear Data" } }
        ]
      }
    }
  });
}

async function askEnterLastNameButton(from) {
  // send an interactive button that when clicked will set awaiting last name
  await sendWhatsApp(from, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Great — you gave your first name. Next, enter your last name:" },
      footer: { text: "BlackLab Systems" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "ENTER_LAST_NAME", title: "Enter Last Name" } },
          { type: "reply", reply: { id: "EDIT_FIRST_NAME", title: "Edit First Name" } }
        ]
      }
    }
  });
}

async function askEnterFirstNameButton(from) {
  await sendWhatsApp(from, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "To register, please provide your first name:" },
      footer: { text: "BlackLab Systems" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "ENTER_FIRST_NAME", title: "Enter First Name" } },
          { type: "reply", reply: { id: "CANCEL", title: "Cancel" } }
        ]
      }
    }
  });
}

async function askFinishOrEditButtons(from) {
  await sendWhatsApp(from, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Registration summary — choose an action:" },
      footer: { text: "BlackLab Systems" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "FINISH_REG", title: "Finish Registration" } },
          { type: "reply", reply: { id: "EDIT_NAME", title: "Edit Name" } }
        ]
      }
    }
  });
}

// ---------------------------
// MAIN HANDLER: interpret incoming events
// ---------------------------
async function handleIncoming(from, message) {
  const session = getSession(from);

  // ---- interactive replies (button clicks) ----
  if (message.type === "interactive") {
    const interactive = message.interactive;
    // There are different interactive shapes: button_reply / list_reply / etc.
    const btnId = interactive?.button_reply?.id || interactive?.list_reply?.id || null;

    switch (btnId) {
      case "REGISTER":
        // Start registration flow by prompting to enter first name (via a button to start)
        return askEnterFirstNameButton(from);

      case "ENTER_FIRST_NAME":
        // When user clicks this, set session to await first name and prompt text input
        session.awaiting = "first_name";
        return sendText(from, "Please type your *first name* now:");

      case "ENTER_LAST_NAME":
        session.awaiting = "last_name";
        return sendText(from, "Please type your *last name* now:");

      case "EDIT_FIRST_NAME":
        session.awaiting = "first_name";
        return sendText(from, "Okay — please type the correct first name:");

      case "EDIT_NAME":
        session.awaiting = "first_name";
        return sendText(from, "Which part do you want to change? Type your first name to start:");

      case "SHOW_INFO":
        return sendText(
          from,
          `Here is what I have:\n\nFirst name: ${session.firstName || "Not set"}\nLast name: ${session.lastName || "Not set"}`
        );

      case "CLEAR":
        sessions[from] = { awaiting: null, firstName: null, lastName: null };
        return sendText(from, "All stored data cleared.");

      case "FINISH_REG":
        // final confirmation
        return sendText(
          from,
          `Thank you! Registration complete.\nName: ${session.firstName || "-"} ${session.lastName || "-"}`
        );

      case "CANCEL":
        session.awaiting = null;
        return sendText(from, "Registration cancelled. Type 'menu' to see options.");

      default:
        // If unknown button id, respond gracefully
        return sendText(from, "I received a button click but couldn't interpret it.");
    }
  }

  // ---- plain text messages ----
  const text = (message.text?.body || "").trim();

  // Only trigger menu when user types exactly 'menu' (case-insensitive)
  if (text && text.toLowerCase() === "menu") {
    return sendInteractiveMenu(from);
  }

  // If the session expects the first name
  if (session.awaiting === "first_name") {
    // Save first name, then prompt next step using a button to trigger last name entry
    session.firstName = text;
    session.awaiting = null; // we wait for the button ENTER_LAST_NAME to be clicked
    // Send confirmation and show button to proceed to last name
    await sendText(from, `Thanks ${session.firstName}.`);
    return askEnterLastNameButton(from);
  }

  // If the session expects the last name
  if (session.awaiting === "last_name") {
    session.lastName = text;
    session.awaiting = null;
    // After saving last name show a finish/edit action
    await sendText(from, `Thanks — saved last name: ${session.lastName}`);
    return askFinishOrEditButtons(from);
  }

  // If user wrote something else and not in an awaiting state, provide helpful prompt
  // We do not treat every word as a trigger; only 'menu' or explicit button clicks start flows.
  return sendText(
    from,
    "Hi — to start registration type 'menu' and click *Register*, or type 'menu' to see options."
  );
}

// ---------------------------
// WEBHOOK VERIFY
// ---------------------------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ---------------------------
// WEBHOOK RECEIVE
// ---------------------------
app.post("/webhook", (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    // if no message (e.g., status update) just return OK
    if (!message) return res.sendStatus(200);

    const from = message.from;
    handleIncoming(from, message); // don't await to speed response
    return res.sendStatus(200);
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.sendStatus(500);
  }
});

// ---------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BlackLab bot listening on ${PORT}`));
