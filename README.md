# ForgePilot

ForgePilot is a local-first AI Workflow OS for turning product ideas into scoped work, controlled AI delegations, pull requests, and reusable project knowledge.

It is built for developers and technical founders who want AI agents to work like a coordinated team instead of isolated chat sessions.

## Features

- **Idea to Brief to Requirements to Delegation to PR** — a structured path from rough idea to merge-ready work.
- **Agent coordination** — scope claims, skills, active runs, approvals and review surfaces.
- **Multi-provider AI** — Claude, Grok, Gemini, GPT, Groq, Mistral, OpenRouter, Ollama, LM Studio and OpenAI-compatible endpoints.
- **Grok critic** — independent AI evaluation for delegations and code review.
- **Local-first** — JSON file persistence, local model routing and self-hosted operation.
- **Knowledge writeback** — execution results feed back into project context.
- **GDPR-by-design** — PII scrubbing, DSGVO processing ledger, export and erasure support.
- **Self-hosted** — run locally, on NAS/Docker, Vercel or another Node-compatible host.
- **Large test surface** — Vitest and Playwright coverage for core workflows.

## What ForgePilot Does

1. Capture an idea and turn it into a structured project brief.
2. Generate requirements, risks, milestones and work packages.
3. Create delegation contracts with clear acceptance criteria and file scope.
4. Route work to local or cloud AI providers based on complexity.
5. Track agent execution, approvals, costs, logs and PR status.
6. Write useful knowledge back into the project context.

## Why It Exists

Most AI coding workflows break down when multiple agents, tools and branches are involved. ForgePilot focuses on the missing operating layer:

- What should be worked on next?
- Which agent is allowed to touch which files?
- When should local AI be enough?
- When is cloud AI worth the cost?
- What changed, who changed it, and is it ready to merge?
- What did the project learn that should not be lost?

## Current Product Surface

- Command Center for next-best actions and system readiness
- Project Briefs for idea-to-requirements workflows
- Work Items and Projects for planning
- Delegations for agent execution contracts
- Agent Control Plane for scopes, skills and active runs
- Model Router for local-first/provider-aware routing
- Cost Analytics and provider health monitoring
- DSGVO/GDPR export and erasure endpoints
- GitHub PR and Linear-oriented development flow

## Tech Stack

- Next.js 15 App Router
- React 18
- TypeScript strict
- Tailwind CSS
- Vitest and Playwright
- File-based JSON runtime state under `config/*.json`
- Optional local AI via Ollama or LM Studio
- Optional cloud AI via Claude, OpenAI, Gemini, Groq, xAI Grok, OpenRouter and compatible providers
- Sentry, OpenTelemetry and Pino for production observability

## Quick Start

```bash
git clone https://github.com/Jokerbitt/forgepilot
cd forgepilot
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional provider setup happens in `/settings/providers`.

## Local-First AI

ForgePilot is designed to use local models first where they are good enough:

- summarization
- classification
- simple planning
- low-risk review
- local/private context work

Use cloud models for:

- complex architecture
- high-risk code changes
- deep debugging
- important product decisions
- final review before merge

Recommended local providers:

- Ollama: `OLLAMA_BASE_URL=http://localhost:11434`
- LM Studio: OpenAI-compatible local server URL

## Provider Environment Variables

| Provider | Type | Env var |
|----------|------|---------|
| Anthropic Claude | Cloud | `ANTHROPIC_API_KEY` |
| OpenAI | Cloud | `OPENAI_API_KEY` |
| Google Gemini | Cloud/free tier | `GOOGLE_API_KEY` |
| Groq | Cloud/fast free tier | `GROQ_API_KEY` |
| Together AI | Cloud | `TOGETHER_API_KEY` |
| Mistral | Cloud | `MISTRAL_API_KEY` |
| OpenRouter | Cloud aggregator | `OPENROUTER_API_KEY` |
| xAI Grok | Cloud critic | `XAI_API_KEY` |
| Ollama | Local | `OLLAMA_BASE_URL` |
| LM Studio | Local | OpenAI-compatible URL |

## Production-Oriented Environment Variables

```bash
FORGEPILOT_AUTH_ENABLED=true
NEXTAUTH_SECRET=
FORGEPILOT_ADMIN_EMAIL=
FORGEPILOT_ADMIN_PASSWORD=
SENTRY_DSN=
CRON_SECRET=
SUPABASE_URL=
SUPABASE_ANON_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

## Development Commands

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

## Repository Map

```text
src/app/                  Next.js pages and API routes
src/components/           UI components and product surfaces
src/lib/                  business logic, agents, routing, analytics, stores
src/lib/agents/           agent control, scope locks, profiles, quality tracking
src/lib/ai/               provider routing and local/cloud model helpers
src/lib/delegations/      queue, execution, costs, retries, health
src/lib/dsgvo/            GDPR/DSGVO processing ledger, export, erasure
src/lib/eval/             evaluation harness and Grok critic
config/*.json             local runtime state
docs/                     launch, setup, review and product notes
scripts/                  seed, validation and coordination scripts
```

## Grok Integration

Grok acts as an independent critic/evaluator. It scores delegations, reviews code and provides a second opinion alongside Claude/Codex. See [Grok Setup](./docs/GROK_SETUP.md) and [Grok Critic Briefing](./docs/GROK_BRIEFING.md).

## Launch Prep

See:

- [Launch Prep](./docs/LAUNCH_PREP.md)
- [Demo Video Script](./docs/DEMO_VIDEO_SCRIPT.md)
- [Pricing Model](./docs/PRICING_MODEL.md)
- [Grok Critic Briefing](./docs/GROK_BRIEFING.md)

## Status

ForgePilot is still pre-launch. It is already useful as a local development cockpit, but SaaS launch needs finalized auth, tenant isolation, billing integration, onboarding polish and a tighter premium UI pass.

## License

MIT for personal and open-source use. See [LICENSE](./LICENSE).
