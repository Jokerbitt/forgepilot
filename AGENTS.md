# AGENTS.md - ForgePilot AI Workflow Orchestrator

## Identity

- Product: ForgePilot — AI Workflow Orchestrator
- Tagline: Idea → Delegation → Reviewed Code
- Owner: Sven Bittl / GitHub `Jokerbitt`
- Communication with Sven: German
- Code, identifiers, comments: English

## Source Of Truth

Use these systems in this order:

| Topic | Source |
|---|---|
| Product vision, roadmap, standards, agent coordination | `/Volumes/Sven/NAS/Codex/KI Betriebssystem` |
| Code, branches, pull requests, CI, releases | GitHub `https://github.com/Jokerbitt/forgepilot` |
| Fast local implementation workspace | `~/dev/forgepilot` |
| NAS code mirror / shared workspace | `/Volumes/Sven/NAS/Projects/forgepilot` |
| Tasks, status, priorities, blockers | Linear |
| Long-term knowledge and learnings | `/Volumes/Sven/NAS/SecondBrain` |

Before strategic or cross-agent work, read in this order:

1. `/Volumes/Sven/NAS/Codex/KI Betriebssystem/00_START_HERE_AGENT_BRIEFING.md`
2. `/Volumes/Sven/NAS/Codex/KI Betriebssystem/00a_CURRENT_BASELINE.md` — what's already built + write scope
3. `/Volumes/Sven/NAS/Codex/KI Betriebssystem/02_ROADMAP_MEILENSTEINE_ARBEITSPAKETE.md`
4. Task-specific: `03_ARCHITEKTUR_BLUEPRINT.md`, `04_REQUIREMENTS_BACKLOG.md`, `05_DATENMODELLE.md`, etc.

If repo docs and NAS docs disagree, the NAS version wins for project knowledge.

## Current Workflow

- Use feature branches for implementation: `feature/...`, `fix/...`, `chore/...`.
- Do not commit directly to `main`.
- Keep GitHub as the code truth.
- Keep the NAS SSOT updated after meaningful product, architecture, connector, local-AI, n8n, or autonomy decisions.
- The NAS code mirror exists so agents can inspect and coordinate from NAS, but local development may remain on `C:\Users\svenb\dev\forgepilot` for speed.

## Multi-Agent Coordination (mandatory before edits)

Two agents on the same branch silently overwrote each other's commits in May
2026. To prevent recurrence, every long-running agent **must** claim scope
before editing files and renew the lease while working.

State lives in `<git-common-dir>/forgepilot-agent-scope.json` (typically `.git/forgepilot-agent-scope.json` of the main checkout). This path is shared across **all linked worktrees of the same repo**, so an agent in worktree A sees the claims of an agent in worktree B. Falls back to `<cwd>/config/agent-scope.json` when not inside a git checkout. Use the CLI — no HTTP server needed:

```bash
# 1. Check whether the current branch + intended files are clear
npm run agent:preflight -- --files "src/lib/agents/**,scripts/**"

# 2. Claim the scope (writes the lock)
npm run agent -- claim --agent claude-code-$(date +%s) \
                       --type claude-code \
                       --milestone M130-multi-agent \
                       --files "src/lib/agents/**,scripts/**"

# 3. Renew every ~10 minutes while you're still working
npm run agent -- heartbeat --agent <your-id>

# 4. Release when done (also happens automatically when TTL expires)
npm run agent -- release --agent <your-id>

# Anytime: who is working on what?
npm run agent:status
```

Three layers of protection:

1. **File-pattern overlap** — claiming `src/lib/agents/**` blocks any other agent from claiming files under that directory.
2. **Branch isolation** — two agents on the same git branch are rejected by default. Both sides must explicitly pass `--share-branch` to opt in.
3. **Heartbeat + PID liveness** — claims expire when the TTL lapses or the recorded OS process dies; no manual cleanup of crashed agents.

If preflight says the branch is busy, split off a sibling branch:

```bash
git switch -c "$(git branch --show-current)__$(date +%s)"
```

REST surface for programmatic agents:

```
GET    /api/agents/scope                — list live claims
POST   /api/agents/scope                — claim
DELETE /api/agents/scope?agentId=…      — release
POST   /api/agents/scope/heartbeat      — renew lease
POST   /api/agents/scope/preflight      — read-only conflict check
```

### Pre-commit Hard Gate (recommended for autonomous agents)

To stop an agent from accidentally committing files outside its claim, wire
the scope check into git's `pre-commit` hook. It is opt-in — only enforced
when the `AGENT_ID` env var is set, so Sven's interactive commits are never
blocked:

```bash
# one-time wire-up in this checkout
ln -sf ../../scripts/pre-commit-scope-check.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# from then on, agents export AGENT_ID before they start work:
export AGENT_ID=claude-code-$(date +%s)
npm run agent -- claim --agent "$AGENT_ID" --type claude-code \
                       --milestone M130 --files "src/lib/agents/**"
# … any commit now runs `npm run agent:check -- --agent "$AGENT_ID"` first
```

Manual run (e.g. from CI):

```bash
AGENT_ID=my-agent bash scripts/pre-commit-scope-check.sh
```

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

## Product Guardrails

**What ForgePilot is (V1):**
ForgePilot is a focused local AI workflow orchestrator. The single core loop is:
Idea → structured Brief → Delegation Contract → Agent Execution → Grok Critic Review → Knowledge Writeback → GitHub PR

**What it is not (do not build or extend):**
- PM-Agent (autonomous project management)
- Agent Control Plane / Scope Board / Skills Matrix
- Billing or SaaS readiness features
- Multi-tenancy (phase 2+)
- Telegram notification channels
- Complex DSGVO ledger UI
- Context Packages as a standalone feature

**Rules:**
- Local-first: PostgreSQL via Docker or any hosted Postgres, no cloud dependency required
- Linear remains task SSOT
- GitHub remains code/PR/CI SSOT
- Every delegation needs: scope, acceptance criteria, risk class, model preference
- Grok (xAI) acts as the independent critic — never skip the review layer
- Auth is mandatory — `FORGEPILOT_AUTH_ENABLED=false` is the only escape hatch
- Critical actions (Risk Class C) always require explicit human approval
- Do not add features outside the core loop without explicit approval from Sven
