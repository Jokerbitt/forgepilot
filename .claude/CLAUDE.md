# CLAUDE.md - ForgePilot AI Workflow OS

## Project

ForgePilot is Sven's local-first, NAS-first AI Workflow OS.

Goal: turn ideas and Linear tickets into researched project briefs, requirements, controlled delegations, agent execution, pull requests, and knowledge writeback.

## Required Context

Before meaningful work, read the repo root `AGENTS.md` and the NAS SSOT in this order:

1. `/Volumes/Sven/NAS/Codex/KI Betriebssystem/00_START_HERE_AGENT_BRIEFING.md`
2. `/Volumes/Sven/NAS/Codex/KI Betriebssystem/00a_CURRENT_BASELINE.md` — what's already built + write scope
3. `/Volumes/Sven/NAS/Codex/KI Betriebssystem/02_ROADMAP_MEILENSTEINE_ARBEITSPAKETE.md`
4. Task-specific files from `03_ARCHITEKTUR_BLUEPRINT.md` onwards as needed.

Do not rely on chat memory as the source of truth.

## Workspaces

| Purpose | Path |
|---|---|
| Fast local development | `~/dev/forgepilot` |
| NAS code mirror / shared workspace | `/Volumes/Sven/NAS/Projects/forgepilot` |
| ForgePilot project memory | `/Volumes/Sven/NAS/Codex/KI Betriebssystem` |
| GitHub code truth | `https://github.com/Jokerbitt/forgepilot` |

The NAS mirror can be used for shared inspection and coordination. Local development is still acceptable for speed, as long as GitHub and the NAS SSOT are updated.

## Stack

- Next.js 14 App Router
- TypeScript strict
- Tailwind CSS
- Vitest
- File-based JSON persistence under `config/*.json`
- Docker deployment on QNAP NAS
- n8n automation
- Optional local AI via Ollama

## Important Routes

- `/` - Command Center
- `/project-briefs` - project briefs / blueprint flow
- `/delegations` - delegation queue
- `/settings` - API keys, AI provider, NBA/autopilot config
- `/api/intake` - n8n Linear intake target
- `/api/project-briefs/[id]/research-run` - AI research run
- `/api/project-briefs/[id]/generate-requirements` - requirements generation
- `/api/delegations/[id]/approve` - automation-compatible approval
- `/api/delegations/[id]/start` - alias for execution start
- `/api/delegations/[id]/execute` - execution route

## Autonomer Modus — Trigger: "autonom"

Wenn Sven das Wort **autonom** schreibt (mit oder ohne /), aktiviere sofort den autonomen Arbeitsmodus:

1. Lese `00a_CURRENT_BASELINE.md` + `11_NEXT_STEPS_AGENT_TASKS.md`
2. Wähle höchstpriorisierten Task mit freiem Write Scope
3. Reserviere Write Scope in `00a_CURRENT_BASELINE.md`
4. Implementiere ohne Rückfragen (außer Risk High/Critical → Option A/B/C anbieten)
5. Nach jedem Schritt: eine kurze Statuszeile
6. Abschluss: Write Scope freigeben, Log-Eintrag, PR erstellen

Ausnahmen — immer stoppen und fragen:
- `git push --force`, `rm -rf`, Secrets-Zugriff
- Produktive Systeme ändern
- Risk Class High oder Critical

## Rules

- Communicate with Sven in German.
- Code, identifiers, and comments in English.
- No `any` types.
- Use feature branches; do not commit directly to `main`.
- Add or update tests for behavior changes.
- Do not commit secrets.
- Treat `config/*.json` as runtime state unless the task is explicitly about fixtures/defaults.
- RiskClass C always needs human approval AND an ADR in docs/adr/.
- Keep meaningful decisions and handoffs in the NAS SSOT.

## Verification

Use these before PR-ready work:

```bash
npm run test:run
npm run lint
npm run type-check
npm run build
```

Do not run `npm run build` and `npm run type-check` in parallel because `.next/types` can race.

