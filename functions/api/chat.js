/**
 * WRBL Digital – Multi-Tenant Chatbot Backend v2.4
 * Cloudflare Pages Function
 *
 * NEU in v2.4: Budget-Schutz
 * - Hartes Origin/Referer-Enforcement vor jedem LLM-Call (403 bei fremdem Origin)
 * - Fixed-Window Rate-Limit pro IP+Client via Cloudflare KV (Default: 20 req / 3600s)
 * - Ohne KV-Binding fail-open + Warn-Log → backward compatible
 * - Env-Vars (optional): RATE_LIMIT_MAX, RATE_LIMIT_WINDOW
 * - Binding (erforderlich für RL): RATE_LIMIT_KV (KV-Namespace)
 *
 * v2.3: Client-Configs ausgelagert
 * - Kunden-Konfigurationen liegen jetzt in functions/_clients/<client-id>.js
 * - Aggregator unter functions/_clients/index.js
 * - Neue Kunden onboarden: 1 neue Datei + 1 Eintrag in index.js (kein chat.js-Edit noetig)
 *
 * v2.2: LLM-Provider-Adapter (Fallback-Kette)
 * - LLM-Calls laufen ueber functions/_providers/index.js
 * - Provider-Reihenfolge konfigurierbar per Env-Var LLM_PROVIDER_ORDER
 *
 * v2.1: Hybrid-Modus (Rule-Based Fallback + AI)
 * - mode: "hybrid"   → Rules zuerst prüfen, bei keinem Match → LLM
 * - mode: "ai-only"  → Immer LLM (wie v2.0)
 * - mode: "rule-only" → Nur Rules, kein LLM. Bei keinem Match → Standard-Antwort
 *
 * Accepts optional "clientId" in request body.
 * Falls back to Default-Client if none provided (backward compatible).
 */

import * as llm from "../_providers/index.js";
import { resolveClient, CLIENTS, DEFAULT_CLIENT_ID } from "../_clients/index.js";

// ── Rule Matching Engine ───────────────────────────────────────
/**
 * Prüft die letzte User-Nachricht gegen alle Rules des Clients.
 *
 * Warum so und nicht anders:
 * - toLowerCase() für case-insensitive Matching (User schreibt mal groß, mal klein)
 * - .some() + .includes() statt Regex: Performanter, einfacher zu debuggen
 * - Nur die LETZTE Nachricht wird geprüft (nicht die History) → verhindert false positives
 * - Reihenfolge der Rules im Array = Priorität (erste Rule die matcht gewinnt)
 *
 * @param {string} userMessage - Die letzte Nachricht des Users
 * @param {Array} rules - Array von Rule-Objekten aus der Client-Config
 * @returns {{ matched: boolean, ruleId: string|null, answer: string|null }}
 */
function matchRule(userMessage, rules) {
  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    return { matched: false, ruleId: null, answer: null };
  }

  // Nachricht normalisieren: Kleinbuchstaben, Sonderzeichen behalten (für Umlaute)
  const normalizedMsg = userMessage.toLowerCase().trim();

  for (const rule of rules) {
    if (rule.type === "keyword" && Array.isArray(rule.keywords)) {
      // Prüfe ob MINDESTENS ein Keyword im Text vorkommt
      const keywordMatch = rule.keywords.some((keyword) =>
        normalizedMsg.includes(keyword.toLowerCase())
      );

      if (keywordMatch) {
        return {
          matched: true,
          ruleId: rule.id || "unknown",
          answer: rule.answer,
        };
      }
    }
    // Hier könnten später weitere rule.type Varianten ergänzt werden:
    // - "regex": Regex-basiertes Matching für komplexere Patterns
    // - "intent": ML-basiertes Intent-Matching (z.B. mit Embeddings)
    // - "exact": Exakte Übereinstimmung
  }

  return { matched: false, ruleId: null, answer: null };
}

