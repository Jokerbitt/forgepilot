# ForgePilot Expert Mode: Execution Control Panel

Status: Produktstandard v0.1
Erstellt: 2026-05-16
Autor: Codex
Gilt fuer: Expert Mode, Delegation Flow, Task Contract UI, Agent Execution Bridge

## 1. Kurzfassung

Der Expert Mode in ForgePilot ist nicht nur ein Bereich mit mehr Formularfeldern. Er ist das **Execution Control Panel** fuer KI-Arbeit.

Beginner Mode:

- sichere Defaults
- wenige Entscheidungen
- Fokus auf "sicher delegieren"
- ideal fuer Alltag und schnelle Aufgaben

Expert Mode:

- volle Steuerung
- Provider-/Modellwahl
- Ausfuehrungsroute
- Budget
- Tools und Rechte
- Privacy
- Approval
- Schreibscope
- Output-Ziel
- Fallbacks und Sicherheitsregeln

Leitsatz:

> Wer loslaesst bekommt Automatismus. Wer kontrollieren will bekommt volle manuelle Steuerung.

## 2. Warum das wichtig ist

ForgePilot soll kein blindes Autopilot-Spielzeug werden. Die Staerke liegt darin, dass Sven entscheiden kann:

- Soll die KI nur planen?
- Soll sie direkt Code schreiben?
- Soll sie lokal laufen?
- Soll ein Cloud-Modell genutzt werden?
- Soll ein guenstiges Modell reichen?
- Muss ein starkes Reasoning-Modell ran?
- Welche Tools darf der Agent benutzen?
- Was darf auf keinen Fall veraendert werden?
- Ab welchem Risiko oder Budget braucht es Freigabe?

Damit wird ForgePilot zur Steuerzentrale fuer KI-Arbeit, nicht nur zum Startbutton fuer Agenten.

## 3. Execution Control Panel — Bereiche

### 3.1 Modell und Provider

Der Expert Mode muss Modellwahl als Erstklasse-Funktion behandeln.

Optionen:

- Provider:
  - Local
  - Anthropic
  - OpenAI
  - Google
  - OpenRouter
  - Azure OpenAI
  - AWS Bedrock
  - spaeter weitere OpenAI-kompatible Endpunkte
- Modell:
  - Claude Sonnet / Opus / Haiku
  - GPT-Modelle
  - Gemini-Modelle
  - lokale Ollama-/LM-Studio-/llama.cpp-Modelle
  - eigene Provider-Modelle
- Modus:
  - guenstig
  - schnell
  - ausgewogen
  - maximal genau
  - lokal / privat
- Fallback-Modell:
  - Beispiel: lokal versuchen, sonst Cloud nach Approval
- Kontextgroesse:
  - klein
  - mittel
  - gross
- Reasoning-Level, falls vom Provider unterstuetzt:
  - niedrig
  - mittel
  - hoch

Wichtig: Modell- und Provider-Auswahl darf keine Secrets anzeigen.

### 3.2 Execution Route

Der Expert Mode muss klar machen, wo die Arbeit ausgefuehrt wird.

Routen:

- `manual`: nur planen / Mensch arbeitet
- `direct-chat`: kleine Aufgaben direkt mit Codex/Claude
- `local-agent`: lokaler Agent auf dem Rechner
- `runner`: Hintergrundjob auf NAS
- `n8n`: Workflow / Research / Automation
- `hybrid`: erst Plan, dann Approval, dann Ausfuehrung

Empfohlene UI:

```text
Route:
[ Nur planen ] [ Direct Chat ] [ Local Agent ] [ NAS Runner ] [ n8n ] [ Hybrid ]
```

### 3.3 Kosten und Budget

Jede Expert-Delegation braucht Kostenkontrolle.

Felder:

- Max Budget pro Task
- Warnschwelle
- Stop bei Budgetueberschreitung
- bevorzugt guenstigstes passendes Modell
- Kostenschaetzung vor Start
- erwartete Laufzeit
- Kostenmodus:
  - minimal
  - balanced
  - quality first

Guardrail:

- Wenn Budget > Standardlimit, Approval erforderlich.
- Wenn Runner/Cloud-Modell genutzt wird, Kosten sichtbar anzeigen.

### 3.4 Tools und Rechte

Der Expert Mode muss Toolrechte granular steuern.

Tools:

- Dateien lesen
- Dateien schreiben
- Code suchen
- Terminal ausfuehren
- Tests ausfuehren
- GitHub API lesen
- GitHub PR erstellen
- Linear lesen
- Linear schreiben
- Websuche
- Obsidian lesen
- Obsidian schreiben
- n8n Workflow triggern
- externe Nachrichten senden

Wichtig:

- Schreibrechte getrennt von Leserechten.
- Externe Kommunikation immer mit Approval.
- Obsidian Writeback nur mit Knowledge-Gate oder Approval.
- Terminalausfuehrung bei RiskClass C nie ohne Freigabe.

### 3.5 Sicherheit und Privacy

Felder:

- Privacy Mode:
  - local only
  - private cloud allowed
  - public research
  - restricted
- RiskClass:
  - A = sicher
  - B = moderat
  - C = kritisch
- Approval erforderlich:
  - ja / nein
  - automatisch aus RiskClass ableitbar
- Schreibscope:
  - erlaubte Pfade
  - erlaubte Module
  - erlaubte Dateitypen
- Do-not-touch:
  - gesperrte Ordner
  - Secrets
  - produktive Konfiguration
  - fremde Agenten-Scopes
- Auto-Stop bei:
  - Testfehlern
  - Budgetlimit
  - unbekanntem Tool
  - Scope-Verletzung
  - Secret-Erkennung

### 3.6 Output-Ziel

