# ForgePilot — Quickstart Guide

> Local-first AI workflow: Idea → Project Brief → Delegation → Critic Review → GitHub PR.

---

## Prerequisites

1. Node.js 18+ installed
2. At least one AI provider key (Anthropic, Groq, OpenAI, or any OpenAI-compatible)
3. Optional: PostgreSQL (app works without it using file-based JSON storage)

---

## 1. Initial Setup (5 minutes)

```bash
git clone https://github.com/Jokerbitt/forgepilot
cd forgepilot
cp .env.example .env.local
```

Edit `.env.local` — minimum required values:

```bash
# Generate a secret: openssl rand -base64 32
NEXTAUTH_SECRET=<your-generated-secret>
FORGEPILOT_ADMIN_PASSWORD=<strong-password-min-12-chars>

# Add at least one AI provider key, e.g.:
ANTHROPIC_API_KEY=sk-ant-api03-...
# or: GROQ_API_KEY=gsk_...
# or: OPENAI_API_KEY=sk-proj-...
```

Start the app:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `admin@example.com` + the password you set.

The **Onboarding Checklist** on the Command Center guides you through connecting your first provider and (optionally) GitHub and Linear.

---

## 2. The Core Workflow

```
Idea
  ↓
Project Brief  (AI-assisted research + requirements)
  ↓
Delegation     (scope, risk class, budget, model)
  ↓
Agent Execution  (local or cloud, live logs)
  ↓
Critic Review    (Grok independent score)
  ↓
GitHub PR        (auto-created from approved result)
```

---

## 3. Step-by-Step: Idea → Brief

1. Click **"Neue Idee"** on the Command Center (or go to `/idea`).
2. Describe your idea in plain text — no structure needed yet.
3. Click **"Brief erstellen"** — ForgePilot generates a structured Project Brief with:
   - Problem statement
   - Goal and constraints
   - Requirements draft
4. On the Brief detail page, click **"Research Run"** to let the AI enrich the brief with findings.
5. Review the brief. Click **"Delegation erstellen"** when ready.

---

## 4. Step-by-Step: Brief → Delegation

1. The delegation form pre-fills from your brief.
2. Set the **Risk Class**:
   - `A` — fully autonomous execution, no approval needed
   - `B` — auto-approved above a confidence threshold
   - `C` — always requires human approval (and generates an ADR)
3. Set a **token budget** (limits AI spend per run).
4. Choose an **execution route**:
   - `Lokaler Agent` — runs on your machine via Claude Code
   - `Ollama (lokal)` — uses your local Ollama instance
   - `Direkt-Chat` — interactive session, no automation
   - `n8n Workflow` — triggers your n8n automation
   - `Manuell` — you implement, ForgePilot tracks
5. Click **"Delegation erstellen"**.

---

## 5. Step-by-Step: Execute → Review → PR

1. On the Delegation detail page (`/delegations/[id]`), click **"Ausführen"**.
2. Watch the live log stream. The agent runs within the defined scope.
3. When complete, the **Critic Review** panel shows:
   - Correctness score (0–100)
   - Efficiency score (0–100)
   - Drift score (how far from the original spec)
   - Overall verdict: `approved` / `needs-revision` / `rejected`
4. If approved (or manually reviewed), click **"GitHub PR erstellen"** — ForgePilot opens a PR with the delegation summary as the PR description.

---

## 6. Auth Defaults

Auth is **enabled by default** for all deployments. Even on localhost, a login is required.

- Default admin email: `admin@example.com`
- Password: whatever you set in `FORGEPILOT_ADMIN_PASSWORD`

For automated workflows (n8n, CI), use the API key instead of a session:

```bash
# Set in .env.local:
FORGEPILOT_API_KEY=your-long-random-key  # openssl rand -hex 32

# Use in requests:
curl -H "Authorization: Bearer your-long-random-key" http://localhost:3000/api/delegations
```

Dev-only bypass (never use in production):

```bash
FORGEPILOT_AUTH_DISABLED=true  # only valid outside NODE_ENV=production
```

---

## 7. PostgreSQL (Optional)

ForgePilot works out of the box with file-based JSON storage. PostgreSQL adds ACID guarantees and is required for multi-user production deployments.

```bash
# Start Postgres via Docker:
docker-compose up -d postgres

# Apply schema:
npm run db:migrate

# Set in .env.local:
DATABASE_URL=postgresql://forgepilot:forgepilot@localhost:5432/forgepilot
STORAGE_MODE=postgres

# Backfill existing JSON data into Postgres (one-time):
export $(grep -v '^#' .env.local | grep DATABASE_URL | xargs)
npx tsx scripts/backfill-json-to-postgres.ts --dry-run  # preview first
npx tsx scripts/backfill-json-to-postgres.ts            # run
npx tsx scripts/verify-postgres-cutover.ts              # verify
```

See [docs/postgres-cutover.md](postgres-cutover.md) for a full migration guide.

---

## 8. Critic Review via Grok (Optional)

ForgePilot uses xAI Grok as an independent critic for delegation outputs.

```bash
# .env.local:
XAI_API_KEY=xai-...
```

Without Grok, ForgePilot falls back to another configured provider (Anthropic, OpenAI, etc.) for critic scoring.

For external Grok sessions (reviewing output outside ForgePilot), use the Daily Report:

```bash
curl http://localhost:3000/api/reports/daily?format=markdown
```

Paste the Markdown into Grok — it contains status, risks, and next actions without secrets. See [docs/GROK_BRIEFING.md](GROK_BRIEFING.md) for a full critic briefing template.

---

## 9. Daily Report + Planning Gateway

ForgePilot exposes a read-only status endpoint for external AI critics:

```bash
# JSON (machine-readable):
curl http://localhost:3000/api/reports/daily

# Markdown (paste into Grok/Claude):
curl http://localhost:3000/api/reports/daily?format=markdown
```

The report contains: MVP verdict, core-flow status, top risks, next actions, and safe prompt templates — **no secrets**.

See [docs/GROK_HEAVY_VALIDATION.md](GROK_HEAVY_VALIDATION.md) for Grok 4 Heavy validation patterns.

---

## 10. Verify the Installation

Run these checks after setup:

```bash
npm run test:run    # all tests passing
npm run type-check  # 0 TypeScript errors
npm run lint        # 0 lint warnings
npm run build       # production build succeeds
```

Check the API directly:

```bash
curl http://localhost:3000/api/health   # {"ok":true}
curl http://localhost:3000/api/ready    # {"ready":true}
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "No AI provider configured" banner | Add at least one API key in `/settings` or `.env.local` |
| Login page loops / 401 errors | Check `NEXTAUTH_SECRET` is set and unique |
| Delegation execution stuck | Check model availability in `/settings → Providers` |
| Postgres connection refused | Run `docker-compose up -d postgres` first |
| Ollama not detected | Ensure Ollama is running at `OLLAMA_BASE_URL` (default: `http://localhost:11434`) |

For more: [docs/secure-deployment.md](secure-deployment.md) · [docs/local-testing.md](local-testing.md)
