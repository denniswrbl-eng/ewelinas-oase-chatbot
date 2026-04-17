/**
 * WRBL Digital – Multi-Tenant Chatbot Backend v2.3
 * Cloudflare Pages Function
 *
 * NEU in v2.3: Client-Configs ausgelagert
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
