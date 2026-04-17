/**
 * WRBL Digital – Multi-Tenant Chatbot Backend v2.2
 * Cloudflare Pages Function
 *
 * NEU in v2.2: LLM-Provider-Adapter (Fallback-Kette)
 * - LLM-Calls laufen jetzt ueber functions/_providers/index.js
 * - Provider-Reihenfolge konfigurierbar per Env-Var LLM_PROVIDER_ORDER
 *   (z.B. "groq,anthropic,together"). Default wenn nicht gesetzt: "groq" (= altes Verhalten).
 * - Faellt der erste Provider aus, probiert der Adapter den naechsten.
 * - Antwort enthaelt jetzt zusaetzlich `providerUsed` fuer Debugging.
 *
 * v2.1: Hybrid-Modus (Rule-Based Fallback + AI)
 * - mode: "hybrid"   → Rules zuerst prüfen, bei keinem Match → LLM
 * - mode: "ai-only"  → Immer LLM (wie v2.0)
 * - mode: "rule-only" → Nur Rules, kein LLM. Bei keinem Match → Standard-Antwort
 *
 * Spart 70-80% LLM-Tokens weil Standardfragen (Öffnungszeiten, Preise, Adresse)
 * sofort rule-basiert beantwortet werden, ohne API-Call.
 *
 * Accepts optional "clientId" in request body.
 * Falls back to "ewelinas-oase" if none provided (backward compatible).
 */

import * as llm from "../_providers/index.js";