---

## Engineering Patterns — ForgePilot Codebase

### File layout (where things live)
```
src/app/              Next.js App Router pages + API routes
src/app/api/cron/     Scheduled jobs (GET + POST, Bearer CRON_SECRET)
src/components/       React client components
src/lib/              Pure business logic, no React imports
src/lib/models/       Zod schemas + TypeScript types (delegation.ts etc.)
src/lib/repositories/ File-based JSON stores (delegationRepository.ts)
src/lib/delegations/  Delegation-specific logic (chaining, budget, plans)
src/lib/knowledge/    Knowledge card extraction + writeback
src/lib/nba-engine/   NBA autopilot scoring
config/*.json         Runtime state — treat as mutable, never import as fixtures
```

### Next.js App Router rules
- Route files export ONLY `GET | POST | PUT | DELETE | PATCH | HEAD | OPTIONS` — any other named export breaks the build
- Non-HTTP helpers belong in `src/lib/`, not in `route.ts`
- `export const dynamic = 'force-dynamic'` for routes that depend on request data
- Use `NextResponse.json()` with explicit status codes everywhere

### TypeScript strict
- No `any` — use `unknown` + type guards, or define exact types
- Discriminated unions beat optional fields: `{ status: 'ok'; data: T } | { status: 'error'; error: string }`
- Prefer `satisfies` operator to validate literals while keeping narrowed types
- No barrel `index.ts` re-exports in `src/lib/` — prefer direct imports

### React + Components
- 'use client' only when browser APIs, hooks, or event handlers are needed
- Keep components under ~150 lines; extract named sub-components when they grow
- Avoid `useEffect` for derived state — compute during render instead
- Data fetching belongs in Server Components or API routes, not in client components

### Data persistence
- Atomic writes: write to `.tmp` → `rename` — never partially-written JSON
- `createDelegationRepository(SINGLE_TENANT_USER_ID)` — always use the factory, never instantiate directly
- Treat `config/*.json` as runtime state — test helpers should create isolated temp copies

### Cron jobs (src/app/api/cron/)
- Always validate auth with `isCronAuthorized(request, routeName)` from `@/lib/cron/auth`
- Register every new cron path in `vercel.json` under `"crons"`
- Return `{ ok, timestamp, ...stats }` shape for monitoring
- Cron routes must export both `GET` and `POST` (Vercel calls GET, internal tests use POST)

### Testing
- Test files sit next to their source: `foo.ts` → `foo.test.ts`
- 452+ test files, 3300+ tests — never skip existing tests
- Use `vi.stubEnv()` for environment variables; restore with `vi.unstubAllEnvs()` in `afterEach`
- Mock filesystem I/O at the boundary, not internal logic
- Cover: happy path, error path, edge cases (empty input, missing config, concurrent writes)

### Agent prompt engineering
- Domain knowledge injected via `buildKnowledgeBlock()` in `src/lib/delegations/knowledge-packages.ts`
- Codebase context (relevant files + CLAUDE.md + path aliases) via `buildCodebaseContextBlock()` in `src/lib/delegations/codebase-scout.ts`
- Never put business logic in route.ts; extract to lib functions so they are testable

### Performance
- Parallel `Promise.all` / `Promise.allSettled` over sequential awaits when operations are independent
- `execSync` with explicit `timeout` + `maxBuffer` — never unbounded shell calls
- Stream large agent outputs via `proc.stdout.on('data')`, never buffer entirely in memory

---

## Current Baseline

Full baseline is in `/Volumes/Sven/NAS/Codex/KI Betriebssystem/00a_CURRENT_BASELINE.md`.

Summary as of 2026-05-17:
- GitHub `main` at `353f3f7` includes connectors, NBA engine, delegation queue, approval system, research brief, Ollama settings, operator readiness cockpit.
- 149+ Vitest tests passing. TypeScript 0 errors.
- Next milestones: Knowledge & Memory Layer (M2), Context Package Builder (M3).
