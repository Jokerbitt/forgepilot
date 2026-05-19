# Contributing to ForgePilot

Thank you for your interest in contributing! ForgePilot is an open-source project and we welcome contributions of all kinds — bug fixes, new features, documentation, new AI providers, and new connectors.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Add a New AI Provider](#how-to-add-a-new-ai-provider)
- [How to Add a New Connector](#how-to-add-a-new-connector)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Good First Issues](#good-first-issues)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold it. Please report unacceptable behavior to sven.bittl@gmx.de.

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/forgepilot.git
   cd forgepilot
   ```
3. **Add upstream** remote:
   ```bash
   git remote add upstream https://github.com/Jokerbitt/forgepilot.git
   ```
4. **Create a branch** for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## How to Contribute

### Report a Bug
Use the [bug report template](https://github.com/Jokerbitt/forgepilot/issues/new?template=bug.md). Include:
- Steps to reproduce
- Expected vs. actual behavior
- Environment (OS, Node version, AI provider)

### Request a Feature
Use the [feature request template](https://github.com/Jokerbitt/forgepilot/issues/new?template=feature.md). Describe the problem you are trying to solve, not just the solution.

### Submit a Pull Request
See [Pull Request Process](#pull-request-process) below.

### Improve Documentation
Documentation PRs are always welcome — typos, unclear explanations, missing examples.

---

## Development Setup

### Requirements

- Node.js 20+
- npm 10+
- An API key for at least one AI provider (or Ollama for free local inference)

### Installation

```bash
npm install
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY (or OLLAMA_BASE_URL) to .env.local
npm run dev
```

### Available Scripts

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm run type-check   # TypeScript strict check (run before PR)
npm run lint         # ESLint (run before PR)
npm run test:run     # Run all Vitest tests once
npm run test         # Run tests in watch mode
```

> **Important:** Never run `npm run build` and `npm run type-check` in parallel — `.next/types` can cause a race condition. Run them sequentially.

---

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes — all POST bodies use parseBody() + Zod schema
│   └── (pages)/          # Next.js App Router pages
└── lib/
    ├── ai/
    │   ├── providers/    # AI provider implementations (one file per provider)
    │   └── text-generation.ts
    ├── connectors/       # External service connectors (Linear, GitHub, ...)
    ├── context/          # Context engineer + PII scrubber
    ├── dsgvo/            # GDPR processing ledger and erasure
    ├── eval/             # Eval harness
    ├── knowledge/        # Knowledge cards store
    ├── logger/           # Pino logger (use this, not console.log)
    ├── nba-engine/       # Next Best Action engine
    ├── tracing/          # OpenTelemetry spans
    └── validation/       # Zod schemas — add new schemas here
```

---

## How to Add a New AI Provider

ForgePilot uses a plugin-based provider registry. Adding a new provider takes about 30 minutes.

### 1. Create the provider file

Copy an existing provider as a starting point:

```bash
cp src/lib/ai/providers/openai-compatible.ts src/lib/ai/providers/your-provider.ts
```

Implement the `AIProvider` interface from `src/lib/ai/providers/types.ts`:

```typescript
// src/lib/ai/providers/your-provider.ts
import type { AIProvider } from './types'

export const yourProvider: AIProvider = {
  id: 'your-provider',
  name: 'Your Provider',
  generateText: async (options) => {
    // Call the provider API here
    return { text, inputTokens, outputTokens }
  },
  testConnection: async (config) => {
    // Return { ok: true } or { ok: false, error: '...' }
  },
}
```

### 2. Register the provider

Add it to the registry in `src/lib/ai/providers/registry.ts`:

```typescript
import { yourProvider } from './your-provider'

export const BUILT_IN_PROVIDERS: AIProvider[] = [
  // ... existing providers
  yourProvider,
]
```

### 3. Add env var documentation

Add the API key to `.env.example`:

```bash
# Your Provider — https://your-provider.com/api-keys
YOUR_PROVIDER_API_KEY=...
```

### 4. Write a test

Add a test in `src/lib/ai/providers/your-provider.test.ts`. Look at `openai-compatible.test.ts` as an example. The test should mock the HTTP call and verify token parsing.

### 5. Submit a PR

We will review and add it to the Settings UI.

---

## How to Add a New Connector

Connectors fetch work items from external services (Linear, GitHub, Jira, Notion, etc.).

### 1. Create the connector

```bash
cp src/lib/connectors/linear-items.ts src/lib/connectors/your-service-items.ts
```

Implement:

```typescript
export interface YourServiceWorkItem extends WorkItem {
  // your-service-specific fields
}

export async function fetchYourServiceItems(config: ConnectorConfig): Promise<YourServiceWorkItem[]> {
  // fetch and normalize to WorkItem shape
}
```

### 2. Register in the connector registry

Add to `src/lib/connectors/registry.ts` with a health-check function.

### 3. Add to the Settings UI

Update `src/app/settings/page.tsx` to show the new connector's API key input.

### 4. Write tests

Mock the HTTP call, test normalization to `WorkItem` shape.

---

## Code Style

- **TypeScript strict** — no `any` types, ever
- **English** for all code, identifiers, and comments
- **Pino** for logging — never `console.log` in library/API code:
  ```typescript
  import { logger } from '@/lib/logger'
  logger.info({ event: 'my.event', data })   // structured, not a string
  ```
- **Zod** for all API request validation:
  ```typescript
  import { parseBody } from '@/lib/validation/api'
  import { MySchema } from '@/lib/validation/schemas'
  const body = await parseBody(request, MySchema)
  if (isValidationError(body)) return body
  ```
- **No direct file I/O** outside of `src/lib/` store modules
- **Feature branches** — never commit directly to `main`

---

## Testing

Every new feature or bug fix needs a test. We use [Vitest](https://vitest.dev).

```bash
npm run test:run    # run all tests
```

### Test conventions

- Test files live next to the code they test: `foo.ts` → `foo.test.ts`
- Mock external calls (HTTP, file system) — tests must not require network access
- Aim for behavior tests, not implementation tests

```typescript
// Good — tests observable behavior
it('returns 400 when title is missing', async () => {
  const req = makeReq({ rawIdea: 'test' })  // no title
  const res = await POST(req)
  expect(res.status).toBe(400)
  const body = await res.json()
  expect(body.fields.title).toBeDefined()
})
```

---

## Pull Request Process

1. **Keep PRs focused** — one feature or fix per PR
2. **Update tests** — new behavior = new test
3. **Run the full check** before opening your PR:
   ```bash
   npm run type-check
   npm run lint
   npm run test:run
   ```
4. **Fill out the PR template** — describe what changed and how to test it
5. **Link to an issue** if one exists
6. **Small PRs merge faster** — if your change is large, open an issue first to discuss

### Branch naming

```
feature/short-description      # new features
fix/short-description          # bug fixes
chore/short-description        # maintenance, deps, docs
```

---

## Good First Issues

Look for issues labeled [`good first issue`](https://github.com/Jokerbitt/forgepilot/issues?q=label%3A%22good+first+issue%22). These are intentionally scoped to be approachable for first-time contributors.

Ideas for good first contributions:
- Add a new AI provider (Together AI, Cohere, Fireworks, ...)
- Improve an error message to be more helpful
- Add a missing test for an existing function
- Fix a typo or improve documentation
- Add a new connector health check

---

## Questions?

Open a [GitHub Discussion](https://github.com/Jokerbitt/forgepilot/discussions) or file an issue. We are happy to help you get started.
