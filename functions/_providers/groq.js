/**
 * Groq Provider — LLaMA 3.3 70B via Groq API
 *
 * Bleibt der Default-Provider (backward compatible).
 * Braucht Env-Var: GROQ_API_KEY
 *
 * v2.4: fetch laeuft jetzt ueber fetchWithTimeout (AbortController, Default 8s).
 */

import { fetchWithTimeout } from "./_http.js";

export const name = "groq";

export function isConfigured(env) {
  return !!env.GROQ_API_KEY;
}

/**
 * @param {Object} params
 * @param {string} params.systemPrompt - System-Prompt aus Client-Config
 * @param {Array}  params.messages     - Chat-History (role: "user"|"assistant", content: string)
 * @param {Object} params.env          - Cloudflare Env mit API-Keys
 * @returns {Promise<{reply: string}>}
 * @throws {Error} bei API-Fehler oder fehlendem Key
 */
export async function generate({ systemPrompt, messages, env }) {
  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const response = await fetchWithTimeout(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
        max_tokens: 1024,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-20), // Max 20 messages context to save tokens
        ],
      }),
    },
    env
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error("Groq returned empty response");
  }

  return { reply };
}