Der User muss festlegen koennen, was der Agent liefern soll.

Output-Optionen:

- nur Plan
- Pre-Flight Plan
- Code-Aenderung
- Tests
- PR erstellen
- Report schreiben
- Linear aktualisieren
- Obsidian / Second Brain aktualisieren
- NAS-SSOT aktualisieren
- nur Vorschlag, keine Ausfuehrung

Empfehlung:

- Beginner Mode: `Pre-Flight Plan -> Approval -> Execution`
- Expert Mode: User kann direkt `Plan only`, `Code`, `PR`, `Report`, `Writeback` waehlen.

## 4. TaskContract-Erweiterung

Langfristig sollte `TaskContract` diese Konzepte abbilden:

```ts
interface ExecutionProfile {
  provider: string
  model: string
  fallbackModel?: string
  mode: 'cheap' | 'fast' | 'balanced' | 'quality' | 'local'
  reasoningLevel?: 'low' | 'medium' | 'high'
  contextSize?: 'small' | 'medium' | 'large'
}

interface BudgetPolicy {
  maxBudgetUsd: number
  warnAtUsd?: number
  stopAtBudget: boolean
  preferCheapestViableModel: boolean
}

interface ToolPolicy {
  allowedTools: string[]
  deniedTools: string[]
  writeScopes: string[]
  doNotTouch: string[]
}

interface OutputPolicy {
  createPlan: boolean
  modifyCode: boolean
  runTests: boolean
  createPullRequest: boolean
  writeReport: boolean
  updateLinear: boolean
  updateSecondBrain: boolean
  updateNasSsot: boolean
}
```

Diese Erweiterung sollte nicht sofort als grosses Refactoring eingebaut werden. Erst UI-Konzept, dann minimale Felder, dann echte Execution Bridge.

## 5. GUI-Konzept

Expert Mode soll als aufklappbarer Bereich im Delegation Flow erscheinen.

Empfohlene Tabs:

1. Model
2. Route
3. Budget
4. Tools
5. Safety
6. Output

Beispiel:

```text
Neue Delegation

Ziel:
[ Was soll erledigt werden? ]

Beginner Mode:
[ Sicher delegieren ]

Expert Mode v
  [Model] [Route] [Budget] [Tools] [Safety] [Output]

  Model:
  Provider: [Local v]
  Modell:   [ollama/deepseek-coder v]
  Fallback: [Claude Sonnet nach Approval v]

  Route:
  [Plan only] [Local Agent] [NAS Runner] [n8n]

  Budget:
  Max: [$1.00]
  Stop bei Limit: [x]

  Tools:
  [x] read_file
  [x] write_file
  [x] search_code
  [ ] run_command
  [ ] github_pr_create

  Safety:
  Privacy: [local only]
  RiskClass: [B]
  Approval: [required]
  Write Scope: [src/lib/connectors/**]
  Do not touch: [src/lib/models/**]

  Output:
  [x] Report
  [x] Tests
  [ ] PR erstellen
  [x] NAS-SSOT Writeback
```

## 6. Reihenfolge fuer Tickets

Dieses Konzept sollte in die bestehenden Expert-Mode-Tickets einfliessen.

Prioritaet:

1. JOK-76: Neue Delegation direkt erstellen
2. JOK-80: Template-UI
3. Neues Ticket: Expert Mode Model/Provider Selection
4. Neues Ticket: Expert Mode Tool/Permission Policy
5. Neues Ticket: Expert Mode Budget & Safety Policy
6. Neues Ticket: Output Policy und Writeback Optionen
7. Spaeter: Autopilot nutzt dieselben Policies automatisch

## 7. GitHub Feature und Tasks

Angelegt am 2026-05-16 im Repository `Jokerbitt/forgepilot`.

Feature:

- #12 Feature: Expert Mode Execution Control Panel
  - https://github.com/Jokerbitt/forgepilot/issues/12

Tasks:

- #13 Task: Expert Mode Model & Provider Selection
  - https://github.com/Jokerbitt/forgepilot/issues/13
- #14 Task: Expert Mode Execution Route Control
  - https://github.com/Jokerbitt/forgepilot/issues/14
- #15 Task: Expert Mode Budget & Safety Policy
  - https://github.com/Jokerbitt/forgepilot/issues/15
- #16 Task: Expert Mode Tool & Permission Policy
  - https://github.com/Jokerbitt/forgepilot/issues/16
- #17 Task: Expert Mode Output & Writeback Policy
  - https://github.com/Jokerbitt/forgepilot/issues/17
- #18 Task: Expert Mode UI Tabs in Delegation Flow
  - https://github.com/Jokerbitt/forgepilot/issues/18
- #19 Task: TaskContract Policy Model Vorbereitung
  - https://github.com/Jokerbitt/forgepilot/issues/19

## 8. Produktregel

Expert Mode darf niemals die Standardbedienung ersetzen.

Regel:

- Standard: schnell, sicher, gefuehrt.
- Expert: tief, kontrollierbar, bewusst.

Wenn eine Option fuer Einsteiger verwirrend ist, gehoert sie in Expert Mode.
Wenn eine Option fuer Sicherheit oder Kosten kritisch ist, gehoert sie trotzdem sichtbar in die Startzusammenfassung.

## 9. Fazit

Die Modell- und Provider-Auswahl im Expert Mode ist ein zentraler Baustein fuer ForgePilot.

Damit wird ForgePilot provider-neutral, local-AI-faehig und professionell steuerbar. Genau das unterscheidet es von einfachen Agenten-UIs:

> ForgePilot startet nicht einfach eine KI. ForgePilot steuert, begrenzt, begruendet und dokumentiert KI-Arbeit.
