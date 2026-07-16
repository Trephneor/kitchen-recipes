// Optional Claude integration: turns a spoken/typed meal description into
// structured food items for the nutrition graph. Runs directly from the
// browser (this is a no-build static app), so the CORS opt-in header is
// required. The API key is stored only in this device's IndexedDB.

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-8";

const FOODS_SCHEMA = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      foods: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Generic English ingredient name, singular, e.g. 'chicken breast', 'rice', 'broccoli'" },
            grams: { type: "integer", description: "Estimated weight eaten in grams" },
          },
          required: ["name", "grams"],
          additionalProperties: false,
        },
      },
      summary: { type: "string", description: "One-line summary of the meal in English" },
    },
    required: ["foods", "summary"],
    additionalProperties: false,
  },
};

/**
 * Parse a free-text meal description into structured foods.
 * Returns {foods: [{name, grams}], summary} or throws with a readable message.
 */
export async function parseFoodsWithClaude(description, apiKey) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system:
        "You are a nutrition assistant for a home cooking app. The user describes " +
        "a meal they ate (possibly in Danish or English, dictated by voice). " +
        "Break it into individual food items with realistic estimated weights in " +
        "grams for one serving. Use generic English ingredient names.",
      messages: [{ role: "user", content: description }],
      output_config: { format: FOODS_SCHEMA },
    }),
  });

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const err = await res.json();
      detail = err.error?.message || detail;
    } catch { /* ignore body parse errors */ }
    if (res.status === 401) throw new Error("Claude API key was rejected — check it in Settings.");
    throw new Error(`Claude request failed: ${detail}`);
  }

  const data = await res.json();
  if (data.stop_reason === "refusal") {
    throw new Error("Claude declined to process this description.");
  }
  const text = (data.content || []).find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Claude returned an empty response.");
  return JSON.parse(text);
}
