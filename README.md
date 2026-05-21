# ForgePilot

> **Idea -> Delegation -> Reviewed Code.**
>
> The local AI workflow tool that coordinates agents and keeps their output under serious review.

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-1560%2B-brightgreen)](./src)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](./tsconfig.json)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)

ForgePilot turns vague ideas into structured delegations, lets local or cloud AI agents work inside a clear scope, reviews the result with an independent critic layer, and writes useful project knowledge back.

It is built for solo developers, technical founders and small teams that already use tools like Claude, Cursor, Ollama or LM Studio, but want less chaos, less lost context and fewer blind AI changes.

ForgePilot is **not** another all-in-one AI agent swarm. It is a focused AI workflow orchestrator with strong review and control primitives.

---

## MVP Workflow

### 1. Idea -> Brief

Plain-text idea to structured project brief:

- problem
- goal
- constraints
- risks
- useful next steps

### 2. Brief -> Delegation

Create precise work orders with:

- goal and acceptance criteria
- allowed file scope
- risk class
- token/budget limit
- preferred model, local-first by default

### 3. Delegation -> Execution

Run scoped AI work with:

- model routing
- local-first execution where appropriate
- cloud escalation for hard tasks
- live logs
- human approval for risky actions

### 4. Grok-Critic Review

Independently evaluate agent output:

- correctness
- security
- drift from scope
- concrete improvement suggestions
- pass/fail verdict

### 5. Knowledge Writeback

Approved results are written back into project knowledge so useful context does not disappear after a chat session.

### 6. GitHub PR

Successful delegations can produce a pull request with review context and implementation notes.

---

## What Makes ForgePilot Different

- **Local-first model routing**: use Ollama/LM Studio where possible, cloud models where needed.
- **Scope and approval control**: agents get contracts, not vague prompts.
- **Independent critic layer**: do not blindly trust the builder model.
- **No vendor lock-in**: works with common local and cloud providers.
- **Self-hosted by design**: runs on your machine, NAS or server.

---

## What Is Intentionally Not V1

The current product focus is narrow on purpose. These areas are later-phase work:

- full PM agent
- full agent swarm/control-plane product
- advanced context packages
- complex work-item dependency management
- billing and pricing screens
- SaaS readiness dashboard
- Telegram notifications
- detailed DSGVO ledger beyond practical PII controls
- multi-tenancy and team workspaces
- advanced governance/policy engine

---

## Quick Start

```bash
git clone https://github.com/Jokerbitt/forgepilot
cd forgepilot
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

ForgePilot handles prompts, code context and provider credentials. Auth is enabled by default.

For shared deployments, set:

```bash
NEXTAUTH_SECRET=
FORGEPILOT_ADMIN_EMAIL=
FORGEPILOT_ADMIN_PASSWORD=
```

For an isolated local machine only, auth can be disabled explicitly:

```bash
FORGEPILOT_AUTH_DISABLED=true
```

---

## Providers

| Provider | Type | Env var |
|----------|------|---------|
| Anthropic Claude | Cloud | `ANTHROPIC_API_KEY` |
| OpenAI | Cloud | `OPENAI_API_KEY` |
| Google Gemini | Cloud/free tier | `GOOGLE_API_KEY` |
| Groq | Cloud/fast free tier | `GROQ_API_KEY` |
| xAI Grok | Cloud critic | `XAI_API_KEY` |
| OpenRouter | Cloud aggregator | `OPENROUTER_API_KEY` |
| Ollama | Local | `OLLAMA_BASE_URL` |
| LM Studio | Local | OpenAI-compatible local URL |

Configure providers in `/settings/providers`.

---

## Persistence

ForgePilot currently supports local JSON runtime state under `config/*.json` for single-user and self-hosted setups.

That is **Phase 0 persistence**, not the final SaaS architecture. PostgreSQL/Drizzle migration work is in progress to support safer concurrency, stronger queries and future tenant isolation.

---

## Development

```bash
npm run dev
npm run test:run
npm run lint
npm run type-check
npm run build
```

For agent work, claim a scope before editing shared files:

```bash
npm run agent -- status
npm run agent -- claim --agent your-agent-id --milestone M### --files "src/lib/example/**"
npm run agent -- release --agent your-agent-id
```

---

## Repository Map

```text
src/app/                  Next.js 15 pages and API routes
src/components/           UI components and product surfaces
src/lib/                  business logic, agents, routing, analytics, stores
src/lib/ai/               provider routing and local/cloud model helpers
src/lib/delegations/      queue, execution, costs, retries, health
src/lib/eval/             evaluation harness and Grok critic
src/lib/knowledge/        knowledge cards and writeback helpers
config/*.json             phase-0 local runtime state
docs/                     product, setup and review notes
scripts/                  validation and coordination scripts
```

---

## Product Direction

See [Product Positioning V1](./docs/PRODUCT_POSITIONING_V1.md).

## License

MIT for personal and open-source use. See [LICENSE](./LICENSE).
