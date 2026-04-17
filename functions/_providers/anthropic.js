/**
 * Anthropic Provider — Claude Haiku via Anthropic API
 *
 * Empfohlen als erster Fallback: sehr guenstig (~0.80 USD pro 1M Input-Tokens),
 * hohe Qualitaet, schnell. Deutsch-Faehigkeit besser als LLaMA.
 *
 * Braucht Env-Var: ANTHROPIC_API_KEY
 *
 * Wichtig: Anthropic-Messages-Format ist anders als OpenAI:
 * - system-Prompt ist top-level, nicht in messages
 * - messages darf nur "user" und "assistant" Rollen haben
 * - erste Message muss "user" sein
 */

export const name = "anthropic";

export function isConfigured(env) {
  return !!env.ANTHROPIC_API_KEY;
}

/**
 * @param {Object} params
 * @param {string} params.systemPrompt
 * @param {Array}  params.messages  - role: "user"|"assistant" (system wird rausgefiltert)
 * @param {Object} params.env
 * @returns {Promise<{reply: string}>}
 */
export async function generate({ systemPrompt, messages, env }) {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  // Anthropic erwartet: nur user/assistant, keine system-Rolle im messages-Array
  const cleanMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-20);

  // Erste Message muss "user" sein — wenn nicht, skippen
  while (cleanMessages.length > 0 && cleanMessages[0].role !== "user") {
    cleanMessages.shift();
  }

  if (cleanMessages.length === 0) {
    throw new Error("Anthropic: no valid user messages");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: cleanMessages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const reply = data?.content?.[0]?.text;

  if (!reply) {
    throw new Error("Anthropic returned empty response");
  }

  return { reply };
}
