# ForgePilot — PostgreSQL Cutover Guide

## Overview

ForgePilot supports three storage modes, controlled by `STORAGE_MODE`:

| Mode | Description | When to use |
|---|---|---|
| `json` | All reads/writes go to `config/*.json` files | Development, single-run bootstrap |
| `dual` | Writes go to both JSON and Postgres; reads come from Postgres | Migration phase |
| `postgres` | All reads/writes go to Postgres only | Production |

The default is `json` when no `DATABASE_URL` is set, and `postgres` when `DATABASE_URL` is configured and `STORAGE_MODE` is not overridden.

---

## Pre-requisites

1. PostgreSQL 14+ (local, Docker, Supabase, or NAS-hosted)
2. `DATABASE_URL` set to a valid connection string
3. Schema applied (run once): `npm run db:push`
4. Existing JSON data in `config/delegations.json` and `config/project-briefs.json`

---

## Migration Steps

### Step 1 — Backup JSON stores

```bash
cp config/delegations.json config/delegations.json.bak
cp config/project-briefs.json config/project-briefs.json.bak
```

### Step 2 — Apply database schema

```bash
DATABASE_URL=postgresql://... npm run db:push
# or for tracked migrations:
DATABASE_URL=postgresql://... npm run db:migrate
```

### Step 3 — Enable dual-write

Update your `.env.local` or runtime env:

```env
DATABASE_URL=postgresql://forgepilot:forgepilot@localhost:5432/forgepilot
STORAGE_MODE=dual
```

Restart the app. New writes now go to both JSON and Postgres. Existing reads still come from Postgres (via the dual-write path).

### Step 4 — Backfill JSON data into Postgres

```bash
DATABASE_URL=postgresql://... npm run db:backfill
```

Dry-run first to see what would be written:

```bash
DRY_RUN=true DATABASE_URL=postgresql://... npm run db:backfill
```

### Step 5 — Verify alignment

```bash
DATABASE_URL=postgresql://... npm run db:verify-cutover
```

Exit code `0` means stores are aligned and Postgres is safe to become primary.
Exit code `1` means there are discrepancies — check the output before proceeding.

### Step 6 — Cut over to Postgres-only

```env
STORAGE_MODE=postgres
```

Restart the app. JSON files become read-only backups.

---

## Read-Switch Criteria

The app switches reads to Postgres when any of the following is true:

1. `STORAGE_MODE=postgres` (explicit)
2. `STORAGE_MODE=dual` (writes to both, reads from Postgres)
3. `DATABASE_URL` is set and `STORAGE_MODE` is not explicitly `json`

Check current mode at runtime: `GET /api/ready` includes `storage_mode` in the response.

---

## Rollback

If a problem is discovered after switching to `STORAGE_MODE=postgres`:

```bash
# 1. Set STORAGE_MODE=json in env and restart
STORAGE_MODE=json

# 2. Verify JSON backups are intact
ls -la config/*.json.bak

# 3. Restore if needed
cp config/delegations.json.bak config/delegations.json
cp config/project-briefs.json.bak config/project-briefs.json
```

The JSON stores are never deleted during migration — they remain as fallback.

---

## Recovery After Postgres Failure

If the Postgres server becomes unavailable:

1. Set `STORAGE_MODE=json` and restart — the app continues using JSON files
2. Any writes during the outage go only to JSON
3. After Postgres recovers: re-run `npm run db:backfill` to sync the gap
4. Run `npm run db:verify-cutover` to confirm alignment
5. Switch back to `STORAGE_MODE=postgres`

---

## Scope of Migration

The following stores are covered by dual-write and backfill:

| Store | JSON file | Postgres table |
|---|---|---|
| Delegations | `config/delegations.json` | `delegations` |
| Project Briefs | `config/project-briefs.json` | `project_briefs` |
| Knowledge Cards | `config/knowledge-cards.json` | `knowledge_cards` |

Stores that remain JSON-only (operational/ephemeral, not in Postgres):

- `config/api-keys.json` — encrypted at rest, not migrated
- `config/nba-settings.json` — settings, not data
- `config/execute-loop-evidence.json` — append-only evidence log
- `config/test-results.json` — test run output, ephemeral

---

## Verification Checklist

Run before declaring M1 complete:

```bash
DATABASE_URL=postgresql://... npm run db:verify-cutover   # exit 0
npm run test:run                                           # all green
npm run type-check                                         # 0 errors
```

Manual checks:
- [ ] `/api/ready` shows `storage_mode: "postgres"` or `"dual"`
- [ ] `/api/reports/daily` returns delegation data from Postgres
- [ ] Creating a new delegation via UI persists correctly
- [ ] JSON `.bak` files exist as safety net
