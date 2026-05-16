# ForgePilot App- und UX-Review

Stand: 2026-05-16
Autor: Codex
Basis: laufende lokale App, Code-Analyse, APIs, Linear-Tickets, NAS-SSOT und Claudes `FORGEPILOT-UX-KONZEPT-V3-TASKS-WORKFLOW.md`

## 1. Kurzfazit

ForgePilot ist inzwischen deutlich mehr als das urspruengliche `daily-briefing`: Die App hat Connector Health, WorkItems, NBA-Empfehlungen, Magic Create, lokale Tickets, Delegation Queue, Task Contracts, Agent Logs, Reports, Settings, Modelle und erste lokale Persistenz.

Der groesste Fortschritt ist nicht die Menge an Features, sondern der entstehende Produktkern:

> ForgePilot wird zur Kommandozentrale, in der Sven Aufgaben nicht nur sieht, sondern in kontrollierbare KI-Arbeit uebersetzt.

Gleichzeitig ist die App gerade an einem typischen Prototyp-Wendepunkt: Es gibt viel Funktionalitaet, aber noch zu wenig Fuehrung, zu viele simulierte Daten, zu viele Reloads und ein paar SSOT-Konflikte zwischen Code, NAS und Linear.

Meine Empfehlung:

> Vor M5 erst einen kurzen M4.11 Quality & UX Consolidation Sprint einziehen. Nicht noch mehr Features oben drauf, sondern die vorhandenen Workflows stabil, verstaendlich und bedienbar machen.

## 2. Was aktuell gut ist

### 2.1 Produktkern ist klarer geworden

Die Kombination aus `MagicCreate`, `NBAPanel`, `Delegation Center`, `TaskDetailModal`, Agent Logs und Settings zeigt schon den spaeteren Flow:

```text
Idee / Ticket -> Empfehlung -> Task Contract -> Delegation -> Agent Logs -> Report -> Feedback / Folgetask
```

Das ist der richtige Kern fuer ForgePilot.

### 2.2 Connector-Schicht ist stark

Die Connector-Architektur ist sauber:

- zentrale Registry
- Manifeste
- Health-API
- Env-Config-Reader
- Linear/GitHub Fetcher
- Normalisierung in `WorkItem`
- `Promise.allSettled` fuer partial success

Das ist markttauglich gedacht, weil die App nicht mit rohen API-Objekten arbeitet.

### 2.3 NBA Engine ist ein guter Start

Die NBA Engine liefert bereits priorisierte Empfehlungen. Das ist wichtig, weil ForgePilot kein Dashboard bleiben darf, sondern Entscheidungen vorbereiten soll.

Aktueller API-Stand:

- `/api/connectors/health`: Linear ok, GitHub ok
- `/api/work-items?source=all`: 48 WorkItems
- `/api/recommendations`: 5 Empfehlungen
- Top-Empfehlung: JOK-31 mit Score 100

### 2.4 Delegation Queue erzeugt Produktgefuehl

Die Delegation Queue ist der erste Bereich, in dem ForgePilot wie ein "KI-Team Cockpit" wirkt:

- laufende/ausstehende/abgeschlossene Tasks
- Agent Route
- Kosten
- Logs
- Task Details
- Reports
- Prioritaet per Drag & Drop

Das ist der richtige Ort fuer den spaeteren Agent Control Plane.

## 3. Wichtige Probleme und Risiken

### 3.1 Linear und NAS widersprechen sich

NAS sagt:

- M2 abgeschlossen
- M3 abgeschlossen
- M4.1 bis M4.9 abgeschlossen
- M4.10 aktiv

Linear sagt aktuell:

- JOK-31: In Progress
- JOK-32: Backlog
- JOK-33: Backlog
- JOK-34: Backlog
- JOK-35 bis JOK-41: Done
- JOK-59 bis JOK-75: Backlog

Das ist ein echter SSOT-Konflikt. Fuer ForgePilot ist das sogar ein perfekter Use Case:

> Die App sollte SSOT-Konflikte automatisch erkennen und als "Project Consistency Alert" anzeigen.

Regel:

- Linear ist Task-SSOT.
- NAS ist Projektmemory.
- Wenn NAS und Linear widersprechen, muss ForgePilot eine Klaerung vorschlagen.

### 3.2 Build ist aktuell nicht gruen

Verifikation:

- `npm run type-check`: gruen
- `npm run test:run`: 55/55 Tests gruen
- `npm run lint`: Fehler
- `npm run build`: Fehler wegen Lint

Konkreter Build-Blocker:

- `src/app/delegations/page.tsx:124`: unescaped quotes in JSX

Warnungen:

- fehlende `useEffect` Dependencies in `MagicConfirmModal`
- fehlende `useEffect` Dependencies in `ManualTicketModal`
- `<img>` statt `next/image` in `NBACard`

