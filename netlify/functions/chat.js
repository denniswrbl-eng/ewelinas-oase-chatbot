const Groq = require("groq-sdk");

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT =
  "Du bist der freundliche KI-Assistent von Ewelinas Oase, einem Fußpflegesalon in Hamm. Beantworte Fragen kurz und freundlich auf Deutsch. Hier sind die wichtigsten Infos: Adresse: Ostenallee 55, 59063 Hamm. Telefon: 0176 / 31 56 24 54. Öffnungszeiten: Mo–Fr 08:00–20:00 Uhr, Sa nach Vereinbarung. Leistungen: Fußpflege für 35€ (ca. 45 Min., inkl. Fußbad, Peeling, Hornhautentfernung). Bei Terminanfragen bitte auf WhatsApp oder Telefon verweisen.";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { messages } = JSON.parse(event.body);

    if (!messages || !Array.isArray(messages)) {
      return { statusCode: 400, body: JSON.stringify({ error: "messages array is required" }) };
    }

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: response.choices[0].message.content }),
    };
  } catch (error) {
    console.error("API error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Fehler bei der API-Anfrage" }),
    };
  }
};
