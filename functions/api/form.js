/**
 * WRBL Digital – Formular-Backend
 * Cloudflare Pages Function: /api/form
 *
 * Nimmt Kontaktformular-Daten entgegen und:
 * 1. Schreibt sie in Airtable CRM
 * 2. Gibt Erfolg zurück (Frontend öffnet dann WhatsApp)
 *
 * Benötigte Environment Variables in Cloudflare:
 * - AIRTABLE_TOKEN: Personal Access Token (pat...)
 */

// ── Client Configs (welche Websites dürfen senden) ─────────────
const CLIENTS = {
  "ewelinas-oase": {
    name: "Ewelinas Oase",
    allowedOrigins: [
      "https://ewelinas-oase.de",
      "https://www.ewelinas-oase.de",
      "https://ewelinas-oase-chatbot.pages.dev",
      "http://localhost:8788",
    ],
    airtable: {
      baseId: "app9kLLaDhUOHlNFU",
      tableId: "tblk0RXcSfYELhHMN",
    },
  },
};

const DEFAULT_CLIENT = "ewelinas-oase";

// ── CORS Helper ────────────────────────────────────────────────
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

// ── OPTIONS (preflight) ────────────────────────────────────────
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request, null),
  });
}

// ── POST (form submission) ─────────────────────────────────────
export async function onRequestPost(context) {
  const client = CLIENTS[DEFAULT_CLIENT];
  const cors = getCorsHeaders(context.request, client);

  try {
    const body = await context.request.json();
    const { name, email, phone, service, preferredDate, clientId } = body;

    // ── Validierung ──
    if (!name || name.trim().length < 2) {
      return jsonResponse({ error: "Name ist erforderlich" }, 400, cors);
    }
    if (!phone || phone.trim().length < 6) {
      return jsonResponse({ error: "Telefonnummer ist erforderlich" }, 400, cors);
    }

    // Honeypot check (falls Frontend ein hidden field mitschickt)
    if (body.website) {
      // Bot detected – tue so als ob es geklappt hat
      return jsonResponse({ success: true }, 200, cors);
    }

    // ── Client auflösen ──
    const resolvedId = clientId && CLIENTS[clientId] ? clientId : DEFAULT_CLIENT;
    const resolvedClient = CLIENTS[resolvedId];

    // ── Airtable Token prüfen ──
    const token = context.env.AIRTABLE_TOKEN;
    if (!token) {
      console.error("AIRTABLE_TOKEN nicht gesetzt!");
      return jsonResponse({ error: "Server-Konfigurationsfehler" }, 500, cors);
    }

    // ── In Airtable schreiben ──
    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${resolvedClient.airtable.baseId}/${resolvedClient.airtable.tableId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: [
            {
              fields: {
                Name: name.trim(),
                Email: email ? email.trim() : "",
                Telefon: phone.trim(),
                Wunschtermin: (service ? service + " — " : "") + (preferredDate || ""),
              },
            },
          ],
        }),
      }
    );

    if (!airtableRes.ok) {
      const err = await airtableRes.text();
      console.error("Airtable API Fehler:", err);
      return jsonResponse(
        { error: "Anfrage konnte nicht gespeichert werden", details: err },
        500,
        cors
      );
    }

    const airtableData = await airtableRes.json();

    return jsonResponse(
      {
        success: true,
        message: "Anfrage erfolgreich gespeichert",
        recordId: airtableData.records?.[0]?.id,
      },
      200,
      cors
    );
  } catch (error) {
    console.error("Form API Error:", error.message);
    return jsonResponse({ error: "Serverfehler" }, 500, cors);
  }
}

// ── Helper ─────────────────────────────────────────────────────
function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
