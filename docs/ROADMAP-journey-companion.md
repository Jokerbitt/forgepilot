# Roadmap — Journey Companion (Nicht-Techniker: Idee → fertige App → weiter)

**Status:** Aktiv · **Owner:** Sven · **Start:** 2026-06-20

Ziel: ForgePilot vom *Generator* zum *Begleiter* machen. Der Weg zur ersten App
ist da (Studio, Suggestions, Repo-Auto, Build, Deploy, Kosten, Reverse-Engineering).
Diese Roadmap schließt alles **danach** — Vertrauen, Iteration, produktive Nutzung,
Reichweite. Arbeitsweise wie gehabt: additiv, getestet, Commit + Push pro Schritt.

## Phase 1 — Vertrauen & Loop ✅ ABGESCHLOSSEN (2026-06-20)

| # | Feature | Module | Status |
|---|---------|--------|--------|
| 1.1 | **Klartext-Live-Fortschritt** — „Schritt 2 von 5 läuft …" | `src/lib/journey/progress.ts`, `/api/journey/progress`, `BuildProgress` | ✅ |
| 1.2 | **Klartext-Fehler + sichtbare Selbstheilung** | `explainError` + Retry-Sichtbarkeit in `progress.ts` | ✅ |
| 1.3 | **Ausprobieren + Feedback in natürlicher Sprache** | `src/lib/journey/feedback.ts`, `/api/journey/feedback`, `AppFeedback` (in /suggestions + /reverse) | ✅ |

## Phase 2 — Apps echt machen ✅ ABGESCHLOSSEN (2026-06-20)

| # | Feature | Module | Status |
|---|---------|--------|--------|
| 2.1 | **Bausteine per Klick** (Login, Zahlungen, E-Mail, Benachrichtigungen, Upload, Suche) | `src/lib/journey/blocks.ts`, `/api/journey/block`, Block-Picker in `AppFeedback` | ✅ |
| 2.2 | **Daten-Import (CSV/TSV) + Seed** (Excel via CSV-Export) | `src/lib/journey/data-import.ts`, `/api/journey/import` (preview+build), `DataImport` | ✅ |
| 2.3 | **Snapshots / sicheres Undo** (git, non-destruktiv) | `src/lib/journey/snapshot.ts`, `/api/journey/snapshot`, `Snapshots` | ✅ |

## Phase 3 — Reichweite & Wartung

| # | Feature | Ansatz | Status |
|---|---------|--------|--------|
| 3.1 | **Mobil/Responsive-Check** | automatisierter Viewport-Check via Preview, Klartext-Report | ⬜ |
| 3.2 | **Periodischer Security-Scan + Dependency-Updates** | reuse `reverse/security-scan` als Cron + Update-PR-Vorschlag | ⬜ |
| 3.3 | **App per Link teilen** | Deploy-URL (Task 2) + read-only Share-Ansicht | ⬜ |

## Zusatzideen (eingeplant, Priorität nach Bedarf)

- **Vorlagen-Galerie** (CRM, Buchungstool, Shop …) — Start bei einem Beispiel statt bei null.
- **Qualitäts-Report in Klartext** — „mit 24 Tests geprüft, alles grün" nach dem Build.
- **App-Export/Backup** — Code + Daten herunterladen (kein Lock-in).
- **Dashboard-Assistent „Was als Nächstes?"** — schlägt den nächsten sinnvollen Schritt vor.
- **Zahlungen/E-Mail als Klick-Baustein** (Stripe, Mail) — teils via Connectoren vorhanden.

## Reuse-Prinzip
Jeder Schritt baut auf Bestehendem auf: Delegation-/Plan-Executor (Status, chainPosition/
chainTotal, retryCount, budgetPaused), Building-Blocks/Connectoren, Deploy, Kosten-Routing,
Reverse-Module. Keine Parallel-Logik.

## Leitrechner / Critical
Sven bearbeitet das Leitrechner-Projekt „ein anderes Mal". Die Safety-Guardrail
(`src/lib/reverse/criticality.ts`) sperrt autonomen Nachbau kritischer Steuerungssoftware
bereits — bleibt unangetastet.
