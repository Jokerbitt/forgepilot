# Wiki-Änderungsprotokoll

Jede Änderung an ForgePilot, die für Nutzer:innen sichtbar ist, wird hier festgehalten — gepflegt über den Skill [`/wiki-sync`](../../.claude/commands/wiki-sync.md). Neueste Einträge oben.

Format pro Eintrag: **Datum · Was sich geändert hat · betroffene Wiki-Seite(n) · Commit/PR**.

---

## 2026-06-21

- **Wiki erstellt.** Vollständiges Bedienungs-Handbuch unter `docs/wiki/`: Überblick, Erste Schritte, Seiten-Referenz, geführte Journey, zwei Praxis-Beispiele (App-Entwicklung & Reverse Engineering), Konzepte/Glossar, Sicherheit/Guardrails. → alle Seiten · PR #595
- **Journey Phase 4 komplett** (4.1 Funktionsbeweis, 4.2 Real-Kosten-Rückblick, 4.3 Betriebs-Monitoring, 4.4 Mobile/PWA). → [04-gefuehrte-journey.md](04-gefuehrte-journey.md) · Commits `b8fc5d7`, `a90237a`, `62cd07c`
- **Reverse-Engineering verbessert:** Security-Scanner erkennt jetzt auch PHP-Secrets/Tokens (Stripe/GitHub/…), PHP-SQL-Injection und lowercase `md5()`; Stack-Erkennung erkennt Flask/Django/FastAPI/Spring/Laravel/Symfony/Rails + PostgreSQL/MySQL/MongoDB-Treiber. → [06-beispiel-reverse-engineering.md](06-beispiel-reverse-engineering.md), [08-sicherheit-guardrails.md](08-sicherheit-guardrails.md) · Commit `c2d59e0`
- **Phasen-Test-Gate:** Zwischen Build-Phasen müssen jetzt auch die **Tests** grün sein (vorher nur der Build). → [07-konzepte-glossar.md](07-konzepte-glossar.md), [08-sicherheit-guardrails.md](08-sicherheit-guardrails.md) · Commit `f240156`

<!--
Nächster Eintrag hier einfügen (Vorlage):

## JJJJ-MM-TT

- **<Was sich geändert hat>** — <Kurzbeschreibung für Nutzer:innen>. → [<wiki-seite>](<datei>.md) · Commit `<sha>` / PR #<nr>
-->