Vor M5 sollte Build wieder gruen sein.

### 3.3 TypeScript-Regel wird verletzt

Es gibt wieder `any` und `as any`, z.B.:

- `src/components/command-center/NBACard.tsx`
- `src/components/command-center/MagicConfirmModal.tsx`
- `src/app/api/magic-create/route.ts`
- `src/components/delegation/DelegationModal.tsx`
- `src/components/delegation/TaskDetailModal.tsx`

Das widerspricht dem Projektstandard "Keine any-Types".

### 3.4 RiskClass ist semantisch verdreht

In `TaskDetailModal.tsx` steht:

```text
Class A (High Risk)
Class B (Medium Risk)
Class C (Low Risk)
```

Im Projektstandard gilt aber:

```text
A = sicher
B = moderat
C = kritisch
```

Das muss dringend korrigiert werden, weil sonst Autonomie-Entscheidungen falsch verstanden werden.

### 3.5 Fake- und Demo-Daten sind noch zu sichtbar

Beispiele:

- `LIVEDEMO AKTIV` Banner auf der Startseite
- simulierte Reports bei Statuswechsel
- `Math.random()` fuer Kosten und Schaetzungen
- Fake-Progressbar mit `style={{ width: '60%' }}`
- "SIMULATION: LLM call"
- Testdaten wie "test", "gfdfgdgfdf"

Fuer einen Prototyp ist das okay. Fuer ein markttaugliches Produkt muss klar getrennt werden:

- echte Daten
- Demo-Modus
- Testdaten
- Mock-Modus

### 3.6 Bedienung ist noch zu modal-lastig

Aktuell gibt es mehrere Modals:

- DelegationModal
- TaskDetailModal
- DelegationLogsModal
- ReportModal
- ManualTicketModal
- MagicConfirmModal

Das erzeugt Kontextwechsel innerhalb der App. Claudes Vorschlag "Task Detail Drawer mit Tabs" ist deshalb richtig.

### 3.7 Zu viele Full Page Reloads

Mehrere Komponenten nutzen `window.location.reload()`. Das fuehlt sich grob an und zerstoert App-Zustand.

Besser:

- lokale State-Updates
- optimistic updates
- `router.refresh()`
- SWR/React Query spaeter

## 4. Linear-Tickets und Meilensteine

### 4.1 Aktuelle Ticket-Landschaft

M0/M1:

- JOK-35 bis JOK-41 sind in Linear Done.
- Das passt zur technischen Realitaet.

M2/M3/M4:

- Code/NAS sagen: weitgehend umgesetzt.
- Linear sagt: JOK-31 In Progress, JOK-32 bis JOK-34 Backlog.
- Hier muss aufgeraeumt werden.

M5/M6:

- JOK-42 und JOK-43 wirken doppelt: beide "Execution Bridge - Agent Runner verdrahten".
- JOK-44 Cost Intelligence
- JOK-45 Approval Inbox
- JOK-46 Telegram
- JOK-47 Obsidian
- JOK-48 Agent Templates

UX v2:

- JOK-49 bis JOK-58

UX v3:

- JOK-59 bis JOK-75

### 4.2 Bewertung von Claudes JOK-59 bis JOK-75

Sehr sinnvoll und kurzfristig wichtig:

- JOK-59 Strike-through und Status-Icons
- JOK-60 ganze Zeile klickbar
- JOK-61 DELETE Endpoint und Loeschen-Button
- JOK-62 Cancel Button direkt in Row
- JOK-63 Report als Tab im Detail
- JOK-64 Report-Modell erweitern
- JOK-65 Agent-Vorschlag als neue Delegation
- JOK-74 Pre-Flight Plan

Mittel-/langfristig sehr stark:

- JOK-66 Smart Context Suggestion
- JOK-67 Dependency-Chains
- JOK-69 Daily Standup
- JOK-71 Agent Scoreboard
- JOK-73 Multi-Step Workflows

Nur mit strengen Guardrails:

- JOK-70 Scheduler
- JOK-72 Autopilot-Modus
- JOK-75 Parallele Delegations

Warum: Diese drei Features erzeugen echte Autonomie. Sie brauchen vorher Approval Gates, Kill Switch, Budget Limits, Conflict Detection und Audit Logs.

## 5. Empfohlene Reihenfolge

### M4.11 Quality & UX Consolidation

Diese Phase sollte vor M5 kommen.

Ziele:

1. Build wieder gruen machen.
2. `any` entfernen.
3. RiskClass Labels korrigieren.
4. Demo/Fake-Daten klar markieren oder entfernen.
5. `window.location.reload()` reduzieren.
6. Delegation Detail Drawer als zentralen Arbeitsort vorbereiten.
7. Linear/NAS Status-Konflikte klaeren.
8. Testdaten bereinigen.

