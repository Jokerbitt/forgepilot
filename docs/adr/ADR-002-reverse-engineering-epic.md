# ADR-002: Reverse-Engineering-Epic — Upload → Analyse → Nachbau

**Date:** 2026-06-20
**Status:** Accepted (Sven-Freigabe 2026-06-20) — Slices 1–3 implementiert, Slice 4 offen
**Risk Class:** C (requires ADR + Sven-Freigabe)

> **Umsetzungsstand 2026-06-20:** Slice 1 (Analyse-Report, multi-language inkl.
> C#/.NET), Slice 2 (Nachbau-Plan mit Logik-1:1-Paritätstest, DB-Migration,
> Security-/Bug-Fix, Redesign, cross-platform) und Slice 3 (sicherer ZIP-Upload)
> sind gebaut, getestet und gepusht. Slice 4 (Desktop-Tiefe, dann PLC) sowie die
> Zusatzideen sind offen. **Leitrechner/Critical:** kein autonomer Nachbau —
> nur Analyse/Teilmodernisierung unter menschlicher Verifikation.

## Context

Die geführte Journey deckt heute den Weg **Idee → fertige App** ab (Idea Studio,
Suggestions, Repo-Auto, validierter Build, Deploy, Kosten-Routing). Es fehlt der
umgekehrte Weg: **bestehende Artefakte (Code, Doku, Screenshots) → Verstehen →
Nachbau**. Ziel ist, dass ein Nicht-Techniker eine vorhandene Anwendung (zuerst
Web) hochlädt, einen verständlichen Analyse-Report bekommt und daraus einen
validierten Nachbau anstoßen kann.

Sven möchte einen **Mix** aus drei Aspekten, schrittweise und additiv:
- echtes **Hochladen aller Dateien** (ZIP/Ordner),
- **Analyse-Reports zuerst** (Verstehen vor Bauen),
- danach **Nachbau-Plan** in den bestehenden validierten Build-Flow.

Reihenfolge der Domänen bleibt: **Web zuerst, dann Desktop, PLC zuletzt** (sehr
speziell, eigene Risikoklasse).

Bereits vorhandene, wiederverwendbare Bausteine:
- `src/lib/suggestions/codebase-analyzer.ts` — read-only Repo-Scan (Stack,
  Struktur, Risiko-Signale). Basis für die Web-Analyse.
- `src/lib/delegations/codebase-scout.ts` — keyword-basiertes Datei-Finden +
  Snippets + Projekt-Konventionen.
- `src/lib/suggestions/to-plan.ts` — wandelt Schritte in einen **validierten,
  sequenziellen DelegationPlan** (build-gate + Tests pro Phase).
- `src/lib/repo/create-repo.ts` — Ziel-Repo automatisch anlegen.
- `src/lib/cost-routing/plan-cost.ts` — Klartext-Kostenvorschau pro Plan.
- `src/lib/deploy/` — Nachbau am Ende live schalten.

Das Epic verdrahtet diese Bausteine entlang einer neuen Pipeline statt neue,
parallele Logik zu bauen.

## Decision

Ein eigenständiges Modul **`src/lib/reverse/`** mit einer klaren Pipeline und
**vier additiven Slices**. Jeder Slice ist für sich nützlich, getestet und
gepusht, bricht nichts Bestehendes.

### Zielarchitektur (Pipeline)

```
Upload (ZIP/Ordner/Pfad)
   ↓  ingest        → entpacken, normalisieren, sichere Sandbox unter einem tmp-Workspace
Inventory           → Dateibaum, Sprachen, Frameworks, Größenklassen (reuse codebase-analyzer)
   ↓  analyze
Analyse-Report      → Klartext-Doku: Architektur, Routen/Seiten, Features, Datenmodell,
                       Abhängigkeiten, Tech-Schulden, Nachbau-Empfehlung
   ↓  to-rebuild-plan
Nachbau-Plan        → Feature-/Phasen-Liste → suggestionsToPlan → validierter sequenzieller Build
   ↓  (bestehend)
Repo-Auto + Build + Deploy + Kosten-Vorschau
```

### Slice-Plan

