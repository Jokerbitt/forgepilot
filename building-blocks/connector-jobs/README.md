# Scheduled Jobs / Cron Connector

Named, scheduled background jobs behind a Bearer-secured endpoint. Use for
expiring invitations, sending digests, usage rollups, cleanup, retries.

## Files
- `src/lib/jobs/registry.ts` — register jobs (`registerJob({ name, schedule, run })`)
- `src/app/api/cron/[job]/route.ts` — GET/POST runner, `Authorization: Bearer CRON_SECRET`

## Setup
1. Register jobs in `registry.ts` (or per-module, imported once at startup).
2. Set `CRON_SECRET` in env (in dev, missing secret allows unauthenticated runs).
3. Schedule each job with your platform:
   - Vercel: add to `vercel.json` `"crons": [{ "path": "/api/cron/<job>", "schedule": "0 * * * *" }]`
   - Self-host: an external pinger / system cron hitting the URL with the Bearer header.

```ts
registerJob({ name: 'expire-invitations', schedule: '0 * * * *', async run() { /* ... */ return { ok: true } } })
```

Returns `{ ok, job, ms, ...stats }` for monitoring.
