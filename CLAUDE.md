# CLAUDE.md — AI-Chatbot (Multi-Tenant)

Master-Regeln: `Obsidian/CLAUDE.md`.

**Was dieser Ordner ist:** Production-Code Multi-Tenant Chatbot. Bedient Ewelinas Oase live unter `ewelinas-oase-chatbot.pages.dev`. Breaking Changes = echte Kundenanfragen brechen.

**Architektur kurz:** Cloudflare Pages + Pages Functions. Hybrid: `matchRule` → LLM-Kette (Groq primär, Anthropic/Together als Fallback wenn Keys in Env). Client-Configs pro Mandant in `functions/_clients/<slug>.js`.

**Projekt-spezifische Regeln:**
- Kein `git push` ohne explizites OK (Auto-Deploy aus `main`).
- `functions/_clients/ewelinas-oase.js` ist Live-Kundenkonfig → nur auf Ansage ändern.
- Keine Secrets committen (`.dev.vars`, `.wrangler/`, `.env`).
- Backward-compatible bleiben: ohne neue Env-Vars = bisheriges Verhalten.

**Kontext-Querverweise (falls nötig):**
- Tech-Phasen: `Obsidian/.../10-WRBL/Tech-Roadmap-2026-2027.md`
- Betriebssicht: `Obsidian/.../30-Kunden/Ewelina-Oase/Ewelinas-Oase-Betriebshandbuch.md`
