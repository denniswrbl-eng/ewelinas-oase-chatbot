/**
 * Client-Config: Ewelinas Oase (Fusspflege Hamm)
 *
 * Pro Kunde eine eigene Config-Datei. Einfach zu pflegen, leicht zu diffen,
 * klar voneinander getrennt. Registrierung erfolgt in ./index.js.
 *
 * Feld-Referenz:
 *  - name:           Anzeigename
 *  - allowedOrigins: CORS-Whitelist (Domains die das Widget einbinden duerfen)
 *  - mode:           "hybrid" | "ai-only" | "rule-only"
 *  - rules:          Array von {id, type, keywords, answer}
 *  - systemPrompt:   Kontext fuer das LLM (Stil, Fakten, Regeln)
 */

const config = {
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
};

export default config;
