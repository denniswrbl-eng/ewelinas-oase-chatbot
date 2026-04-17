/**
 * LLM Provider Selector / Fallback Orchestrator
 *
 * GROSSES BILD:
 * - Aus env.LLM_PROVIDER_ORDER wird eine Reihenfolge gelesen, z.B. "groq,anthropic,together".
 * - Ist die Var nicht gesetzt → Default "groq" (100% backward compatible, vorher-Verhalten).
 * - Wir versuchen Provider eins nach dem anderen.
 * - Erster, der erfolgreich antwortet → gewonnen, wir geben zurueck.
 * - Alle haben gefehlt → wir werfen den LETZTEN Fehler weiter (chat.js behandelt das als 500).
 *
 * WARUM:
 * - Groq ist billig/schnell aber nicht zuverlaessig (kein SLA).
 * - Anthropic Haiku ist teurer pro Token, aber stabile Infrastruktur.
 * - Together ist OpenAI-kompatibel, anderer Cloud, gleiches Modell wie Groq.
 * - So ueberlebt der Bot den Ausfall eines einzelnen Anbieters.
 *
 * KOSTENFALLE:
 * - Jeder fallback-Aufruf kostet Geld. Nicht blind alle der Reihe nach durchprobieren,
 *   wenn es ein "echter" Error ist (z.B. ungueltige Message).
 * - Wir fallen NUR zurueck bei Netzwerk-/5xx-Fehlern oder "not configured". Bei 4xx-Fehlern
 *   (die vom User-Input kommen) brechen wir sofort ab.
 */

import * as groq from "./groq.js";
import * as anthropic from "./anthropic.js";
import * as together from "./together.js";

const PROVIDERS = {
  groq,
  anthropic,
  together,
};

/**
 * Parse die Provider-Reihenfolge aus der Env-Variable.
 * @param {Object} env
 * @returns {string[]} Array mit Provider-Namen in Reihenfolge
 */
function getProviderOrder(env) {
  const raw = env.LLM_PROVIDER_ORDER;
  if (!raw) return ["groq"]; // Default: backward compatible

  const order = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && PROVIDERS[s]);

  return order.length > 0 ? order : ["groq"];
}

/**
 * Entscheidet ob ein Fehler "retriable" ist (-> naechster Provider probieren)
 * oder "terminal" (-> sofort aufgeben, User hat Mist gemacht).
 */
function isRetriableError(err) {
  const msg = err?.message || "";
  // Terminal: 4xx Fehler (Bad Request, Auth-Fehler, etc.) — ausser 429 Rate-Limit
  if (/API error 4\d\d/.test(msg) && !/API error 429/.test(msg)) {
    return false;
  }
  // Alles andere (5xx, Network, "not configured", empty response) → retry
  return true;
}

/**
 * Haupt-Funktion: generiere Antwort ueber die Provider-Kette.
 *
 * @param {Object} params
 * @param {string} params.systemPrompt
 * @param {Array}  params.messages
 * @param {Object} params.env
 * @param {string} params.clientId  - nur fuer Logging
 * @returns {Promise<{reply: string, providerUsed: string}>}
 */
export async function generate({ systemPrompt, messages, env, clientId }) {
  const order = getProviderOrder(env);
  const errors = [];

  for (const providerName of order) {
    const provider = PROVIDERS[providerName];

    // Skip wenn nicht konfiguriert — zaehlt nicht als Fehlversuch
    if (!provider.isConfigured(env)) {
      console.log(`[${clientId}] Provider ${providerName} not configured, skip`);
      continue;
    }

    try {
      console.log(`[${clientId}] Trying provider: ${providerName}`);
      const result = await provider.generate({ systemPrompt, messages, env });
      return { reply: result.reply, providerUsed: providerName };
    } catch (err) {
      console.error(`[${clientId}] Provider ${providerName} failed:`, err.message);
      errors.push({ provider: providerName, error: err.message });

      if (!isRetriableError(err)) {
        // Bad Request o.ae. → sofort abbrechen, kein Sinn andere Provider zu quaelen
        throw new Error(
          `Provider ${providerName} terminal error: ${err.message}`
        );
      }
      // sonst: naechster Provider
    }
  }

  // Alle Provider durch, nichts hat funktioniert
  const summary = errors.map((e) => `${e.provider}: ${e.error}`).join(" | ");
  throw new Error(`All providers failed. ${summary || "No provider configured."}`);
}
