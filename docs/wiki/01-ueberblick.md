# 1 · Überblick & Grundidee

[← Wiki-Index](README.md) · [Weiter: Erste Schritte →](02-erste-schritte.md)

---

## Was ist ForgePilot?

ForgePilot ist ein **local-first / NAS-first KI-Workflow-Betriebssystem** mit dem Leitsatz **„From Idea to Execution"**. Es verwandelt eine in Alltagssprache beschriebene Idee in eine **validierte, getestete Software** — und führt dabei auch Nicht-Techniker:innen sicher durch den ganzen Weg.

Kurz: Du beschreibst, **was** du willst. ForgePilot plant, baut, testet und liefert — Schritt für Schritt, nachvollziehbar und mit Sicherheitsnetzen.

- **Local-first:** läuft auf deinem Rechner; Daten und Keys bleiben lokal (`config/*.json`, nicht in Git).
- **KI-Wahl:** kostenlose lokale Modelle (Ollama / LM Studio) **oder** Cloud (Anthropic Claude u.a.) — automatisch nach Aufgabe und Kosten geroutet.
- **Kontrolliert:** jede Arbeitseinheit ist eine *Delegation* mit klarem Auftrag, Budget, Risikoklasse und Freigabe-Regeln.

## Die zwei Hauptwege

```
                ┌─────────────────────────────────────────────┐
   Deine Idee → │  A) NEUE APP BAUEN                           │ → fertige, getestete App
                │     /studio · /idea · /suggestions          │
                └─────────────────────────────────────────────┘
                ┌─────────────────────────────────────────────┐
   Alte App  →  │  B) REVERSE ENGINEERING                     │ → moderner, plattform-
                │     /reverse  (analysieren → nachbauen)      │   unabhängiger Nachbau
                └─────────────────────────────────────────────┘
```

- **A — Neue App:** Idee → Vorschläge/Funktionen wählen → Plan → autonom gebaut & getestet. → [Beispiel](05-beispiel-app-entwicklung.md)
- **B — Reverse Engineering:** bestehende (z.B. C#/.NET-) App analysieren → Sicherheits-/Tech-Schuld-Report → plattformunabhängigen Nachbau planen. → [Beispiel](06-beispiel-reverse-engineering.md)

## Das mentale Modell (wichtig)

Alles in ForgePilot folgt derselben Kette:

```
Idee
  └─ Plan  (DelegationPlan)            … in Phasen zerlegt
       └─ Phase 1 → Delegation         … ein konkreter Auftrag an einen KI-Agenten
            │  Build-Gate ✅  +  Test-Gate ✅   … erst grün, dann weiter
            └─ Phase 2 → Delegation     … baut auf Phase 1 auf (Chain)
                 └─ …                    … bis die App fertig ist
```

- Ein **Plan** ist die Gesamtaufgabe, zerlegt in **Phasen**.
- Jede Phase wird als **Delegation** (Auftrag) von einem KI-Agenten ausgeführt.
- Zwischen den Phasen stehen **Gates**: Die nächste Phase startet **nur**, wenn der Build grün ist **und** die Tests bestehen. So baut nichts auf einem kaputten Fundament auf.
- Die Phasen sind **verkettet** (Chain) und teilen sich den Arbeits-Workspace.

Diese Begriffe sind im [Konzept-Glossar](07-konzepte-glossar.md) im Detail erklärt.

## Architektur in einem Absatz

Next.js 14 (App Router, TypeScript strict, Tailwind) als App; Persistenz als JSON-Dateien unter `config/*.json`; KI-Anbindung über Ollama (lokal) und Cloud-Provider; Hintergrundjobs als Cron-Routen; Wissens-Index aus Markdown/NAS. Es gibt **keine** zwingende externe Datenbank — ForgePilot läuft sofort lokal.

## Sicherheit ist eingebaut

- **Risk-Classes A/B/C** steuern, was automatisch laufen darf und was eine menschliche Freigabe braucht.
- Der **Critical-Guardrail** beim Reverse Engineering sperrt den autonomen Nachbau **sicherheitskritischer Steuerungssoftware** (Leitrechner/SCADA/PLC) — er antwortet mit HTTP 409, bis ein Mensch ausdrücklich bestätigt.
- Ein **Security-Scanner** findet hartkodierte Secrets, SQL-Injection, schwache Krypto u.v.m.

Mehr dazu in [Sicherheit & Guardrails](08-sicherheit-guardrails.md).

---

[← Wiki-Index](README.md) · [Weiter: Erste Schritte →](02-erste-schritte.md)