// ── CORS Helper ─────────────────────────────────────────────────
function getCorsHeaders(request, clientConfig) {
  const origin = request.headers.get("Origin") || "";
  const fallbackOrigins = CLIENTS[DEFAULT_CLIENT_ID].allowedOrigins;
  const origins = clientConfig?.allowedOrigins || fallbackOrigins;
  const allowed = origins.includes(origin) ? origin : origins[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ── Origin-Enforcement ──────────────────────────────────────────
/**
 * Hart prüfen, ob der Request von einem erlaubten Origin kommt.
 * CORS-Header allein schützen nur Browser-XHR — curl/Python/Postman
 * wird vom Browser-CORS nicht ausgebremst. Hier: Origin ODER Referer
 * muss auf der Client-Whitelist stehen. Fehlen beide → abweisen.
 *
 * @param {Request} request
 * @param {Object}  clientConfig
 * @returns {{ allowed: boolean, reason: string }}
 */
function isOriginAllowed(request, clientConfig) {
  const fallbackOrigins = CLIENTS[DEFAULT_CLIENT_ID].allowedOrigins;
  const origins = clientConfig?.allowedOrigins || fallbackOrigins;
  const origin = request.headers.get("Origin") || "";
  const referer = request.headers.get("Referer") || "";

  if (origin && origins.includes(origin)) {
    return { allowed: true, reason: "origin-match" };
  }
  // Referer enthält volle URL — prüfen, ob sie mit einem erlaubten Origin anfängt
  if (referer && origins.some((o) => referer.startsWith(o + "/") || referer === o)) {
    return { allowed: true, reason: "referer-match" };
  }
  return { allowed: false, reason: origin || referer ? "not-whitelisted" : "no-origin-header" };
}

// ── Rate-Limiting (Cloudflare KV) ───────────────────────────────
/**
 * Fixed-Window-Counter pro IP: max RATE_LIMIT_MAX Requests in
 * RATE_LIMIT_WINDOW Sekunden. Nutzt KV-Namespace `RATE_LIMIT_KV`.
 *
 * Ohne Binding (lokal / noch nicht konfiguriert) → durchlassen +
 * Warn-Log. Backward-kompatibel.
 *
 * Defaults: 20 Requests / 3600s (1 Stunde) pro IP+Client.
 *
 * @param {Object} env
 * @param {string} clientId
 * @param {string} ip
 * @returns {Promise<{ ok: boolean, remaining: number, retryAfter: number }>}
 */
async function checkRateLimit(env, clientId, ip) {
  if (!env.RATE_LIMIT_KV) {
    console.warn("[rate-limit] KV binding RATE_LIMIT_KV missing — skipping");
    return { ok: true, remaining: -1, retryAfter: 0 };
  }
  const max = Number(env.RATE_LIMIT_MAX) || 20;
  const windowSec = Number(env.RATE_LIMIT_WINDOW) || 3600;
  const key = `rl:${clientId}:${ip}`;

  try {
    const raw = await env.RATE_LIMIT_KV.get(key);
    const count = raw ? parseInt(raw, 10) : 0;

    if (count >= max) {
      return { ok: false, remaining: 0, retryAfter: windowSec };
    }

    // Counter hochzählen, TTL nur beim ersten Write setzen (Fixed-Window)
    await env.RATE_LIMIT_KV.put(key, String(count + 1), {
      expirationTtl: windowSec,
    });
    return { ok: true, remaining: max - count - 1, retryAfter: 0 };
  } catch (e) {
    console.error("[rate-limit] KV error, fail-open:", e.message);
    return { ok: true, remaining: -1, retryAfter: 0 };
  }
}

// ── OPTIONS (preflight) ─────────────────────────────────────────
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request, null),
  });
}

