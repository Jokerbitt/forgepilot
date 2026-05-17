# AGENTS.md - ForgePilot AI Workflow OS

## Identity

- Product: ForgePilot AI Workflow OS
- Claim: From Idea to Execution
- Owner: Sven Bittl / GitHub `Jokerbitt`
- Communication with Sven: German
- Code, identifiers, comments: English

## Source Of Truth

Use these systems in this order:

| Topic | Source |
|---|---|
| Product vision, roadmap, standards, agent coordination | `Z:\NAS\Codex\KI Betriebssystem` |
| Code, branches, pull requests, CI, releases | GitHub `https://github.com/Jokerbitt/forgepilot` |
| Fast local implementation workspace | `C:\Users\svenb\dev\forgepilot` |
| NAS code mirror / shared workspace | `Z:\NAS\Projects\forgepilot` |
| Tasks, status, priorities, blockers | Linear |
| Long-term knowledge and learnings | `Z:\NAS\SecondBrain` |

Before strategic or cross-agent work, read:

1. `Z:\NAS\Codex\KI Betriebssystem\AGENTS.md`
2. `Z:\NAS\Codex\KI Betriebssystem\FORGEPILOT-SSOT.md`
3. `Z:\NAS\Codex\KI Betriebssystem\README.md`
4. `Z:\NAS\Codex\KI Betriebssystem\CLAUDE-CODE-CODEX-ZUSAMMENARBEIT-LEITFADEN.md`

If repo docs and NAS docs disagree, the NAS version wins for project knowledge.

## Current Workflow

- Use feature branches for implementation: `feature/...`, `fix/...`, `chore/...`.
- Do not commit directly to `main`.
- Keep GitHub as the code truth.
- Keep the NAS SSOT updated after meaningful product, architecture, connector, local-AI, n8n, or autonomy decisions.
- The NAS code mirror exists so agents can inspect and coordinate from NAS, but local development may remain on `C:\Users\svenb\dev\forgepilot` for speed.

## Engineering Rules

- TypeScript strict, no `any`.
- Tests for changed behavior, especially `lib/*` and API routes.
- Prefer existing patterns over new abstractions.
- Do not commit secrets or local runtime data.
- Avoid direct edits to generated artifacts.
- Never delete files, repos, branches, or data without explicit approval.
- Do not push publicly unless Sven has allowed it for the task. As of 2026-05-17, GitHub work is allowed again, but still use PRs for changes.

## Verification

Run the relevant subset first, then full checks before PR-ready work:

```powershell
npm run test:run
npm run lint
npm run type-check
npm run build
```

Known note: do not run `npm run build` and `npm run type-check` in parallel because both touch/read `.next/types`.

## Infrastructure & Credentials

### Deployed Services (NAS — QNAP 192.168.0.136 / Tailscale 100.94.55.15)

| Service | URL | Status |
|---|---|---|
| ForgePilot | http://100.94.55.15:3002 | ✅ live |
| n8n | http://100.94.55.15:5678 | ✅ live |
| Ollama (Mac) | http://[mac-tailscale-ip]:11434 | ⏳ Mac-Setup ausstehend |

### API Keys — Wo liegen sie?

Es gibt **zwei unabhängige Stellen** — beide müssen befüllt sein:

#### 1. ForgePilot Settings UI → `config/api-keys.json`

Genutzt von: ForgePilot-App (Connectors, Research, Requirements, Linear-Ticket-Erstellung)

Öffnen: **http://100.94.55.15:3002/settings** → Abschnitt "API Keys"

Dort werden folgende Keys eingetragen (Eingabe im Browser, Speicherung in `config/api-keys.json` auf dem NAS):

| Key | Zweck |
|---|---|
| `ANTHROPIC_API_KEY` | Claude KI — Research + Requirements |
| `LINEAR_API_KEY` | Linear Tickets lesen + kommentieren |
| `LINEAR_TEAM_ID` | Ziel-Team für neue Tickets |
| `GITHUB_TOKEN` | GitHub PRs + Work Items |
| `OLLAMA_BASE_URL` | Lokale KI (Ollama auf Mac, optional) |

#### 2. Umgebungsvariablen → `.env` auf NAS / `.env.local` lokal

Genutzt von: n8n-Workflows (Telegram-Benachrichtigungen, Linear-Webhook-Verarbeitung), Docker Compose

Dateien:
- NAS (live): `/share/forgepilot/.env`
- Lokal (Entwicklung): `C:\Users\svenb\dev\forgepilot\.env.local`

**Niemals in Git einchecken.** Beide Dateien sind gitignored.

| Variable | Status | Zweck |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ gesetzt | Claude KI (auch als env-Fallback für App) |
| `LINEAR_API_KEY` | ✅ gesetzt | n8n: Linear Ticket kommentieren |
| `LINEAR_TEAM_ID` | ✅ gesetzt | n8n: Ziel-Team |
| `GITHUB_TOKEN` | ✅ gesetzt | n8n: GitHub PRs |
| `TELEGRAM_BOT_TOKEN` | ✅ gesetzt | Bot: @sven_briefing_bot |
| `TELEGRAM_CHAT_ID` | ✅ gesetzt | Chat-ID: 8938045299 (Sven Bittl) |
| `OLLAMA_BASE_URL` | ⏳ offen | Mac-Setup nötig: `tailscale ip -4` → `http://[ip]:11434` |

#### Priorität bei doppelter Konfiguration

ForgePilot liest Keys in dieser Reihenfolge:
1. `config/api-keys.json` (Settings UI) — hat Vorrang
2. Umgebungsvariablen (`.env`) — Fallback wenn Settings leer

→ Am einfachsten: Settings UI befüllen. Die `.env` auf dem NAS wird dann nur noch von n8n gebraucht.

### n8n Workflows

| Workflow | Status | Zweck |
|---|---|---|
| Linear → ForgePilot Intake v3 | ⏳ aktivieren | Linear Ticket → Brief → Research → Kommentar |
| ForgePilot Autopilot v2 | ⏳ deaktiviert | Class A/B auto-approve + start |
| Telegram Delegation Alerts | ⏳ wartet auf TELEGRAM_CHAT_ID | Pending Delegationen aufs Handy |

### Linear Webhook (noch einzurichten)

linear.app → Settings → API → Webhooks → New webhook:
- URL: `http://100.94.55.15:5678/webhook/linear-intake`
- Event: Issues → Create

## Product Guardrails

- ForgePilot is a local-first, NAS-first AI workflow operating system.
- Linear remains the task SSOT.
- GitHub remains the code/PR/CI SSOT.
- Obsidian/SecondBrain remains long-term knowledge.
- ForgePilot orchestrates idea intake, research, requirements, delegation, risk, cost, approval, agent execution, PR feedback, and knowledge writeback.
- Critical actions require human approval.
- Runner/n8n/agents need a task contract, budget/risk classification, privacy mode, and trace.
