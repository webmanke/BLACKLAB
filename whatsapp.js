import axios from "axios";

const API_VERSION = "v18.0";
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;

export async function sendTemplate(to, templateName, components = []) {
  return axios({
    method: "POST",
    url: `https://graph.facebook.com/${API_VERSION}/${PHONE_ID}/messages`,
    headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json"
    },
    data: {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en_US" },
        components
      }
    }
  });
}
