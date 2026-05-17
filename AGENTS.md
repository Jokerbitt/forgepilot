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

### Environment File on NAS

Location: `/share/forgepilot/.env`
Local reference: `C:\Users\svenb\dev\forgepilot\.env.local`

All secrets live in this file only — never in code or git. When adding a new key, update both the NAS `.env` and the local `.env.local`.

| Variable | Status | Zweck |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ gesetzt | Claude KI — Research, Requirements |
| `LINEAR_API_KEY` | ✅ gesetzt | Linear Tickets lesen + kommentieren |
| `LINEAR_TEAM_ID` | ✅ gesetzt | Ziel-Team für neue Tickets |
| `GITHUB_TOKEN` | ✅ gesetzt | GitHub PRs + Work Items |
| `TELEGRAM_BOT_TOKEN` | ✅ gesetzt | Bot: @sven_briefing_bot |
| `TELEGRAM_CHAT_ID` | ✅ gesetzt | Chat-ID: 8938045299 (Sven Bittl) |
| `OLLAMA_BASE_URL` | ⏳ offen | Erst Mac einrichten: `tailscale ip -4` → `http://[ip]:11434` |

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
