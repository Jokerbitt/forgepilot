# CLAUDE.md — ForgePilot AI Workflow OS

## Projekt-Übersicht

ForgePilot ist ein NAS-first KI-Betriebssystem: "From Idea to Execution".
Vollständiger Loop: Idee → Wizard → Blueprint → Research (Claude) → Requirements → Freigabe → Delegation → Autopilot-Execute.

**Status:** Produktionsreif, 144 Tests grün, deployt auf http://192.168.0.136:3001

## Tech Stack

- Next.js 14 App Router, TypeScript strict (kein `any`!), Tailwind CSS dark-first
- Vitest, file-based JSON persistence (`config/*.json`)
- Docker auf QNAP NAS (192.168.0.136) — Port 3001 (App) + 5678 (n8n)

## Architektur

```
src/
├── app/
│   ├── page.tsx                    ← Command Center Dashboard
│   ├── delegations/page.tsx        ← Delegation Queue
│   ├── project-briefs/             ← Blueprint Studio
│   └── api/
│       ├── delegations/            ← CRUD + execute/retry/stats
│       ├── project-briefs/         ← CRUD + research-run + create-delegation
│       ├── autopilot/tick/         ← Autopilot Loop (polled alle 12s)
│       ├── intake/                 ← n8n Webhook (POST)
│       ├── settings/               ← NBA Config
│       ├── api-keys/               ← Connector Keys
│       └── health/                 ← Docker Healthcheck
├── components/
│   ├── command-center/             ← NBAPanel, AutopilotRunner, DailyCostWidget
│   ├── delegation/                 ← DelegationTable, Drawer, FailedWidget
│   └── project-briefs/             ← BlueprintScreen, IdeaIntakeWizard
└── lib/
    ├── connectors/                 ← Linear, GitHub, config merge
    ├── models/                     ← TypeScript Interfaces (SSOT)
    └── nba-engine/                 ← Scoring (pure functions)
```

## Persistenz

Alle Daten liegen in `config/*.json` (gitignored, Docker-Volume gemountet):
- `config/api-keys.json` — API Keys (über /settings gespeichert)
- `config/project-briefs.json` — Projekte + Research Findings
- `config/running-processes.json` — PID-Registry für laufende Agenten

## Datenmodelle (SSOT)

| Modell | Datei |
|---|---|
| Delegation, TaskContract | `src/lib/models/delegation.ts` |
| ProjectBrief, ResearchRun, Finding | `src/lib/models/project-brief.ts` |
| NBAConfig, NBARecommendation | `src/lib/nba-engine/nba-config.ts` |
| ConnectorManifest, ConnectorHealth | `src/lib/connectors/types.ts` |

## Regeln (absolut)

- Kein `any` in TypeScript
- Kein `style={{}}` — ausschließlich Tailwind
- Jede Funktion in `lib/` hat einen Test
- RiskClass C → IMMER erst User fragen
- Neue Features auf Feature-Branch, nie direkt auf main
- Max. 1 PR pro Session

## Befehle

```powershell
npm run dev           # Lokaler Dev-Server :3000
npm run type-check    # TypeScript strict
npm run lint          # ESLint
npm test -- --run     # Alle Tests einmalig

# Deploy auf NAS (Windows)
.\scripts\deploy-nas.ps1

# Deploy auf NAS (Mac/Linux)
bash scripts/deploy-nas.sh
```

## Autonomer Loop (Stufe 2)

```
Linear Ticket erstellt
  → n8n Webhook empfängt (http://192.168.0.136:5678)
  → POST http://forgepilot:3000/api/intake
  → ProjectBrief wird angelegt
  → Research Run (Claude Haiku/Sonnet)
  → Requirements generiert
  → Delegation erstellt
  → Autopilot-Tick erkennt approved Delegation
  → POST /api/delegations/[id]/execute
  → Claude CLI läuft autonom
  → PR erstellt
```

## NAS-Zugriff

- ForgePilot: http://192.168.0.136:3001
- n8n: http://192.168.0.136:5678 (admin / forgepilot)
- SSH: admin@192.168.0.136
- Docker: /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker

## SSOT auf NAS

- ForgePilot Codex: `Z:\NAS\Codex\KI Betriebssystem\`
- Setup Guide: `Z:\NAS\SecondBrain\01_Projects\forgepilot\SETUP-GUIDE.md`
- Aktives Gedächtnis: `Z:\NAS\Claude\Memory\aktiv.md`
