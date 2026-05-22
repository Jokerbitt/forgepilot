# Execute Loop Evidence Harness

ForgePilot V1 must prove the daily assistant loop with real evidence:

`Brief -> Delegation -> Execute -> Tests -> PR -> Critic -> Writeback`

The harness records and exposes evidence for that loop without pretending that dry-runs are production success.

## API

### List Evidence

```bash
GET /api/execute-loop/evidence
```

Returns recorded evidence runs, proven real-run count, and dry-run count.

### Record A Real Run

```bash
POST /api/execute-loop/evidence
```

```json
{
  "title": "Settings provider controls",
  "status": "success",
  "source": "manual",
  "prUrl": "https://github.com/Jokerbitt/forgepilot/pull/428",
  "timeSavedMinutes": 30,
  "manualInterventions": 1,
  "notes": "Ran focused tests, build, PR checks and merged.",
  "steps": {
    "brief": true,
    "delegation": true,
    "execute": true,
    "tests": true,
    "pr": true,
    "critic": true,
    "writeback": true
  }
}
```

Only real runs should use `"source": "manual"` and `"status": "success"`.

### Run The Dry-Run Harness

```bash
POST /api/execute-loop/evidence/harness
```

```json
{ "record": true }
```

This records five `harness-dry-run` scenarios. They validate observability and workflow shape, but they do **not** count as proven real value loops in the Daily Report.

## CLI

```bash
npm run evidence:record -- \
  --title "Settings provider controls" \
  --status success \
  --source manual \
  --pr-url "https://github.com/Jokerbitt/forgepilot/pull/428" \
  --time-saved 30 \
  --manual-interventions 1 \
  --all
```

## Daily Report

The Daily Report reads `config/execute-loop-evidence.json` and shows:

- target: five real runs
- proven real runs
- dry-runs as separate visible records
- next action until the target is proven

Dry-runs are intentionally visible because they help debug the workflow, but they must not be used as launch evidence.