Konkrete Tickets:

- Neuer Task: `M4.11 Quality Gate: Build/Lint/any/RiskClass`
- Neuer Task: `M4.11 UX Consolidation: Detail Drawer statt Modal-Sprawl`
- Neuer Task: `M4.11 Data Hygiene: Demo/Testdaten und Fake-Reports trennen`
- Neuer Task: `M4.11 SSOT Sync: Linear vs NAS Status vergleichen`

### Danach M5 Execution Bridge

M5 sollte erst starten, wenn klar ist:

- Was ist nur ein Task Contract?
- Was ist eine echte Agent-Ausfuehrung?
- Wer startet sie?
- Wo wird Trace gespeichert?
- Wie wird gestoppt?
- Wie wird Kostenlimit erzwungen?
- Wann braucht es Approval?

M5 Reihenfolge:

1. Approval Inbox
2. Cost Guard
3. Agent Execution Adapter
4. Trace Store
5. Stop/Cancel/Retry
6. Report Generator

### Danach M6 Knowledge & Remote

M6:

- Obsidian Writeback
- Daily Standup
- Telegram/Remote Approval
- Agent Templates

## 6. GUI-Bedienkonzept

### 6.1 Leitidee

ForgePilot sollte sich anfuehlen wie ein Cockpit fuer ein KI-Team:

```text
Was ist wichtig?
Was kann delegiert werden?
Was laeuft gerade?
Was braucht meine Freigabe?
Was hat die KI geliefert?
Was ist der naechste sinnvolle Schritt?
```

Nicht:

```text
Hier sind 100 Tickets.
Such dir selbst raus, was wichtig ist.
```

### 6.2 Navigation

Empfohlene Hauptnavigation:

1. Command Center
2. WorkItems
3. Delegations
4. Agents
5. Projects
6. Knowledge
7. Costs
8. Settings

Desktop:

- linke Icon-Sidebar
- Tooltips fuer Icons
- aktiver Bereich klar markiert

Mobile:

- Bottom Navigation mit 4 Kernbereichen:
  - Home
  - Tasks
  - Agents
  - Approvals

### 6.3 Command Center

Startseite sollte nicht alle Daten zeigen, sondern die Arbeitslage zusammenfassen.

Oben:

- Today Focus
- Next Best Action
- Connector Health
- Approval Inbox
- Cost Today

Mitte:

- Top 3 NBA Cards
- Active Agent Runs
- Blocker

Unten:

- Daily Standup
- Recent Agent Reports
- Knowledge Writeback Suggestions

### 6.4 WorkItem Card

Jede WorkItem Card sollte progressiv aufgebaut sein.

Collapsed:

- Titel
- Quelle
- Score
- Status
- RiskClass
- naechste Aktion

Expanded:

- Warum diese Empfehlung?
- Kontext
- Abhaengigkeiten
- bestehende Delegations
- Create Delegation
- Pre-Flight Plan

### 6.5 Delegation Center

Delegation Center braucht Status-Tabs:

- Running
- Pending Approval
- Queued
- Completed
- Failed
- Cancelled

Row Verhalten:

- ganze Zeile oeffnet Detail Drawer
- Actions stoppen Propagation
- completed/cancelled/failed visuell klar
- Delete nur mit Inline Confirm
- Cancel/Stop direkt sichtbar

### 6.6 Task Detail Drawer

Der Drawer ersetzt mehrere Modals.

Tabs:

1. Overview
2. Contract
3. Logs
4. Report
5. History
6. Feedback

Overview:

- Status
- Agent
- Kosten
- Risiko
- Branch
- PR
- letzte Aktivitaet

Contract:

- Goal
- Context
- Definition of Done
- allowed Tools
- Privacy Mode
- Budget

Logs:

- Trace Events chronologisch
- Tool Calls
- Errors
- Kosten-Updates

Report:

- Dateien
- Tests
- Lines changed
- PR URL
- Warnings
- Next Suggestions

History:

- Retries
- Feedback-Schleifen
- Statuswechsel

Feedback:

- "Gut so"
- "Korrektur noetig"
- "Als Folgetask anlegen"

### 6.7 Beginner/Expert Mode

Beginner Mode:

- wenige Entscheidungen
- sichere Defaults
- "KI vorbereiten" statt "alles konfigurieren"

Expert Mode:

- Model
- Route
- Tools
- Budget
- Branch Strategy
- Privacy
- Risk
- Approval

Wichtig: Expert Mode darf nicht der Standard sein.

## 7. Eigene Feature-Vorschlaege von Codex

### Feature 1: Project Consistency Monitor

ForgePilot vergleicht:

- Linear Status
- NAS-Projektstand
- GitHub PR/CI
- lokale Branches

Output:

