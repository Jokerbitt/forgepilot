# ForgePilot — Local-First AI Workflow Control Plane

> Plan, delegate, supervise and critically review AI-assisted development work without losing scope, context or control.

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-1560%2B-brightgreen)](./src)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](./tsconfig.json)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

---

## Features

- **Idea → Brief → Requirements → Delegation → PR** — structured workflow from rough idea to reviewable agent work
- **Multi-provider AI** — Claude, Grok, Gemini, GPT-4, Groq, Mistral, Ollama, LM Studio, and any OpenAI-compatible endpoint
- **Grok critic** — independent AI evaluation layer that scores delegations and code reviews
- **Local-first** — Phase-0 JSON persistence for single-user/self-hosted setups, with PostgreSQL migration work in progress
- **Secure by default** — single-user auth gate is enabled unless explicitly disabled for isolated local development
- **Knowledge writeback** — execution results flow back into your knowledge base automatically
- **GDPR-by-design** — PII scrubbing, DSGVO processing ledger, erasure support
- **Self-hosted** — Docker/NAS deployment, Vercel, or plain `npm run dev`
- **1560+ tests** — Vitest and Playwright coverage across core flows

---

## What it does

1. **Idea → Brief** — Describe an idea in plain language, AI expands it into a structured project brief
2. **Brief → Requirements** — AI generates prioritized requirements, use cases and risks
3. **Requirements → Delegation** — Top work items become AI delegations with contracts
4. **Delegation → Execution** — ForgePilot supervises scoped agent runs and keeps humans in control
5. **Execution → Knowledge** — Results write back to your knowledge base automatically

---

## Quick Start

```bash
git clone https://github.com/Jokerbitt/forgepilot
cd forgepilot
npm install
npm run dev
```

Open http://localhost:3000

---

## Free AI Providers (no credit card)

| Provider | Setup | Speed | Best for |
|----------|-------|-------|----------|
| **Google Gemini** | [aistudio.google.com](https://aistudio.google.com) | Fast | Recommended default |
| **Groq** | [console.groq.com](https://console.groq.com) | Fastest | High-volume dev |
| **Ollama** | `ollama pull llama3.2:3b` | Local | Offline / privacy |

Go to `/settings/providers` to configure.

---

## Stack

- **Next.js 15** App Router + TypeScript strict
- **Tailwind CSS** dark theme
- **Vitest + Playwright** — broad unit, API and smoke coverage
- **Local-first Phase 0** — JSON runtime state under `config/*.json` for single-user use
- **Migration path**: PostgreSQL/Drizzle work is in progress for tenant-aware persistence
- **Optional**: Supabase, Vercel, NAS/Docker deployment

## Security Defaults

ForgePilot handles prompts, code context and provider credentials. Auth is therefore enabled by default.

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

## Deployment

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app)

Or locally with Docker:
```bash
docker build -t forgepilot . && docker run -p 3000:3000 forgepilot
```

---

## Architecture

```
forgepilot/
├── src/
│   ├── app/                    # Next.js 15 App Router
│   │   ├── api/                # API routes (all Zod-validated)
│   │   └── (pages)/            # Command Center, Delegations, Projects, ...
│   └── lib/
│       ├── ai/                 # Provider registry + text generation
│       ├── context/            # Context engineer + PII scrubber
│       ├── dsgvo/              # DSGVO processing ledger + erasure
│       ├── eval/               # Eval harness (3D scoring)
│       ├── knowledge/          # Knowledge cards + semantic search
│       ├── nba-engine/         # Next Best Action engine
│       └── validation/         # Zod schemas + parseBody() helper
├── config/                     # Phase-0 local JSON runtime state
└── scripts/                    # Seed, deploy, and validation scripts
```

---

## All AI Providers

| Provider | Type | Env var |
|----------|------|---------|
| Anthropic Claude | Cloud | `ANTHROPIC_API_KEY` |
| OpenAI | Cloud | `OPENAI_API_KEY` |
| Google Gemini | Cloud (free tier) | `GOOGLE_API_KEY` |
| Groq | Cloud (fast + free) | `GROQ_API_KEY` |
| Together AI | Cloud | `TOGETHER_API_KEY` |
| Mistral | Cloud | `MISTRAL_API_KEY` |
| OpenRouter | Cloud (aggregator) | `OPENROUTER_API_KEY` |
| xAI Grok | Cloud (critic) | `XAI_API_KEY` |
| Ollama | Local (free) | `OLLAMA_BASE_URL` |
| LM Studio | Local (free) | any OpenAI-compatible URL |

Add any OpenAI-compatible provider via `/settings/providers` — no code changes needed.

### Grok Integration

Grok acts as an independent **critic/evaluator** — it scores delegations, reviews code, and provides a second opinion alongside Claude. See [docs/GROK_SETUP.md](./docs/GROK_SETUP.md) for setup instructions.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, branching workflow, and how to add new providers or connectors.

**Good first issues** are labeled [`good first issue`](https://github.com/Jokerbitt/forgepilot/issues?q=label%3A%22good+first+issue%22) on GitHub.

---

## License

MIT for personal/open-source use. See [LICENSE](LICENSE).

---

<p align="center">
  <strong>Self-hosted · Local-first · GDPR-by-design</strong><br><br>
  <a href="https://github.com/Jokerbitt/forgepilot/issues/new?template=feature.md">Request a Feature</a> ·
  <a href="https://github.com/Jokerbitt/forgepilot/issues/new?template=bug.md">Report a Bug</a> ·
  <a href="./CONTRIBUTING.md">Contribute</a>
</p>
