# ForgePilot — Bedienungs-Wiki

> Das vollständige Handbuch für ForgePilot, das local-first KI-Workflow-OS „From Idea to Execution".
> Geschrieben für Nutzer:innen — auch ohne Programmierkenntnisse. Code-Pfade sind als Referenz dabei.

**Stand:** 2026-06-21 · Gepflegt über den Skill [`/wiki-sync`](../../.claude/commands/wiki-sync.md) (siehe [CHANGELOG](CHANGELOG.md)).

---

## 📖 Inhalt

| # | Kapitel | Worum es geht |
|---|---------|---------------|
| 1 | [Überblick & Grundidee](01-ueberblick.md) | Was ForgePilot ist, das mentale Modell, die zwei Hauptwege |
| 2 | [Erste Schritte](02-erste-schritte.md) | Installation, Dev-Server, API-Keys, Navigation |
| 3 | [Seiten-Referenz](03-seiten-referenz.md) | Jede Seite einzeln: Zweck, Buttons, Bedienung |
| 4 | [Die geführte Journey](04-gefuehrte-journey.md) | Alle Bausteine nach dem Build (Funktionsbeweis, Kosten, Monitoring, PWA …) |
| 5 | [Praxis-Beispiel: App entwickeln](05-beispiel-app-entwicklung.md) | Schritt für Schritt von der Idee zur fertigen App |
| 6 | [Praxis-Beispiel: Reverse Engineering](06-beispiel-reverse-engineering.md) | Schritt für Schritt eine Alt-App analysieren & nachbauen |
| 7 | [Konzepte & Glossar](07-konzepte-glossar.md) | Delegation, Plan, Phase, Chain, Risk-Class, NBA … |
| 8 | [Sicherheit & Guardrails](08-sicherheit-guardrails.md) | Critical-Guardrail, Risk-Classes, Freigaben, Security-Scan |
| — | [CHANGELOG](CHANGELOG.md) | Was sich im Wiki (und der App) geändert hat |

---

## 🚀 Schnellstart

1. Dev-Server starten: `npm run dev` → Browser auf **http://localhost:3000**
2. In **`/settings`** mindestens einen KI-Provider hinterlegen (Anthropic API-Key **oder** lokales Ollama).
3. Auf **`/studio`** oder **`/suggestions`** eine Idee eingeben → „Planen & bauen".
4. Auf **`/delegations`** den Build live verfolgen.

→ Ausführlich in [Erste Schritte](02-erste-schritte.md) und im [App-Beispiel](05-beispiel-app-entwicklung.md).

## 🧭 Welches Kapitel für wen?

- **Du willst nur eine App bauen:** Kapitel 2 → 5.
- **Du willst eine alte App modernisieren:** Kapitel 2 → 6.
- **Du willst jede Seite verstehen:** Kapitel 3 + 4.
- **Du willst wissen, wie es intern funktioniert:** Kapitel 7 + 8.

## 🔄 Wiki aktuell halten

Dieses Wiki wird über den Skill **`/wiki-sync`** gepflegt: Nach jeder Änderung an der App werden die betroffenen Kapitel aktualisiert und im [CHANGELOG](CHANGELOG.md) festgehalten. So bleibt nichts undokumentiert. Details: [`.claude/commands/wiki-sync.md`](../../.claude/commands/wiki-sync.md).
