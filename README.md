# ForgePilot

**The open-source AI Workflow OS for developers.**

Turn ideas and Linear tickets into researched project briefs, requirements, controlled AI delegations, agent execution, pull requests, and knowledge writeback — all from a single self-hosted dashboard.

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-580%20passing-brightgreen)](./src)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](./tsconfig.json)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

---

## What is ForgePilot?

ForgePilot is a **local-first AI operating system** for developers and solopreneurs who want to use AI seriously — without losing control, context, or data.

Instead of prompting AI tools manually every time, ForgePilot gives you:

- A **structured pipeline** from idea to shipped feature
- **Controlled AI delegation** with approval flows and risk classes
- **Context engineering** that automatically assembles the right information for each AI call
- **Knowledge writeback** so your AI gets smarter with every run
- **DSGVO/GDPR-by-design** with PII scrubbing and a processing ledger (Art. 30)
- **Full observability** via Sentry + OpenTelemetry

Everything runs on your own hardware. Your API keys stay local. Your data never leaves your infrastructure.

---

## Features

### Core Pipeline
- **Idea Intake** — capture ideas from Linear, GitHub Issues, or manually
- **Project Brief Builder** — AI-powered research and requirements generation
- **Delegation Queue** — controlled AI task execution with approval flows
- **Agent Orchestration** — real Claude API calls with structured prompts and drift detection
- **Knowledge Writeback** — orchestration results become searchable knowledge cards

### AI Infrastructure
- **Universal Provider Registry** — Anthropic, OpenAI, Groq, Mistral, Ollama, LM Studio, and any OpenAI-compatible endpoint
- **Context Engineering** — 5-layer context stack (system, task, knowledge, PII-scrubbed content, constraints)
- **Eval Harness** — 3D scoring (Correctness 50%, Efficiency 25%, Drift 25%) with regression detection
- **Model Router** — automatically routes tasks to the best model (local vs. cloud)

### Operations
- **NBA Engine** — Next Best Action autopilot mode
- **Operator Readiness Cockpit** — health, connectivity, and system status
- **Connector Health** — Linear and GitHub integration status
- **DSGVO Governance Dashboard** — processing ledger, PII stats, retention cleanup

### Developer Experience
- **Zod validation** on all API routes — structured 400 errors with field-level details
- **Pino structured logging** — JSON in prod, pretty-print in dev, API key redaction
- **Error Boundaries** — global + component-level, no white screens
- **Sentry + OpenTelemetry** — full observability stack, opt-in via env vars
- **580+ Vitest tests** — unit tests for all critical paths
- **GitHub Actions CI** — lint, type-check, tests on every PR

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- An Anthropic API key (or Ollama running locally for free)

### 1. Clone and install

```bash
git clone https://github.com/Jokerbitt/forgepilot.git
cd forgepilot
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and add at minimum:

```bash
ANTHROPIC_API_KEY=sk-ant-...   # or use Ollama (free, runs locally)
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the Command Center is ready.

### Optional: Docker (NAS / self-hosted)

```bash
docker build -t forgepilot .
docker run -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v $(pwd)/config:/app/config \
  forgepilot
```

---

## Architecture

```
forgepilot/
├── src/
│   ├── app/                    # Next.js 14 App Router
│   │   ├── api/                # API routes (all Zod-validated)
│   │   ├── (pages)/            # Command Center, Delegations, Projects, ...
│   │   └── error.tsx           # Global error boundary
│   └── lib/
│       ├── ai/                 # Provider registry + text generation
│       ├── context/            # Context engineer + PII scrubber
│       ├── dsgvo/              # DSGVO processing ledger + erasure
│       ├── eval/               # Eval harness (3D scoring)
│       ├── knowledge/          # Knowledge cards + semantic search
│       ├── logger/             # Pino structured logging
│       ├── nba-engine/         # Next Best Action engine
│       ├── supabase/           # Optional Supabase client + schema
│       ├── tracing/            # OpenTelemetry tracer + AI spans
│       └── validation/         # Zod schemas + parseBody() helper
├── config/                     # File-based JSON persistence (runtime state)
├── instrumentation.ts          # Next.js OTel hook
├── sentry.client.config.ts     # Sentry browser config
├── sentry.server.config.ts     # Sentry server config
└── vercel.json                 # Vercel deployment + cron config
```

### Data Persistence

ForgePilot uses **file-based JSON persistence** by default — no database required. All data lives in `config/*.json` on your own filesystem.

Optional: connect a **Supabase** instance (`SUPABASE_URL` + `SUPABASE_ANON_KEY`) to unlock pgvector semantic search and real-time subscriptions.

---

## AI Providers

ForgePilot works with any of these out of the box:

| Provider | Type | Env var |
|---|---|---|
| Anthropic Claude | Cloud | `ANTHROPIC_API_KEY` |
| OpenAI | Cloud | `OPENAI_API_KEY` |
| Groq | Cloud (fast) | `GROQ_API_KEY` |
| Mistral | Cloud | `MISTRAL_API_KEY` |
| Google Gemini | Cloud | `GOOGLE_API_KEY` |
| Together AI | Cloud | `TOGETHER_API_KEY` |
| Ollama | Local (free) | `OLLAMA_BASE_URL` |
| LM Studio | Local (free) | any OpenAI-compatible URL |

Add any OpenAI-compatible provider via the Settings UI — no code changes needed.

---

## Contributing

ForgePilot is built in the open and contributions are very welcome.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- How to set up your development environment
- Our branching and PR workflow
- How to add a new AI provider
- How to add a new connector (Linear, GitHub, Jira, ...)
- Code style and testing expectations

**Good first issues** are labeled [`good first issue`](https://github.com/Jokerbitt/forgepilot/issues?q=label%3A%22good+first+issue%22) on GitHub.

---

## Roadmap

| Stage | Goal | Status |
|---|---|---|
| **Stable Solo Tool** | Daily-use stability, Context Package Builder UI, E2E tests | 🔄 In Progress |
| **Closed Alpha** | Auth, onboarding, Supabase multi-user isolation | 📋 Planned |
| **Public Beta** | Billing, landing page, DSGVO compliance, teams | 📋 Planned |

See [GitHub Issues](https://github.com/Jokerbitt/forgepilot/issues) for the full backlog.

---

## License

ForgePilot core is **MIT licensed** — free for personal use, commercial self-hosting, and building on top of it.

Cloud hosting, Teams, and Enterprise features require a separate commercial license.
See [LICENSE](./LICENSE) for full details.

---

## Acknowledgments

Built with [Next.js](https://nextjs.org) · [Tailwind CSS](https://tailwindcss.com) · [Anthropic Claude](https://anthropic.com) · [Supabase](https://supabase.com) · [Sentry](https://sentry.io) · [OpenTelemetry](https://opentelemetry.io) · [Pino](https://getpino.io) · [Zod](https://zod.dev)

---

<p align="center">
  <strong>Self-hosted · Local-first · GDPR-by-design</strong><br><br>
  <a href="https://github.com/Jokerbitt/forgepilot/issues/new?template=feature.md">Request a Feature</a> ·
  <a href="https://github.com/Jokerbitt/forgepilot/issues/new?template=bug.md">Report a Bug</a> ·
  <a href="./CONTRIBUTING.md">Contribute</a>
</p>
