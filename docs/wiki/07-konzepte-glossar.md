# 7 · Konzepte & Glossar

[← Reverse-Engineering-Beispiel](06-beispiel-reverse-engineering.md) · [Weiter: Sicherheit & Guardrails →](08-sicherheit-guardrails.md)

---

Die zentralen Begriffe, die in der ganzen App vorkommen — jeweils mit Code-Pfad als Referenz.

## Delegation
`src/lib/models/delegation.ts`
Eine **einzelne Arbeitseinheit**, die ein KI-Agent ausführt. Sie hat einen Titel, einen `contract` (den Auftrag), einen `status` (`pending → approved → running → completed | failed | cancelled`) und eine `executionRoute` (z.B. lokaler Agent, Ollama, Runner). Über `chainNextId`/`chainedFromId` ist sie mit den Nachbar-Phasen verkettet.

## TaskContract
`src/lib/models/delegation.ts`
Der **Vertrag** einer Delegation: `goal`, `context`, `definitionOfDone` (woran „fertig" gemessen wird), `riskClass` (A/B/C), `maxBudgetUsd` (Kostendeckel), `allowedTools`, `requiresApproval`, `privacyMode` (local/private-cloud/public). Der Agent bekommt diesen Vertrag als Kopf seines Prompts.

## DelegationPlan & Phase
`src/lib/delegations/plan-generator.ts`
Ein **Plan** ist die Gesamtaufgabe, zerlegt in **Phasen** (`PlanPhase`). Jede Phase hat `title`, `description`, `dodItems` (Definition of Done), `riskClass`, `estimatedTurns` (Budget) und `dependsOn` (welche Phasen vorher fertig sein müssen). Pläne werden in `config/delegation-plans.json` gespeichert; `POST /api/delegations/plan/[id]/execute` verwandelt sie in echte Delegationen und startet die erste.

## Chain (Verkettung)
`src/lib/delegations/chaining.ts`
Phasen werden **automatisch nacheinander** ausgeführt: Ist eine Phase fertig, setzt `triggerChain()` die nächste (`chainNextId`) auf `approved` und startet sie. Über `chainedFromId` **teilt** sich die nächste Phase den Arbeits-Workspace der vorigen — sie baut direkt darauf auf, statt neu zu scaffolden.

## Build-Gate & Test-Gate
`src/lib/delegations/phase-gate.ts` + `src/app/api/delegations/[id]/execute/route.ts`
Das **Sicherheitsnetz zwischen Phasen**. Bevor die nächste Phase startet:
1. **Build-Gate:** `npm run build` muss grün sein (sonst stoppt die Kette).
2. **Test-Gate:** `npm run test:run` muss grün sein.
Die reine Entscheidung trifft `decidePhaseGate(...)`. Sonderfälle: ein **Test-Timeout** gilt als Infrastruktur-Signal (kein Code-Fehler) und stoppt die Kette **nicht**; fehlt ein Build-/Test-Script, wird der jeweilige Schritt übersprungen. So baut keine Phase auf einem kaputten Fundament auf.

## Risk-Class (A / B / C)
`src/lib/models/work-item.ts`
Risiko-Einstufung einer Aufgabe:
- **A** — reine Ergänzungen (neue Dateien/Routen). Gilt als sicher → kann automatisch laufen.
- **B** — Änderungen an bestehendem Code. Üblicherweise PR-Review vor Merge.
- **C** — Schema, Auth, Zahlungen, Sicherheit. **Immer** menschliche Freigabe (und ein ADR in `docs/adr/`).

## NBA — Next Best Action
`src/lib/nba-engine/`
Bewertet Arbeitspakete nach **Dringlichkeit, Wirkung, Delegierbarkeit, Bereitschaft** (Score 0–100) und empfiehlt die nächste sinnvolle Aktion (jetzt erledigen, an KI delegieren, recherchieren, warten, blockiert). Treibt das Command Center und das Briefing.

## Approval-Policy / Governance
`src/lib/nba-engine/approval-policy.ts` · Seite `/governance`
Bestimmt, was **automatisch** laufen darf. Modi in `/settings`:
- **manual** — alles braucht Freigabe.
- **balanced** — nur Risk-A automatisch; B/C brauchen Freigabe.
- **autopilot** — A/B unter einer Score-Schwelle automatisch; **C niemals** automatisch.
Die Governance-Engine arbeitet „deny-first" (im Zweifel sperren).

## Building Blocks
`src/lib/building-blocks/`
Wiederverwendbare **Bausteine** (Login, Zahlungen, E-Mail, Upload, Suche, Connectoren …). Statt alles neu zu schreiben, wählt ForgePilot passende Blocks anhand des Ziels und der Agent baut darauf auf. In der Journey per Klick hinzufügbar.

## Model Router & Cost Routing
`src/lib/model-router/` · `src/lib/cost-routing/`
Entscheidet **pro Schritt**, welches Modell läuft: einfache/günstige Schritte lokal (Ollama, kostenlos), anspruchsvolle in der Cloud. `POST /api/cost-routing` liefert die Klartext-Schätzung („X lokal, Y Cloud"), die du vor dem Bauen siehst.

## Knowledge / Memory Cards
`src/lib/knowledge/` · `src/lib/delegations/knowledge-packages.ts`
ForgePilot speichert **Memory Cards** (Erkenntnisse, Entscheidungen, Risiken) und indexiert Markdown/NAS-Wissen. Vor einem Agentenlauf wird relevantes Domänenwissen in den Prompt injiziert; nach einem Lauf werden neue Lessons zurückgeschrieben (Lern-Schleife).

## Orchestrierung
`src/lib/agents/`
Große Aufgaben werden via `decomposeTask()` in **atomare Sub-Tasks** (je ≤ 3 Dateien) zerlegt, an passende Agenten verteilt, mit `scoreWork()` (0–100, Note A–F) bewertet und bei Note F automatisch wiederholt. Sichtbar auf `/orchestrations` und im Delegation-Detail („⚙ Orchestrieren").

## Wichtige API-Routen (Kurzreferenz)

| Route | Zweck |
|---|---|
| `POST /api/suggestions` | Vorschläge zu einer Idee generieren |
| `POST /api/suggestions/analyze` | Bestehendes Repo analysieren |
| `POST /api/suggestions/build` | Plan erstellen + Build starten |
| `POST /api/cost-routing` | Kosten-/Routing-Schätzung |
| `POST /api/delegations/plan/[id]/execute` | Plan → Delegations-Kette starten |
| `POST /api/delegations/[id]/execute` | Eine Delegation ausführen (inkl. Gates) |
| `POST /api/reverse/analyze` · `/upload` | Alt-App analysieren (Pfad/ZIP) |
| `POST /api/reverse/rebuild` | Nachbau-Plan starten (409 bei critical) |
| `POST /api/journey/*` | Journey-Bausteine (block, feedback, function-proof, monitoring, cost-review, pwa, …) |

---

[← Reverse-Engineering-Beispiel](06-beispiel-reverse-engineering.md) · [Weiter: Sicherheit & Guardrails →](08-sicherheit-guardrails.md)
