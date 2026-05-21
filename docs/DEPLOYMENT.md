# ForgePilot — Deployment Guide

## Local Development

```bash
git clone https://github.com/Jokerbitt/forgepilot
cd forgepilot
cp .env.example .env.local
# Edit .env.local: set NEXTAUTH_SECRET + FORGEPILOT_ADMIN_PASSWORD
npm install
npm run dev
# → http://localhost:3000
```

## With PostgreSQL (Docker)

```bash
docker-compose up -d postgres
npm run db:migrate
npm run dev
```

## Docker (NAS / Self-Hosted)

```bash
docker-compose up -d
```

Includes Postgres + auto-migration on start.

Or build manually:
```bash
docker build -t forgepilot .
docker run -p 3000:3000 \
  -v $(pwd)/config:/app/config \
  -e NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  -e FORGEPILOT_ADMIN_PASSWORD=your-password \
  forgepilot
```

## Vercel

1. Connect GitHub repo to Vercel
2. Set environment variables in Vercel Dashboard:
   - `NEXTAUTH_SECRET` (generate: `openssl rand -base64 32`)
   - `FORGEPILOT_ADMIN_PASSWORD`
   - `DATABASE_URL` (optional, Neon/Supabase recommended)
   - `NEXTAUTH_URL` = your Vercel URL
3. Deploy — Vercel auto-detects Next.js

`vercel.json` is pre-configured with cron jobs for retention, Telegram digest, and connector sync.

## Railway

```bash
railway login
railway link
railway up
```

Set env vars via Railway Dashboard. `railway.json` is pre-configured.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | **Yes** | Random 32-char secret — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | **Yes** | Full URL, e.g. `https://fp.example.com` |
| `FORGEPILOT_ADMIN_PASSWORD` | **Yes** | Admin login password (min 12 chars) |
| `FORGEPILOT_ADMIN_EMAIL` | Optional | Admin email (default: admin@forgepilot.local) |
| `DATABASE_URL` | Optional | PostgreSQL connection string (falls back to JSON files) |
| `CRON_SECRET` | If using Vercel crons | Protects `/api/cron/*` routes |
| `ANTHROPIC_API_KEY` | Recommended | Primary AI provider |
| `XAI_API_KEY` | Optional | Grok critic evaluation |
| `SENTRY_DSN` | Optional | Error monitoring |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Optional | OpenTelemetry traces |

## Auth Setup

Auth is **enabled by default**. Set these two variables at minimum:

```env
NEXTAUTH_SECRET=$(openssl rand -base64 32)
FORGEPILOT_ADMIN_PASSWORD=a-strong-password-min-12-chars
NEXTAUTH_URL=http://localhost:3000
```

For isolated local development without auth (unsafe, ignored in production):
```env
FORGEPILOT_AUTH_DISABLED=true
```

## Health Check

```
GET /api/ready
```

Returns JSON with status of all services. Use this for uptime monitoring and container health probes.

## Database Migration

```bash
# Apply latest Drizzle migrations
npm run db:migrate

# One-time backfill from JSON files to Postgres
FORGEPILOT_DELEGATION_STORAGE=dual npm run db:backfill
```

For a cautious migration, start with `FORGEPILOT_DELEGATION_STORAGE=dual`: ForgePilot keeps JSON as the primary read path and mirrors writes to Postgres. After validation, switch to `FORGEPILOT_DELEGATION_STORAGE=postgres`.