// ── Client Configs ──────────────────────────────────────────────
const CLIENTS = {
  "ewelinas-oase": {
    name: "Ewelinas Oase",
    allowedOrigins: [
      "https://ewelinas-oase.de",
      "https://www.ewelinas-oase.de",
      "https://ewelinas-oase-chatbot.pages.dev",
    ],
    // Hybrid-Modus: Standardfragen werden rule-basiert beantwortet
    mode: "hybrid",
    rules: [
      {
        id: "opening_hours",
        type: "keyword",
        keywords: ["öffnungszeiten", "wann offen", "wann geöffnet", "uhrzeit", "zeiten", "aufgemacht", "wann auf"],
        answer: "Unsere Öffnungszeiten:\n📅 Mo – Fr: nach Vereinbarung\n📅 Samstag: nach Vereinbarung\n📅 Sonntag: geschlossen\n\nAm besten erreichst du uns per WhatsApp oder Telefon: 0176 / 31 56 24 54",
      },
      {
        id: "address",
        type: "keyword",
        keywords: ["adresse", "wo seid ihr", "wo ist", "anfahrt", "standort", "wie komme ich"],
        answer: "Du findest uns hier:\n📍 Ostenallee 55, 59063 Hamm\n\nParkmöglichkeiten gibt es direkt vor der Tür. Wir freuen uns auf deinen Besuch!",
      },
      {
        id: "contact",
        type: "keyword",
        keywords: ["telefon", "nummer", "anrufen", "kontakt", "email", "erreichbar"],
        answer: "So erreichst du uns:\n📞 0176 / 31 56 24 54\n📧 info@ewelinas-oase.de\n💬 WhatsApp: Einfach auf den WhatsApp-Button klicken!\n\nWir melden uns schnellstmöglich zurück.",
      },
      {
        id: "prices",
        type: "keyword",
        keywords: ["preis", "kosten", "was kostet", "wie teuer", "preisliste"],
        answer: "Unsere Preise:\n💆 Fußpflege Komplett: 35 €\n⏱️ Dauer: ca. 45 Minuten\n\nInklusive: Fußbad, Peeling, Hornhautentfernung, Massage.\nNagellack auf Wunsch möglich.",
      },
      {
        id: "booking",
        type: "keyword",
        keywords: ["termin", "buchen", "terminvereinbarung", "termin machen"],
        answer: "Termin buchen ist ganz einfach:\n📱 WhatsApp: 0176 / 31 56 24 54\n📞 Telefon: 0176 / 31 56 24 54\n\nOder nutze unser Kontaktformular weiter unten auf der Seite!",
      },
      {
        id: "nail_polish",
        type: "keyword",
        keywords: ["nagellack", "nägel lackieren", "gelnägel", "gel", "shellac", "nailart"],
        answer: "Wir bieten aktuell keinen Nagellack-Service an. Unsere Fußpflege konzentriert sich auf Pflege, Peeling, Hornhautentfernung und Massage.\n\nFür Nagel-Design empfehlen wir ein spezialisiertes Nagelstudio in der Nähe.",
      },
      {
        id: "medical",
        type: "keyword",
        keywords: ["arzt", "doktor", "medizinisch", "krankheit", "pilz", "nagelpilz", "entzündung", "wunde", "diabetes"],
        answer: "Bei medizinischen Fragen wende dich bitte an deinen Hausarzt oder einen Podologen.\n\nWir bieten kosmetische Fußpflege an – keine medizinische Behandlung. Deine Gesundheit liegt uns am Herzen! ❤️",
      },
    ],
    systemPrompt: `Du bist der virtuelle Assistent von Ewelinas Oase, einem Fußpflegesalon in Hamm.

DEIN STIL:
- Antworte immer auf Deutsch, freundlich, warm und natürlich
- Duze die Kunden (du statt Sie)
- Halte dich kurz: maximal 2–3 Sätze pro Antwort
- Sei herzlich, aber professionell – wie eine nette Kollegin am Empfang
- Verwende keine Emojis übermäßig, maximal 1 pro Nachricht wenn passend

WICHTIGE INFOS ÜBER DEN SALON:
- Name: Ewelinas Oase – Fußpflege in Hamm
- Inhaberin: Ewelina
- Adresse: Ostenallee 55, 59063 Hamm
- Telefon/WhatsApp: 0176 / 31 56 24 54
- Öffnungszeiten: Mo–Fr 08:00–20:00 Uhr, Sa nach Vereinbarung
- Fußpflege: 35 € (ca. 45 Min.)
  → Inklusive: Fußbad, Peeling, Hornhautentfernung, Nägel kürzen & feilen, Eincremen
- Es wird KEIN Nagellack angeboten
- Kostenlose Parkplätze direkt vor dem Salon

TERMINBUCHUNG:
- Termine können NICHT über den Chat gebucht werden
- Verweise freundlich auf WhatsApp (0176 / 31 56 24 54) oder Anruf
- Sag sowas wie: "Am besten schreibst du uns kurz per WhatsApp oder rufst an – dann finden wir schnell einen Termin für dich!"

WICHTIGE REGELN:
- Wenn du etwas nicht weißt, sag das ehrlich und empfehle den direkten Kontakt
- Erfinde KEINE Informationen (keine Preise, keine Leistungen die nicht oben stehen)
- Beantworte nur Fragen die mit dem Salon zu tun haben
- Bei medizinischen Fragen (Diabetes, eingewachsene Nägel etc.): empfehle einen Podologen oder Arzt, Ewelinas Oase bietet kosmetische Fußpflege`,
  },

  // ── Weitere Kunden hier einfach ergänzen ──
  // Kopiere den Block oben und passe name, allowedOrigins, mode, rules und systemPrompt an.
  // Bei mode: "rule-only" wird KEIN Groq-API-Call gemacht → komplett kostenlos!
};

// Default client for backward compatibility
const DEFAULT_CLIENT = "ewelinas-oase";

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
  const origins = clientConfig?.allowedOrigins || CLIENTS[DEFAULT_CLIENT].allowedOrigins;
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
    const resolvedId = clientId && CLIENTS[clientId] ? clientId : DEFAULT_CLIENT;
    const client = CLIENTS[resolvedId];

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

      // mode === "hybrid" und kein Match → Weiter mit Groq AI (unten)
      console.log(`[${resolvedId}] No rule match → forwarding to Groq AI`);
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
