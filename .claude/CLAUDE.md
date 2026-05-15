# CLAUDE.md — ForgePilot AI Workflow OS

## Projekt-Übersicht

ForgePilot ist ein NAS-first KI-Betriebssystem das Ideen in validierte Projektpläne verwandelt
und die Umsetzung kontrolliert an KI-Agenten delegiert.

**Tagline:** From Idea to Execution

## Tech Stack

- Next.js 14 (App Router)
- TypeScript strict (kein `any`!)
- Tailwind CSS + Dark Mode first
- Vitest (Tests)
- Docker auf QNAP NAS → http://192.168.0.136:3001

## Architektur

```
src/
├── app/
│   ├── (dashboard)/page.tsx     ← Command Center
│   ├── agents/page.tsx          ← Agent Control Plane
│   └── api/                     ← API Routes
├── components/
│   ├── command-center/
│   ├── delegation/
│   ├── agents/
│   └── shared/
├── lib/
│   ├── connectors/              ← ConnectorManifest, ConnectorHealth + Implementierungen
│   ├── models/                  ← TypeScript Interfaces (SSOT)
│   └── nba-engine/              ← Scoring (pure functions, testbar)
└── types/index.ts               ← Re-exports aller zentralen Types
```

## Datenmodelle (SSOT — nie umgehen!)

Alle Interfaces sind in `src/lib/models/` definiert. Re-exports via `src/types/index.ts`.

| Modell | Datei |
|---|---|
| WorkItem | `src/lib/models/work-item.ts` |
| TaskContract, Delegation | `src/lib/models/delegation.ts` |
| AgentRun, TraceEvent | `src/lib/models/agent-run.ts` |
| ApprovalRequest | `src/lib/models/approval.ts` |
| CostEntry, CostSummary | `src/lib/models/cost.ts` |
| NBARecommendation, NBAScore | `src/lib/models/nba.ts` |
| ConnectorManifest, ConnectorHealth | `src/lib/connectors/types.ts` |

## Absolute Verbote

- Kein `any` in TypeScript
- Kein `style={{}}` — ausschließlich Tailwind
- Kein direktes API-Hardcoding (immer Connector-Abstraktionsschicht)
- Kein UI ohne verdrahteten Logger dahinter (Logger-first!)
- Kein Runner-Start ohne TaskContract
- Keine Inline-Logik in API-Routes (Logik gehört in `lib/`)

## Pflichten

- Neue Connector-Implementierung → `ConnectorManifest` in `src/lib/connectors/types.ts` zuerst
- Neue NBA-Regel → zuerst als Test formulieren (Test-first)
- RiskClass C → IMMER erst den User fragen
- Jede Funktion in `lib/` hat einen Test in `*.test.ts`

## Single Source of Truth

- ForgePilot SSOT: `Z:\NAS\Codex\KI Betriebssystem`
- Projektregeln: `Z:\NAS\Codex\KI Betriebssystem\AGENTS.md`
- Zusammenarbeit Claude Code/Codex: `Z:\NAS\Codex\KI Betriebssystem\CLAUDE-CODE-CODEX-ZUSAMMENARBEIT-LEITFADEN.md`
- Second Brain / Obsidian: `Z:\NAS\SecondBrain`

Vor strategischen Entscheidungen oder groesseren Tasks erst den NAS-SSOT lesen.

## Aktueller Sprint

M0: Foundation — läuft
- Branch: feature/M0-foundation
- Status: TypeScript-Modelle ✅, Tests ✅, Next.js Setup ✅

## Wichtige Befehle

```powershell
# Entwicklung
npm run dev           # Lokaler Dev-Server
npm run test:run      # Tests (alle einmalig)
npm run type-check    # TypeScript strict
npm run lint          # ESLint
npm run build         # Production Build

# NAS Deploy
.\scripts\deploy-prod.ps1

# Git-Workflow
git checkout -b feature/JOK-XX-was-gebaut-wird
git add src/...
git commit -m "feat: was wurde gebaut"
git push -u origin feature/JOK-XX-was-gebaut-wird
```

## Risiko-Klassen

| Klasse | Beschreibung | Vorgehen |
|---|---|---|
| A | Neue Dateien, additive Änderungen, reine Types | Direkt ausführen |
| B | Bestehende Dateien ändern, API-Integration | Kurz ankündigen |
| C | Löschen, Architektur-Änderung, externe Services, Runner | IMMER erst fragen |

## Wissen on-demand

- Codex/SSOT: `Z:\NAS\Codex\KI Betriebssystem\`
- AGENTS.md: `Z:\NAS\Codex\KI Betriebssystem\AGENTS.md`
- ADRs: `Z:\NAS\Codex\KI Betriebssystem\03_ADRs\`
- GUI-Standard: `Z:\NAS\Codex\KI Betriebssystem\02_Standards\GUI-UX-Standard.md`
