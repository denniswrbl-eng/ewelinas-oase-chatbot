# CLAUDE.md — AI-Chatbot (Multi-Tenant)

## Was dieser Ordner ist

**Production-Code** des Multi-Tenant Chatbots von WRBL Digital. Bedient aktuell Ewelinas Oase (Pilot) live unter `ewelinas-oase-chatbot.pages.dev`.

**Kritisch:** Das ist der Bot den die Mutter des Gruenders im echten Betrieb einsetzt. Breaking Changes hier betreffen echte Kundenanfragen.

## Architektur (grosses Bild)

- **Platform:** Cloudflare Pages + Pages Functions (Workers-Runtime)
- **Repo:** github.com/denniswrbl-eng/ewelinas-oase-chatbot
- **Deploy:** Auto-Deploy aus `main` via Cloudflare Pages Integration
- **Modus:** Hybrid — erst regelbasiert, dann LLM-Fallback
- **LLM aktuell:** Groq (LLaMA 3.3 70B) — Single Point of Failure
- **Client-Config:** pro Mandant in `clients/<client-id>/config.json`
- **Aktueller Client:** `fusspflege-ewelina` (Config: `clients/demo-fusspflege/config.json`)

## Bekannte Schwachstellen

1. **Groq Single-Point-of-Failure** — kein Fallback-Provider. Fix: LLM-Adapter-Pattern (Phase 1 der Tech-Roadmap).
2. **Keine Request-Logs** — kein D1, keine Sichtbarkeit was der Bot wirklich beantwortet. Fix: D1-Logging (Phase 1).
3. **Webhook zu n8n laeuft nicht** — n8n lokal auf Dennis-PC. Fix: Hetzner-VPS + Coolify (Phase 2).

Siehe: `Obsidian/Dennis Buisness/10-Business/10-WRBL/Tech-Roadmap-2026-2027.md` fuer Phasenplan.

## Regeln fuer Code-Arbeit

- **Kein `git push` ohne explizites OK von Dennis** — Cloudflare deployed automatisch aus `main`. Push = Live-Deployment.
- **Nicht an `clients/demo-fusspflege/config.json` anfassen** — das ist Kundenkonfig, Aenderungen nur auf Ansage.
- **Keine Secrets committen** — `.dev.vars`, `.wrangler/`, `.env`, Keys aus Bitwarden. Vor Commits `git status` pruefen.
- **Backward-Compatible aendern** — Default-Verhalten muss unveraendert sein, wenn neue Env-Vars nicht gesetzt sind. Beispiel: Wenn `LLM_PROVIDER_ORDER` nicht gesetzt → Groq-Only (wie bisher).
- **Vor Refactor: Testcase dokumentieren** — was muss nach dem Refactor noch genauso funktionieren? (z.B. "Nagellack-Frage wird rejected", "Hausbesuch-Hinweis kommt mit +15 EUR").
- **Branching wenn groesser Refactor** — erst `git checkout -b refactor/<name>`, nicht direkt auf `main`.

## Arbeitsweise (Dennis' Prinzip — gilt IMMER, nicht nachfragen)

Dennis will das grosse Bild sehen, nicht jede Zeile Code verstehen muessen. Seine Zeit ist begrenzt (Burnout-Recovery, max ~4h fokussierte Arbeit/Tag).

- **Claude uebernimmt proaktiv alles, was uebernehmbar ist** — Code, Vault-Arbeit, Recherche, Dokumentation. Ohne Rueckfrage ob er "das jetzt machen darf".
- **Vor Code-Eingriffen kurz um Erlaubnis fragen** — aber nur einmal, kompakt, mit dem grossen Bild (was, warum, Risiko). Kein Roman, kein Multiple-Choice-Menue mit 3 Varianten.
- **Nebenbei erklaeren, was wichtig ist** — das grosse Ganze. WAS macht der Code, WARUM diese Struktur, WO sind die Risiken. KEINE Zeilen-fuer-Zeilen Tutorials. Keine Grundlagen-Lektionen es sei denn Dennis fragt aktiv.
- **Dennis' Zeit nicht verschwenden** — wenn eine Entscheidung technisch klar ist, entscheiden und umsetzen. Nicht jede Mikro-Option durchdiskutieren.
- **Nach getaner Arbeit:** kurze Zusammenfassung was geaendert wurde + was Dennis' naechster Schritt ist. Fertig.

## Ton

- Deutsch, direkt, ehrlich, kein Sugarcoating
- PowerShell-Befehle immer einzeln in separaten Code-Bloecken (direkt kopierbar)
- Ein Schritt nach dem anderen
- Behauptungen immer gegen echte Dateien verifizieren, bevor darauf aufgebaut wird

## Kontext: Vault-Querverweis

Dennis fuehrt alle Projekt-Infos in seinem Obsidian-Vault. Fuer Kontext zu diesem Projekt:
- `Obsidian/Dennis Buisness/10-Business/20-Projekte/Chatbot-v2/Chatbot-v2.md` — Projekt-Sicht
- `Obsidian/Dennis Buisness/10-Business/30-Kunden/Ewelina-Oase/Ewelinas-Oase-Betriebshandbuch.md` — Betriebssicht (Domains, Integrationen, Recovery-Plan)
- `Obsidian/Dennis Buisness/10-Business/10-WRBL/Tech-Roadmap-2026-2027.md` — Phasenplan fuer LLM-Adapter, D1-Logging, VPS-Migration