// ── POST (chat) ─────────────────────────────────────────────────
export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { messages, clientId } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(context.request, null) },
      });
    }

    // Resolve client config (Fallback auf Default wenn clientId unbekannt)
    const { id: resolvedId, config: client } = resolveClient(clientId);

    // ── Gate 1: Origin-Enforcement ────────────────────────────
    // Blockiert non-Browser-Clients (curl/Python/Postman) VOR jedem
    // teuren LLM-Call. CORS-Header allein reicht nicht.
    const origCheck = isOriginAllowed(context.request, client);
    if (!origCheck.allowed) {
      console.warn(`[${resolvedId}] origin blocked: ${origCheck.reason}`);
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(context.request, client) },
      });
    }

    // ── Gate 2: Rate-Limit pro IP + Client ────────────────────
    // Fail-open wenn KV-Binding fehlt (backward compatible).
    const ip =
      context.request.headers.get("CF-Connecting-IP") ||
      context.request.headers.get("X-Forwarded-For") ||
      "unknown";
    const rl = await checkRateLimit(context.env, resolvedId, ip);
    if (!rl.ok) {
      console.warn(`[${resolvedId}] rate-limit hit for ${ip}`);
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfter),
          ...getCorsHeaders(context.request, client),
        },
      });
    }

    // ── HYBRID MODE: Erst Rules prüfen, dann ggf. AI ──────────
    // Bestimme den Modus: Fehlend oder undefiniert = "ai-only" (backward compatible)
    const mode = client.mode || "ai-only";

    // Letzte User-Nachricht extrahieren (die aktuellste Frage)
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

    if (lastUserMessage && (mode === "hybrid" || mode === "rule-only")) {
      const ruleResult = matchRule(lastUserMessage.content, client.rules);

      if (ruleResult.matched) {
        // Rule hat gematcht → Sofort antworten OHNE Groq API-Call
        // Das spart Tokens und ist schneller (< 5ms statt 500-2000ms)
        console.log(`[${resolvedId}] Rule matched: ${ruleResult.ruleId}`);

        return new Response(JSON.stringify({
          reply: ruleResult.answer,
          clientId: resolvedId,
          source: "rule",           // Für Debugging: zeigt dass Rule geantwortet hat
          ruleId: ruleResult.ruleId, // Welche Rule gematcht hat
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...getCorsHeaders(context.request, client) },
        });
      }

      // Kein Rule-Match bei "rule-only" → Freundliche Standard-Antwort
      if (mode === "rule-only") {
        console.log(`[${resolvedId}] No rule match (rule-only mode)`);

        return new Response(JSON.stringify({
          reply: "Das kann ich dir leider nicht direkt beantworten. Am besten rufst du uns an oder schreibst uns per WhatsApp – wir helfen dir gerne persönlich weiter! 😊",
          clientId: resolvedId,
          source: "rule-fallback",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...getCorsHeaders(context.request, client) },
        });
      }

      // mode === "hybrid" und kein Match → Weiter mit LLM-Provider-Adapter (unten)
      console.log(`[${resolvedId}] No rule match → forwarding to LLM provider chain`);
    }

    // ── AI MODE: Via LLM-Provider-Adapter (Fallback-Kette) ──────
    // Reihenfolge aus env.LLM_PROVIDER_ORDER, Default "groq" (backward compatible).
    try {
      const { reply, providerUsed } = await llm.generate({
        systemPrompt: client.systemPrompt,
        messages,
        env: context.env,
        clientId: resolvedId,
      });

      return new Response(JSON.stringify({
        reply,
        clientId: resolvedId,
        source: "ai",
        providerUsed, // Fuer Debugging: zeigt welcher Provider geantwortet hat
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(context.request, client) },
      });
    } catch (llmError) {
      console.error(`LLM provider chain failed [${resolvedId}]:`, llmError.message);
      return new Response(JSON.stringify({ error: "Fehler bei der API-Anfrage" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(context.request, client) },
      });
    }
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: "Fehler bei der API-Anfrage" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(context.request, null) },
    });
  }
}
