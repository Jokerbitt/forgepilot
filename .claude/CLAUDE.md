# CLAUDE.md - ForgePilot AI Workflow OS

## Project

ForgePilot is Sven's local-first, NAS-first AI Workflow OS.

Goal: turn ideas and Linear tickets into researched project briefs, requirements, controlled delegations, agent execution, pull requests, and knowledge writeback.

## Required Context

Before meaningful work, read the repo root `AGENTS.md` and the NAS SSOT:

1. `Z:\NAS\Codex\KI Betriebssystem\AGENTS.md`
2. `Z:\NAS\Codex\KI Betriebssystem\FORGEPILOT-SSOT.md`
3. `Z:\NAS\Codex\KI Betriebssystem\README.md`
4. `Z:\NAS\Codex\KI Betriebssystem\CLAUDE-CODE-CODEX-ZUSAMMENARBEIT-LEITFADEN.md`

Do not rely on chat memory as the source of truth.

## Workspaces

| Purpose | Path |
|---|---|
| Fast local development | `C:\Users\svenb\dev\forgepilot` |
| NAS code mirror / shared workspace | `Z:\NAS\Projects\forgepilot` |
| ForgePilot project memory | `Z:\NAS\Codex\KI Betriebssystem` |
| GitHub code truth | `https://github.com/Jokerbitt/forgepilot` |

The NAS mirror can be used for shared inspection and coordination. Local development is still acceptable for speed, as long as GitHub and the NAS SSOT are updated.

## Stack

- Next.js 14 App Router
- TypeScript strict
- Tailwind CSS
- Vitest
- File-based JSON persistence under `config/*.json`
- Docker deployment on QNAP NAS
- n8n automation
- Optional local AI via Ollama

## Important Routes

- `/` - Command Center
- `/project-briefs` - project briefs / blueprint flow
- `/delegations` - delegation queue
- `/settings` - API keys, AI provider, NBA/autopilot config
- `/api/intake` - n8n Linear intake target
- `/api/project-briefs/[id]/research-run` - AI research run
- `/api/project-briefs/[id]/generate-requirements` - requirements generation
- `/api/delegations/[id]/approve` - automation-compatible approval
- `/api/delegations/[id]/start` - alias for execution start
- `/api/delegations/[id]/execute` - execution route

## Rules

- Communicate with Sven in German.
- Code, identifiers, and comments in English.
- No `any` types.
- Use feature branches; do not commit directly to `main`.
- Add or update tests for behavior changes.
- Do not commit secrets.
- Treat `config/*.json` as runtime state unless the task is explicitly about fixtures/defaults.
- RiskClass C always needs human approval.
- Keep meaningful decisions and handoffs in the NAS SSOT.

## Verification

Use these before PR-ready work:

```powershell
npm run test:run
npm run lint
npm run type-check
npm run build
```

Do not run `npm run build` and `npm run type-check` in parallel because `.next/types` can race.

## Infrastructure & Credentials

### Deployed Services (NAS — QNAP 192.168.0.136 / Tailscale 100.94.55.15)

| Service | URL | Status |
|---|---|---|
| ForgePilot | http://100.94.55.15:3002 | ✅ live |
| n8n | http://100.94.55.15:5678 | ✅ live |
| Ollama (Mac) | http://[mac-tailscale-ip]:11434 | ⏳ Mac-Setup ausstehend |

### API Keys — Two separate locations

**1. ForgePilot Settings UI** → stored in `config/api-keys.json`
Used by: ForgePilot app (connectors, research, requirements, Linear ticket creation)
Enter at: **http://100.94.55.15:3002/settings**

| Key | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude AI — research + requirements |
| `LINEAR_API_KEY` | Read + comment Linear tickets |
| `LINEAR_TEAM_ID` | Target team for new tickets |
| `GITHUB_TOKEN` | GitHub PRs + work items |
| `OLLAMA_BASE_URL` | Local AI (Ollama on Mac, optional) |

**2. Environment files** → used by n8n workflows + Docker
- NAS (live): `/share/forgepilot/.env`
- Local: `C:\Users\svenb\dev\forgepilot\.env.local`
- **Never commit to git.** Both files are gitignored.

| Variable | Status | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ set | Also env fallback for app |
| `LINEAR_API_KEY` | ✅ set | n8n: comment on Linear tickets |
| `LINEAR_TEAM_ID` | ✅ set | n8n: target team |
| `GITHUB_TOKEN` | ✅ set | n8n: GitHub PRs |
| `TELEGRAM_BOT_TOKEN` | ✅ set | Bot: @sven_briefing_bot |
| `TELEGRAM_CHAT_ID` | ✅ set | 8938045299 (Sven Bittl) |
| `OLLAMA_BASE_URL` | ⏳ open | Mac setup needed: `tailscale ip -4` → `http://[ip]:11434` |

ForgePilot reads keys in order: Settings UI (`config/api-keys.json`) → env fallback.

### n8n Workflows

| Workflow | Status | Purpose |
|---|---|---|
| Linear → ForgePilot Intake v3 | ⏳ activate in UI | Linear ticket → Brief → Research → comment |
| ForgePilot Autopilot v2 | ⏳ deactivated | Class A/B auto-approve + start |
| Telegram Delegation Alerts | ⏳ needs TELEGRAM_CHAT_ID | Pending delegations to phone |

### Linear Webhook (one-time setup)

linear.app → Settings → API → Webhooks → New webhook:
- URL: `http://100.94.55.15:5678/webhook/linear-intake`
- Event: Issues → Create

## Current Baseline

As of 2026-05-17:

- GitHub `main` includes the n8n workflows, Ollama provider bridge, approve/start delegation endpoints, and Mac setup guide.
- Full local verification passed recently with 149 Vitest tests, lint, type-check, and production build.
- NAS SSOT contains the latest autonomy/local-AI milestone notes.
