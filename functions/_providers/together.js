/**
 * Together.ai Provider — LLaMA 3.3 70B Turbo via Together API
 *
 * Zweiter Fallback: praktisch identisches Modell wie Groq (gleiches LLaMA 3.3),
 * andere Infrastruktur. Wenn Groq UND Anthropic ausfallen → wenigstens dieselbe
 * Antwortqualitaet wie Groq, nur etwas langsamer.
 *
 * Braucht Env-Var: TOGETHER_API_KEY
 * API-Format: OpenAI-kompatibel (wie Groq).
 *
 * v2.4: fetch laeuft jetzt ueber fetchWithTimeout (AbortController, Default 8s).
 */

import { fetchWithTimeout } from "./_http.js";

export const name = "together";

export function isConfigured(env) {
  return !!env.TOGETHER_API_KEY;
}

/**
 * @param {Object} params
 * @param {string} params.systemPrompt
 * @param {Array}  params.messages
 * @param {Object} params.env
 * @returns {Promise<{reply: string}>}
 */
export async function generate({ systemPrompt, messages, env }) {
  if (!env.TOGETHER_API_KEY) {
    throw new Error("TOGETHER_API_KEY not configured");
  }

  const response = await fetchWithTimeout(
    "https://api.together.xyz/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.TOGETHER_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.TOGETHER_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        max_tokens: 1024,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-20),
        ],
      }),
    },
    env
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Together API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error("Together returned empty response");
  }

  return { reply };
}
