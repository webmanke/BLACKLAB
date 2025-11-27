// templates.js
const menuTemplate = {
  type: "interactive",
  interactive: {
    type: "button",
    body: {
      text: "Welcome to BlackLab! Choose an option:"
    },
    footer: {
      text: "© BlackLab"
    },
    action: {
      buttons: [
        { type: "reply", reply: { id: "order", title: "Order" } },
        { type: "reply", reply: { id: "know_more", title: "Know More About Us" } },
        { type: "reply", reply: { id: "call_tony", title: "Call Tony" } }
      ]
    }
  }
};

module.exports = { menuTemplate };
