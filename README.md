# ForgePilot — AI Workflow Orchestrator

> Idea → Delegation → Reviewed Code.
> The local AI workflow tool that coordinates agents and keeps you in control.

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-1606%20passing-brightgreen)](./src)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](./tsconfig.json)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)

---

ForgePilot turns vague ideas into structured delegations, lets AI agents (local or cloud) do the work, critically reviews the results, and writes useful knowledge back to your project.

For solo developers and small teams who want to use AI productively — without chaos, without lost context, and without vendor lock-in.

---

## Why ForgePilot

Most AI workflows break down in the same way: agents run without clear scope, results are never reviewed, and nothing learned persists. ForgePilot fixes that with four guarantees:

- **Clear scope** — every delegation has explicit acceptance criteria, file boundaries, and a risk class
- **Independent review** — Grok acts as a critic and scores every output (correctness, security, drift)
- **Local-first** — works on your machine or NAS, no cloud dependency required
- **Knowledge writeback** — approved results are written back automatically and stay findable

---

## The Core Workflow (MVP)

```
Your idea
    ↓
Structured Brief  (problem, goal, constraints, risks)
    ↓
Delegation Contract  (scope, acceptance criteria, model, budget)
    ↓
Agent Execution  (local or cloud, with live logs)
    ↓
Grok Critic Review  (correctness · security · drift score)
    ↓
Knowledge Writeback  →  GitHub PR
```

---

## Quick Start

```bash
git clone https://github.com/Jokerbitt/forgepilot
cd forgepilot
cp .env.example .env.local
# Edit .env.local: set FORGEPILOT_ADMIN_PASSWORD + at least one AI provider key
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be guided through setup on first visit.

---

## AI Providers

ForgePilot works with any combination of local and cloud models. Local runs first; cloud is used for escalation and critic review.

| Provider | Type | Env var |
|---|---|---|
| Anthropic Claude | Cloud | `ANTHROPIC_API_KEY` |
| xAI Grok | Cloud — critic layer | `XAI_API_KEY` |
| Google Gemini | Cloud (free tier) | `GOOGLE_API_KEY` |
| Groq | Cloud (fast + free) | `GROQ_API_KEY` |
| OpenAI | Cloud | `OPENAI_API_KEY` |
| Together AI | Cloud | `TOGETHER_API_KEY` |
| Mistral | Cloud | `MISTRAL_API_KEY` |
| OpenRouter | Cloud aggregator | `OPENROUTER_API_KEY` |
| Ollama | **Local** (free) | `OLLAMA_BASE_URL` |
| LM Studio | **Local** (free) | any OpenAI-compatible URL |

Add any OpenAI-compatible provider via Settings → Providers — no code changes needed.

---

## Features (V1)

**Core workflow**
- Idea intake → structured project brief
- Brief → delegation with contract (scope, risk class, token budget, preferred model)
- Model router: local first, cloud escalation above confidence threshold
- Agent execution with live log stream
- Grok-Critic independent review — correctness, security, drift score
- Knowledge writeback for approved results
- GitHub PR creation from successful delegation

**Infrastructure**
- Multi-provider with hot-swap (no restart needed)
- PostgreSQL persistence (Drizzle ORM) with local Docker or any hosted Postgres
- Mandatory auth — secure by default, even on localhost; only `FORGEPILOT_AUTH_DISABLED=true` bypasses it for isolated local development
- Command Center with next-best-action focus
- Basic project and delegation overview
- JSON export / import

**Not in V1** — PM-Agent, Agent Control Plane, advanced context packages, billing, multi-tenancy, DSGVO ledger UI, Telegram notifications. These come after the core workflow is proven reliable.

---

## Deployment

**Local development**
```bash
npm run dev
```

**Docker with Postgres**
```bash
docker-compose up -d
npx drizzle-kit push
npx tsx scripts/backfill-json-to-postgres.ts  # one-time migration if needed
```

**Any hosted Postgres** (Supabase, Neon, Railway, Fly.io)
```bash
DATABASE_URL=postgresql://... npx drizzle-kit push
```

---

## Stack

- **Next.js 15** App Router, TypeScript strict
- **Tailwind CSS** dark theme
- **Drizzle ORM** + postgres-js — schema-first, no magic
- **Vitest** — 1606 tests
- **NextAuth v4** credentials provider

---

## Architecture

```
src/
├── app/
│   ├── api/              # REST routes (Zod-validated)
│   └── (pages)/          # Command Center, Delegations, Project Briefs, ...
├── db/
│   ├── schema.ts         # Drizzle schema — users, projects, delegations, work_items, ...
│   └── index.ts          # postgres-js connection singleton
└── lib/
    ├── ai/               # Provider registry + model router + text generation
    ├── eval/             # Grok critic + 3D scoring (correctness · efficiency · drift)
    ├── repositories/     # Postgres-only repositories (no JSON fallback)
    ├── context/          # PII scrubber
    ├── knowledge/        # Knowledge card store + writeback
    └── validation/       # Zod schemas + parseBody() helper
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, branching, and how to add providers or connectors.

Issues labeled [`good first issue`](https://github.com/Jokerbitt/forgepilot/issues?q=label%3A%22good+first+issue%22) are a good starting point.

---

## License

MIT. See [LICENSE](LICENSE).

---

<p align="center">
  <strong>Local-first · Self-hosted · Controlled AI</strong><br><br>
  <a href="https://github.com/Jokerbitt/forgepilot/issues/new">Report an issue</a> ·
  <a href="./CONTRIBUTING.md">Contribute</a>
</p>
