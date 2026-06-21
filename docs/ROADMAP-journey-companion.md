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

## Phase 3 — Reichweite & Wartung ✅ ABGESCHLOSSEN (2026-06-20)

| # | Feature | Module | Status |
|---|---------|--------|--------|
| 3.1 | **Mobil/Responsive-Check** (statische Heuristik + 1-Klick-Fix) | `src/lib/journey/responsive-check.ts`, `/api/journey/responsive`, `MobileCheck` | ✅ |
| 3.2 | **Wartung: Security-Scan + Dependency-Updates** (on-demand + wöchentlicher Cron) | `src/lib/journey/maintenance.ts`, `/api/journey/maintenance`, `/api/cron/journey-maintenance` (vercel.json), `Maintenance` | ✅ |
| 3.3 | **App per Link teilen** (Validierung + localhost-Warnung) | `src/lib/journey/share.ts`, `ShareLink` | ✅ |

## Zusatzideen ✅ ABGESCHLOSSEN (2026-06-20)

- ✅ **Vorlagen-Galerie** — `src/lib/journey/templates.ts`, `/api/journey/template`, Galerie in `/suggestions`.
- ✅ **Qualitäts-Report in Klartext** — `src/lib/journey/quality.ts`, `/api/journey/quality`, `QualityReport`.
- ✅ **App-Export/Backup** — `src/lib/journey/export.ts` (git archive), `/api/journey/export`, Backup-Button.
- ✅ **Dashboard-Assistent „Was als Nächstes?"** — `src/lib/journey/next-action.ts`, `/api/journey/next-action`, `NextSteps`.
- ✅ **Zahlungen/E-Mail als Klick-Baustein** — über die Phase-2.1-Bausteine (`blocks.ts`) abgedeckt.

---

**Gesamtstatus Phasen 1–3 + Zusatzideen: umgesetzt (2026-06-20).**

## Phase 4 — Vertrauen, Betrieb & Reichweite (geplant 2026-06-20)

Nächste Stufe, nach Hebel priorisiert. Arbeitsweise wie gehabt: additiv, getestet, Commit pro Schritt.

| # | Feature | Ansatz | Status |
|---|---------|--------|--------|
| 4.1 | **Funktionsbeweis** (höchster Hebel) | Nach dem Build App starten + Kernpfade durchklicken (Preview-Infra vorhanden) → Klartext-Beweis + Screenshot „funktioniert". Verwandelt „sollte gehen" in „nachweislich getestet". `src/lib/journey/function-proof.ts`, `/api/journey/function-proof`, `FunctionProof`. | ✅ |
| 4.2 | **Real-Kosten-Rückblick** | Ist-Kosten nach dem Build (Summe `actualCostUsd`) vs. Vorab-Schätzung (Summe `costEstimateUsd`) + Budget, in Klartext (günstiger/im Rahmen/teurer/kostenlos). Logik USD, Anzeige EUR. `src/lib/journey/cost-review.ts`, `/api/journey/cost-review`, `CostReview` in `/suggestions`. | ✅ |
| 4.3 | **Betriebs-Monitoring** | Health-/Fehler-Check für live geschaltete Apps in Klartext (🟢/🟡/🔴), mit Antwortzeit + Ausfall-Serie über mehrere Prüfungen; macht ForgePilot vom Generator zum Betreiber. `src/lib/journey/monitoring.ts` + `monitoring-store.ts`, `/api/journey/monitoring`, `Monitoring`. | ✅ |
| 4.4 | **Mobile / PWA-Apps** | Apps auch fürs Handy: PWA-Check (installierbar?) + 1-Klick-Einrichtung (Manifest + Service-Worker via Plan-Executor). Reichweiten-Sprung über Web hinaus. `src/lib/journey/pwa.ts`, `/api/journey/pwa`, `PwaSetup`. | ✅ |

**Phase 4 komplett (2026-06-21):** 4.1 Funktionsbeweis · 4.2 Real-Kosten · 4.3 Monitoring · 4.4 Mobile/PWA — alle additiv, getestet, gepusht auf `feature/nav-cleanup-workbench`.

## Reuse-Prinzip
Jeder Schritt baut auf Bestehendem auf: Delegation-/Plan-Executor (Status, chainPosition/
chainTotal, retryCount, budgetPaused), Building-Blocks/Connectoren, Deploy, Kosten-Routing,
Reverse-Module. Keine Parallel-Logik.

## Leitrechner / Critical
Sven bearbeitet das Leitrechner-Projekt „ein anderes Mal". Die Safety-Guardrail
(`src/lib/reverse/criticality.ts`) sperrt autonomen Nachbau kritischer Steuerungssoftware
bereits — bleibt unangetastet.
