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
 * - Wir fallen NUR zurueck bei Netzwerk-/5xx-Fehlern, Timeouts, 429 Rate-Limits oder
 *   "not configured". Bei anderen 4xx-Fehlern (die vom User-Input kommen) brechen wir
 *   sofort ab.
 *
 * v2.4 NEU:
 * - Timeouts pro Provider (siehe _http.js)
 * - Exponential Backoff bei 429 Rate-Limits (1s warten, dann einmal retry am selben
 *   Provider, bevor Fallback greift)
 * - In-Memory Circuit Breaker: nach 3 Fehlern in Folge wird ein Provider fuer 60s
 *   geskippt (verhindert, dass jeder einzelne Request alle 3 Provider durchklopft,
 *   wenn einer offensichtlich down ist)
 */

import * as groq from "./groq.js";
import * as anthropic from "./anthropic.js";
import * as together from "./together.js";

const PROVIDERS = {
  groq,
  anthropic,
  together,
};

// ── Circuit Breaker State (Module-Level, pro Worker-Instanz) ────────────────
// Achtung: Cloudflare Workers sind stateless zwischen Requests nur, soweit
// NICHT dieselbe V8-Isolate reused wird. In der Praxis wird oft reused → das
// hier funktioniert als "best effort" Circuit Breaker, nicht als globaler Stand.
// Fuer globale Sichtweite bräuchten wir KV oder Durable Objects — overkill hier.
const FAILURE_THRESHOLD = 3;   // ab 3 Fehlern in Folge
const COOLDOWN_MS = 60_000;    // 60s skippen
const BACKOFF_429_MS = 1_000;  // 1s warten vor Retry bei 429

/** @type {Record<string, { failures: number, skipUntil: number }>} */
const breakerState = {};

function isCircuitOpen(providerName) {
  const state = breakerState[providerName];
  if (!state) return false;
  if (state.failures < FAILURE_THRESHOLD) return false;
  if (Date.now() >= state.skipUntil) {
    // Cooldown vorbei → Zustand zuruecksetzen, Provider bekommt wieder eine Chance
    breakerState[providerName] = { failures: 0, skipUntil: 0 };
    return false;
  }
  return true;
}

function recordFailure(providerName) {
  const prev = breakerState[providerName] || { failures: 0, skipUntil: 0 };
  const failures = prev.failures + 1;
  breakerState[providerName] = {
    failures,
    skipUntil: failures >= FAILURE_THRESHOLD ? Date.now() + COOLDOWN_MS : 0,
  };
}

function recordSuccess(providerName) {
  if (breakerState[providerName]) {
    breakerState[providerName] = { failures: 0, skipUntil: 0 };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse die Provider-Reihenfolge aus der Env-Variable.
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
 * Entscheidet wie mit einem Fehler umzugehen ist:
 *  - "terminal"  → sofort aufgeben, kein weiterer Provider (User-Input-Fehler)
 *  - "retry"     → einmal am selben Provider retryen (429 Rate-Limit)
 *  - "fallback"  → weiter zum naechsten Provider (5xx, Network, Timeout, empty)
 */
function classifyError(err) {
  const msg = err?.message || "";
  if (/API error 429/.test(msg)) return "retry";
  if (/timeout after/.test(msg)) return "fallback";
  if (/API error 4\d\d/.test(msg)) return "terminal";
  return "fallback";
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Haupt-Funktion ───────────────────────────────────────────────────────────

/**
 * Generiere Antwort ueber die Provider-Kette mit Timeouts, 429-Retry und
 * Circuit-Breaker.
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

    // 1. Konfiguration pruefen
    if (!provider.isConfigured(env)) {
      console.log(`[${clientId}] Provider ${providerName} not configured, skip`);
      continue;
    }

    // 2. Circuit Breaker pruefen
    if (isCircuitOpen(providerName)) {
      console.warn(
        `[${clientId}] Provider ${providerName} circuit open (cooldown), skip`
      );
      errors.push({ provider: providerName, error: "circuit-breaker-open" });
      continue;
    }

    // 3. Versuche den Provider — mit bis zu EINEM Retry bei 429
    let attempt = 0;
    while (attempt < 2) {
      try {
        console.log(
          `[${clientId}] Trying provider: ${providerName}${attempt > 0 ? " (retry)" : ""}`
        );
        const result = await provider.generate({ systemPrompt, messages, env });
        recordSuccess(providerName);
        return { reply: result.reply, providerUsed: providerName };
      } catch (err) {
        const kind = classifyError(err);
        console.error(
          `[${clientId}] Provider ${providerName} failed (${kind}):`,
          err.message
        );

        if (kind === "terminal") {
          // Bad Request o.ae. → Abbruch, kein anderer Provider hilft
          throw new Error(
            `Provider ${providerName} terminal error: ${err.message}`
          );
        }

        if (kind === "retry" && attempt === 0) {
          await sleep(BACKOFF_429_MS);
          attempt++;
          continue; // nochmal am selben Provider
        }

        // Fallback: Fehler buchen, zum naechsten Provider
        recordFailure(providerName);
        errors.push({ provider: providerName, error: err.message });
        break;
      }
    }
  }

  // Alle Provider durch, nichts hat funktioniert
  const summary = errors.map((e) => `${e.provider}: ${e.error}`).join(" | ");
  throw new Error(`All providers failed. ${summary || "No provider configured."}`);
}
