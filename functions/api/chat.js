/**
 * WRBL Digital – Multi-Tenant Chatbot Backend v2
 * Cloudflare Pages Function
 *
 * Accepts optional "clientId" in request body.
 * Falls back to "ewelinas-oase" if none provided (backward compatible).
 */

// ── Client Configs ──────────────────────────────────────────────
const CLIENTS = {
  "ewelinas-oase": {
    name: "Ewelinas Oase",
    allowedOrigins: [
      "https://ewelinas-oase.de",
      "https://www.ewelinas-oase.de",
      "https://ewelinas-oase-chatbot.pages.dev",
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
  // "demo-friseur": {
  //   name: "Salon Beispiel",
  //   allowedOrigins: ["https://example.com"],
  //   systemPrompt: `...`,
  // },
};

// Default client for backward compatibility
const DEFAULT_CLIENT = "ewelinas-oase";

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

    // Resolve client config
    const resolvedId = clientId && CLIENTS[clientId] ? clientId : DEFAULT_CLIENT;
    const client = CLIENTS[resolvedId];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${context.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        temperature: 0.7,
        messages: [
          { role: "system", content: client.systemPrompt },
          ...messages.slice(-20), // Max 20 messages context to save tokens
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Groq API error [${resolvedId}]:`, err);
      return new Response(JSON.stringify({ error: "Fehler bei der API-Anfrage" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(context.request, client) },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify({
      reply: data.choices[0].message.content,
      clientId: resolvedId,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(context.request, client) },
    });
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: "Fehler bei der API-Anfrage" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(context.request, null) },
    });
  }
}
