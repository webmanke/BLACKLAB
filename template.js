export function getTemplateConfig(input) {
  if (input.includes("hi") || input.includes("hello")) {
    return {
      name: "blacklab_welcome",
      components: []
    };
  }

  if (input.includes("info")) {
    return {
      name: "blacklab_info",
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "BlackLab Operational" }
          ]
        }
      ]
    };
  }

  return null;
}
