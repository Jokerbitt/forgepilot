# ForgePilot — AI Workflow OS

> Turn ideas into shipped features. ForgePilot orchestrates AI agents across your entire development workflow.

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-614%20passing-brightgreen)](./src)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](./tsconfig.json)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

---

## What it does

1. **Idea → Brief** — Describe an idea in plain language, AI expands it into a structured project brief
2. **Brief → Requirements** — AI generates prioritized requirements, use cases and risks
3. **Requirements → Delegation** — Top work items become AI delegations with contracts
4. **Delegation → Execution** — AI decomposes tasks and orchestrates autonomous agent runs
5. **Execution → Knowledge** — Results write back to your knowledge base automatically

---

## Quick Start

```bash
git clone https://github.com/Jokerbitt/forgepilot
cd forgepilot
npm install
cp .env.example .env.local
# Add your API key (free options below)
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

- **Next.js 14** App Router + TypeScript strict
- **Tailwind CSS** dark theme
- **Vitest** — 614 tests
- **Local-first** — JSON file persistence, no database required
- **Optional**: Supabase, Railway deployment

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
│   ├── app/                    # Next.js 14 App Router
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
├── config/                     # File-based JSON persistence (runtime state)
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
| Ollama | Local (free) | `OLLAMA_BASE_URL` |
| LM Studio | Local (free) | any OpenAI-compatible URL |

Add any OpenAI-compatible provider via `/settings/providers` — no code changes needed.

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