- "NAS sagt M3 Done, Linear sagt Backlog"
- "Branch aktiv, aber Ticket nicht In Progress"
- "PR gemergt, Ticket nicht Done"
- "Task erledigt, aber Knowledge Writeback fehlt"

Das ist extrem passend fuer Svens Multi-Agent-Setup.

### Feature 2: Agent Work Lock

Bevor ein Agent schreibt, traegt er ein:

- Agent
- Write Scope
- Do Not Touch
- Startzeit
- Ziel

ForgePilot zeigt live:

- Wer arbeitet woran?
- Welche Dateien sind reserviert?
- Gibt es Kollisionen?

Das operationalisiert die NAS-Koordinationstabelle direkt in der App.

### Feature 3: SSOT Writeback Assistant

Nach jedem Task fragt ForgePilot:

- Linear updaten?
- PR verlinken?
- ADR noetig?
- Standard aktualisieren?
- Fehlerdatenbank ergaenzen?
- NAS-Projektstand aktualisieren?

Das verhindert, dass Wissen im Chat verschwindet.

### Feature 4: Evidence-Based Report

Reports duerfen nicht vom Agenten frei erfunden werden.

Report-Daten sollten aus Fakten kommen:

- `git diff --stat`
- Test-Ergebnis
- Lint-Ergebnis
- Build-Ergebnis
- PR URL
- Commit Hashes
- geaenderte Dateien

Der Agent darf zusammenfassen, aber die Kennzahlen muessen aus echten Quellen kommen.

### Feature 5: Delegation Safety Score

Vor dem Start zeigt ForgePilot:

- Risiko
- Kostenbudget
- Schreibscope
- Tool-Rechte
- Konfliktgefahr
- Daten-Sensitivitaet
- Erfolgswahrscheinlichkeit

Ausgabe:

- Safe to auto-run
- Needs approval
- Needs human
- Split first
- Missing context

### Feature 6: Context Pack Builder

Beim Delegieren erstellt ForgePilot automatisch ein Kontextpaket:

- relevante Dateien
- relevante ADRs
- relevante Standards
- letzte PRs
- Tickettext
- DoD
- No-Go-Regeln

Das ist JOK-66, sollte aber als zentrales Produktfeature betrachtet werden.

### Feature 7: "Explain Why" fuer NBA

Jede Empfehlung braucht eine nachvollziehbare Begruendung:

- Warum Score 90?
- Warum delegierbar?
- Warum nicht Runner?
- Warum Risiko B?
- Welche Daten fehlen?

Das schafft Vertrauen.

## 8. UX-Prioritaet fuer die naechsten Tickets

Meine empfohlene Priorisierung:

1. Build/Lint/any/RiskClass Fixes
2. JOK-59 Status-Visualisierung
3. JOK-60 ganze Zeile klickbar
4. JOK-62 Cancel direkt in Row
5. JOK-61 Delete Endpoint mit Inline Confirm
6. JOK-63 Detail Drawer mit Tabs
7. JOK-64 echtes Report-Modell
8. JOK-74 Pre-Flight Plan
9. JOK-66 Smart Context Suggestion
10. Project Consistency Monitor
11. JOK-69 Daily Standup
12. SSOT Writeback Assistant
13. JOK-71 Agent Scoreboard
14. JOK-67 Dependency Chains
15. JOK-73 Multi-Step Workflows
16. JOK-70 Scheduler
17. JOK-72 Autopilot
18. JOK-75 Parallel Delegations

## 9. Marktfähigkeits-Feedback

Das Produkt hat ein starkes Marktversprechen, wenn es nicht versucht, alles auf einmal zu werden.

Was ForgePilot abheben kann:

- nicht nur Agent starten, sondern Agent-Arbeit steuern
- lokales/NAS-first Setup
- echtes SSOT-Konzept
- Kosten-/Risiko-/Approval-Gates
- Project Autopilot Score
- Idea-to-Execution Pipeline
- Wissen rueckfuehren statt Chat-Verlauf verlieren

Was es ruinieren wuerde:

- zu viele Mockdaten
- unklare Autonomie
- fehlende Fehlertransparenz
- "noch ein Dashboard"
- Agenten starten ohne Trace
- Linear/GitHub/Obsidian doppelt nachbauen

## 10. Definition of Done fuer die naechste Phase

Vor "M5 startet" sollte gelten:

- Build gruen
- Lint gruen
- Tests gruen
- keine `any`
- RiskClass UI korrekt
- keine sichtbaren Demo-Banner im normalen Modus
- Linear/NAS Status synchron oder Konflikt sichtbar
- Delegation Detail Drawer konzipiert oder begonnen
- Reports basieren perspektivisch auf echten Evidence-Daten
- Autonomie nur mit Approval/Kosten/Risiko-Gates

Dann ist ForgePilot bereit fuer die Execution Bridge.
