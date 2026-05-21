# Vercel Deployment

## Quick Start
1. Import repo at vercel.com/new
2. Set env vars (see .env.example) in Vercel Dashboard
3. Deploy — every PR gets a Preview URL, main auto-deploys

## Environment Variables
| Variable | Required | Description |
|---|---|---|
| ANTHROPIC_API_KEY | Yes | AI provider |
| DATABASE_URL | No | PostgreSQL (enables Postgres mode) |
| NEXT_PUBLIC_SENTRY_DSN | No | Error monitoring |
| CRON_SECRET | Yes (prod) | Protects /api/cron/* endpoints |

## Cron Jobs
- `0 2 * * *` → `/api/cron/retention` — daily DSGVO data retention cleanup
- `0 7 * * *` → `/api/cron/telegram-digest` — daily Telegram digest
- `*/30 * * * *` → `/api/ai/providers/health` — AI provider health check
- `*/15 * * * *` → `/api/cron/delegation-queue` — delegation queue processor
- `*/15 * * * *` → `/api/cron/connector-sync` — connector sync
- `0 3 * * *` → `/api/backup` — daily backup

## Notes
- Without DATABASE_URL, ForgePilot uses JSON file storage (not recommended for Vercel — use with DATABASE_URL)
- Vercel Cron sends `Authorization: Bearer CRON_SECRET` header
- The `output: 'standalone'` in next.config.js is compatible with both Vercel and Docker/NAS deployments
