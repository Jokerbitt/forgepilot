# ForgePilot — Autonomous Development Backlog

This file is the single source of truth for the autonomous daily development workflow.
The GitHub Actions `autonomous-dev.yml` picks the next `[ ]` item each day, builds it, and opens a PR.

## Instructions for Autonomous Agent
1. Pick the FIRST unchecked `[ ]` item below
2. Mark it as `[~]` (in progress) in this file and commit
3. Implement the feature on a new branch
4. Run `npm run type-check && npm run test:run`
5. Open a PR and mark the item as `[x]` when merged

---

## 🔴 High Priority — Production Pipeline (M110–M115)

- [x] M110-A: Production build gate in CI — npm run build als Quality Gate, Vitest Coverage (63.5% Lines) mit Thresholds
- [x] M110-B: Enhanced AI Code Reviewer — ForgePilot-spezifische Review-Kriterien (Zod, Pino, Rate Limiting, Security) + Pre-commit-Validator Script
- [x] fix: ESLint build blocker in providers/page.tsx behoben (PR #214)
- [ ] M111: Echter Sentry aktivieren — @sentry/nextjs konfigurieren, SENTRY_DSN in Vercel/local, global-error.tsx hinzufügen
- [ ] M112: OpenTelemetry aktivieren — @opentelemetry Pakete, Jaeger lokal, Honeycomb prod, Spans für delegation.execute + ai.generate
- [ ] M113: GitHub Actions Matrix-Tests — Node 20 + 22 parallel, Test-Report als PR-Kommentar, Flaky-Test-Detektion
- [ ] M114: Dependency Security Scan — npm audit im CI, Dependabot auto-PRs, SBOM-Generierung
- [ ] M115: Performance Budget — Lighthouse CI pro PR, Bundle-Size-Check, Core Web Vitals Baseline

## 🔴 High Priority — Tech Quality (M100–M105)

- [x] M100: Zod validation rollout — apply parseBody() to all POST/PUT API routes (agent-runs, settings, eval, full-cycle, pm-agent, projects, attention)
- [x] M101: Pino migration complete — replace remaining 4 console.error calls in API routes (pdf-export, dsgvo-export, delegation-versions, execute) + component console.log calls
- [x] M102: API rate limiting — simple in-memory rate limiter middleware for all /api routes (100 req/min per IP, 429 response with Retry-After)
- [x] M103: API route test coverage — add ≥3 tests each for: /api/agent-runs, /api/settings, /api/projects, /api/health (currently 0 coverage)
- [ ] M104: Integration test suite — end-to-end flow test: POST /api/project-briefs → GET /api/project-briefs/[id] → POST /api/delegations → GET /api/delegations/[id]
- [ ] M105: Dashboard stats accuracy — /api/dashboard/stats currently returns mock-mixed data; ensure all counts come from real JSON stores, add snapshot test

## 🔴 High Priority — Tech Quality (M94–M99)

- [x] M94: Zod schema validation on all API routes — structured 400 errors with field details
- [x] M95: Pino structured logging — replace 19x console.log, JSON output in prod, child loggers per module
- [x] M96: Error Boundaries + Next.js error.tsx — global crash recovery + 404 page
- [x] M97: Sentry error monitoring — unhandled errors, performance traces, free tier
- [x] M98: OpenTelemetry AI call tracing — span per delegation.execute, context.build, ai.generate
- [x] M99: Vercel deployment config — vercel.json, edge runtime for /api/intake, cron for DSGVO retention

## 🟡 Medium Priority

- [x] feat: Ollama model auto-detection — list available local models in `/settings/providers` via GET `http://localhost:11434/api/tags`
- [x] feat: Settings — separate model picker for fast vs coding purpose (currently only changeable via config file)
- [x] feat: Agent execution live-stream via SSE (replace 3s polling in `/orchestrations` with Server-Sent Events)
- [x] feat: Global search — search across all Briefs, Delegations, Work Items, Knowledge Cards (`/search` page + `Cmd+K` shortcut)
- [x] feat: GitHub PR auto-creation after delegation execution completes (uses existing GITHUB_TOKEN)
- [x] feat: Project Brief templates — 3 presets: SaaS Product, Mobile App, REST API (one-click populate)

## 🟡 Medium Priority

- [x] feat: Delegation batch-approve UI — select multiple pending delegations, approve all at once
- [x] feat: Export Project Brief as Markdown file (download button on brief detail page)
- [x] feat: Rate-limit / quota tracker — show Gemini free tier usage (calls today vs 1500 limit) in dashboard
- [x] feat: Keyboard shortcuts — `g i` = go to /idea, `g d` = /delegations, `g k` = /knowledge, `/` = search
- [x] feat: Work Items bulk-import via CSV (paste or upload, auto-parse title/priority/type columns)
- [x] feat: DSGVO data export — download all processing records as ZIP (Art. 20 right to portability)
- [x] feat: Mobile responsive improvements — fix layout on screens < 768px (navigation, tables, modals)
- [x] feat: Webhook endpoint for external triggers — `POST /api/webhooks/intake` for n8n/Zapier

## 🟢 Lower Priority

- [x] feat: Dark/Light mode toggle (persist in localStorage, default dark)
- [x] feat: Project Brief PDF export (use puppeteer or jsPDF)
- [x] feat: Agent skill library page — show all available agent skills with descriptions
- [x] feat: Delegation contract versioning — track changes to contracts over time
- [x] feat: Work item dependencies — mark item B as "blocked by" item A
- [x] chore: Add Playwright E2E tests for critical flows (idea → brief → delegation)
- [x] chore: Upgrade dependencies (next, typescript, tailwind) to latest versions
- [x] docs: Add JSDoc comments to all public lib functions

---

## ✅ Completed (this month)

- [x] fix: Ollama multi-provider compatibility (PR #169)
- [x] test: M89-M93 test coverage + ENV route (PR #170)
- [x] feat: Railway deployment config + Groq quick-setup (PR #171)
- [x] feat: Context Package Builder UI (PR #172)
- [x] feat: Dashboard polish + navigation + empty states (PR #173)
- [x] feat: Google Gemini quick-setup as primary free provider (PR #174)
- [x] feat: Together.ai + OpenRouter free provider banners (PR #175)
- [x] feat: Idea page example chips + onboarding widget (PR #176)
- [x] feat: Notification bell + /notifications page (PR #177)
- [x] docs: README rewrite + seed script + Dockerfile (PR #178)
- [x] feat: Knowledge Cards UI — search, tags, expandable (PR #179)