- **Slice 1 — Analyse-Report (read-only, pfad-basiert).**
  `src/lib/reverse/analyze.ts`: tiefer Web-Scan auf einem vorhandenen Pfad
  (reuse codebase-analyzer + codebase-scout), erzeugt `ReverseReport`
  (Architektur, erkannte Routen/Seiten/Components, Datenmodell-Heuristik,
  Dependencies, Tech-Schulden, Klartext-Zusammenfassung). API `/api/reverse/analyze`,
  Seite `/reverse`. Kein Upload, kein Nachbau — wie `/deploy` & analyze pfad-basiert.
  → liefert sofort den "Analyse-Report zuerst"-Nutzen.

- **Slice 2 — Nachbau-Plan aus dem Report.**
  `src/lib/reverse/to-rebuild-plan.ts`: macht aus den erkannten Features eine
  Schrittliste und speist sie in `suggestionsToPlan` ein (validierter Build).
  Plus Kosten-Vorschau (reuse plan-cost). Button "Nachbauen" im `/reverse`-Report.

- **Slice 3 — echter Datei-Upload.**
  `/api/reverse/upload` (ZIP/Multi-File) → sicheres Entpacken in einen
  tmp-Workspace (Pfad-Traversal-Schutz, Größen-/Datei-Limits), dann Slice-1/2
  darauf. Upload-UI in `/reverse`. Trennt "Pfad angeben" (lokal) von "hochladen".

- **Slice 4 — Domänen-Erweiterung (separat, später).**
  Desktop (Electron/Tauri/.NET-Heuristiken), danach PLC (sehr speziell, eigene
  Risikoklasse, evtl. read-only Doku-Analyse ohne Nachbau).

### Zusätzliche Ideen (Mehrwert, optional einplanbar)

1. **Screenshot/UI-Nachbau:** Bild einer App hochladen → Vision-LLM beschreibt
   Layout/Komponenten → fließt als Feature-Hinweise in den Nachbau-Plan.
2. **Doku-/PDF-Ingest:** README, Spezifikationen, Confluence-Export einlesen und
   in den Report mischen (oft aussagekräftiger als Code allein).
3. **Tech-Stack-Translation:** "Nachbau in moderner Stack" — z. B. altes PHP/jQuery
   → Next.js. Mapping-Tabelle alte→neue Bausteine (reuse Building-Blocks/Connectoren).
4. **Diff-/Parität-Check:** nach dem Nachbau ein Report "X von Y erkannten Features
   abgedeckt" als Definition-of-Done-Verstärkung.
5. **Secrets-/Risiko-Scan beim Ingest:** hochgeladene Artefakte auf hartkodierte
   Secrets prüfen und im Report warnen (Sicherheitsregel: nie loggen).
6. **Wissens-Writeback:** erkannte Architektur als Knowledge-Card in die NAS-SSOT,
   damit spätere Builds den Kontext kennen.

## Consequences

**Positive:**
- Maximaler Reuse — Analyse, Plan, Build, Deploy, Kosten existieren bereits.
- Jeder Slice ist eigenständig wertvoll und niedrig-riskant (Slice 1 read-only).
- "Analyse zuerst" gibt Nicht-Technikern Vertrauen, bevor gebaut wird.

**Negative / Trade-offs:**
- Upload (Slice 3) bringt echte Angriffsfläche (Pfad-Traversal, Zip-Bomb,
  Secrets) → harte Limits + Sandbox + Tests nötig.
- Nachbau ist nie 1:1 — klare Klartext-Kommunikation "Annäherung, kein Klon".
- Vision/Doku-Ingest erhöht Token-Kosten → an Kosten-Routing koppeln.

## Alternatives Considered
- **Upload-first (Option 2):** größerer, riskanterer erster Schritt; verschoben auf Slice 3.
- **Nur Analyse, kein Nachbau (Option 3):** als Slice 1 enthalten, aber nicht Endausbau.
- **Alles auf einmal:** zu großes Risiko, widerspricht der additiven Arbeitsweise.

## Open Questions (für Sven)
1. Slice 1 jetzt starten (read-only Analyse-Report), Rest danach? **Empfehlung: ja.**
2. Welche der Zusatz-Ideen sind dir am wichtigsten (Screenshot, Doku-Ingest,
   Stack-Translation, Parität, Secrets-Scan, Writeback)?
3. Upload-Limits: max. Größe / Dateitypen / ZIP erlaubt?
