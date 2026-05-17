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
| Product vision, roadmap, standards, agent coordination | `/Volumes/Sven/NAS/Codex/KI Betriebssystem` |
| **API Keys, credentials, service URLs** | `/Volumes/Sven/NAS/Codex/KI Betriebssystem/FORGEPILOT-SETTINGS-CREDENTIALS.md` |
| Code, branches, pull requests, CI, releases | GitHub `https://github.com/Jokerbitt/forgepilot` |
| Fast local implementation workspace | `~/dev/forgepilot` |
| NAS code mirror / shared workspace | `/Volumes/Sven/NAS/Projects/forgepilot` |
| Tasks, status, priorities, blockers | Linear |
| Long-term knowledge and learnings | `/Volumes/Sven/NAS/SecondBrain` |

Before strategic or cross-agent work, read in this order:

1. `/Volumes/Sven/NAS/Codex/KI Betriebssystem/AGENTS.md`
2. `/Volumes/Sven/NAS/Codex/KI Betriebssystem/FORGEPILOT-SSOT.md`
3. `/Volumes/Sven/NAS/Codex/KI Betriebssystem/04_Roadmap/FORGEPILOT-ROADMAP-KONSOLIDIERT-2026-05-17.md`
4. `/Volumes/Sven/NAS/Codex/KI Betriebssystem/FORGEPILOT-SETTINGS-CREDENTIALS.md`

If repo docs and NAS docs disagree, the NAS version wins for project knowledge.

## Current Workflow

- Use feature branches for implementation: `feature/...`, `fix/...`, `chore/...`.
- Do not commit directly to `main`.
- Keep GitHub as the code truth.
- Keep the NAS SSOT updated after meaningful product, architecture, connector, local-AI, n8n, or autonomy decisions.
- The NAS code mirror exists so agents can inspect and coordinate from NAS, but local development may remain on `~/dev/forgepilot` for speed.

## Settings & Credentials

All API keys and service credentials are documented centrally:

```
/Volumes/Sven/NAS/Codex/KI Betriebssystem/FORGEPILOT-SETTINGS-CREDENTIALS.md
```

**Two-level system — env vars win over UI-stored keys:**

| Level | File | Used by |
|---|---|---|
| 1 — Settings UI | `config/api-keys.json` | App connectors, research, AI routes |
| 2 — Environment | `.env.local` (local) / `.env` on NAS | docker-compose, n8n, env fallback |

Keys managed here: `ANTHROPIC_API_KEY`, `LINEAR_API_KEY`, `LINEAR_TEAM_ID`, `GITHUB_TOKEN`, `OLLAMA_BASE_URL`

Only in env (not in UI): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GITHUB_OWNER`, `GITHUB_REPOSITORIES`

Local AI (no key needed): Ollama on `localhost:11434`, LM Studio on `localhost:1234`

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

```bash
npm run test:run
npm run lint
npm run type-check
npm run build
```

Known note: do not run `npm run build` and `npm run type-check` in parallel because both touch/read `.next/types`.

## Product Guardrails

- ForgePilot is a local-first, NAS-first AI workflow operating system.
- Linear remains the task SSOT.
- GitHub remains the code/PR/CI SSOT.
- Obsidian/SecondBrain remains long-term knowledge.
- ForgePilot orchestrates idea intake, research, requirements, delegation, risk, cost, approval, agent execution, PR feedback, and knowledge writeback.
- Critical actions require human approval.
- Runner/n8n/agents need a task contract, budget/risk classification, privacy mode, and trace.
