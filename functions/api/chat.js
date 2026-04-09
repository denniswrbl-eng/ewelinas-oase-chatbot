const SYSTEM_PROMPT = `Du bist der virtuelle Assistent von Ewelinas Oase, einem Fußpflegesalon in Hamm. Antworte immer auf Deutsch, freundlich, warm und natürlich — als würdest du mit einer Kundin persönlich sprechen. Halte dich kurz (2–3 Sätze), sei hilfsbereit und herzlich. Verwende gerne du statt Sie.

Wichtige Infos über den Salon:
- Adresse: Ostenallee 55, 59063 Hamm
- Telefon: 0176 / 31 56 24 54
- Öffnungszeiten: Mo–Fr 08:00–20:00 Uhr, Sa nach Vereinbarung
- Fußpflege: 35 € (ca. 45 Min., inkl. Fußbad, Peeling, Hornhautentfernung, Nägel kürzen & feilen)
- Nagellack: +7 €
- Inhaberin: Ewelina

Bei Terminwünschen verweise freundlich auf WhatsApp (0176 / 31 56 24 54) oder Anruf — Termine können nicht über den Chat gebucht werden. Wenn du etwas nicht weißt, sag ehrlich dass du es nicht weißt und empfehle den direkten Kontakt.`;

const ALLOWED_ORIGINS = [
  "https://ewelinas-oase.de",
  "https://www.ewelinas-oase.de",
  "https://ewelinas-oase-chatbot.pages.dev",
];

function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestPost(context) {
  try {
    const { messages } = await context.request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(context.request) },
      });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${context.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Groq API error:", err);
      return new Response(JSON.stringify({ error: "Fehler bei der API-Anfrage" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(context.request) },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify({ reply: data.choices[0].message.content }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(context.request) },
    });
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: "Fehler bei der API-Anfrage" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(context.request) },
    });
  }
}
