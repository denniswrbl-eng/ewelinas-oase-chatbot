/**
 * GET /api/health — Uptime-Kuma-Target (Tech-Roadmap 4.3).
 * Server-zu-Server-Monitoring, kein CORS, kein PII im Output.
 */

async function checkGroq(env) {
  if (!env.GROQ_API_KEY) return false;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkD1(env) {
  if (!env.DB) return false;
  try {
    const row = await env.DB.prepare("SELECT 1 AS ok").first();
    return row?.ok === 1;
  } catch {
    return false;
  }
}

export async function onRequestGet({ env }) {
  const [groq, d1] = await Promise.all([checkGroq(env), checkD1(env)]);
  // Groq down = Chatbot kann nicht antworten → 503.
  // D1 down = nur Logging weg, Chat läuft → degraded/200.
  const status = !groq ? "error" : !d1 ? "degraded" : "ok";
  return new Response(
    JSON.stringify({
      status,
      providers: { groq, d1 },
      ts: new Date().toISOString(),
    }),
    {
      status: status === "error" ? 503 : 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
