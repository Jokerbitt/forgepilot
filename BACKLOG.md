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
- [x] M111: Echter Sentry aktivieren — migrated to instrumentation.ts + instrumentation-client.ts, onRouterTransitionStart, global-error.tsx
- [x] M112: OpenTelemetry aktivieren — real @opentelemetry/api tracer, NodeSDK via OTEL_EXPORTER_OTLP_ENDPOINT, force-dynamic build fix
- [x] M113: GitHub Actions Matrix-Tests — Node 20 + 22 parallel, Test-Report als PR-Kommentar, Flaky-Test-Detektion
- [x] M114: Dependency Security Scan — npm audit im CI, Dependabot auto-PRs, SBOM-Generierung
- [x] M115: Performance Budget — Lighthouse CI pro PR, Bundle-Size-Check, Core Web Vitals Baseline

## 🔴 High Priority — Tech Quality (M100–M105)

- [x] M100: Zod validation rollout — apply parseBody() to all POST/PUT API routes (agent-runs, settings, eval, full-cycle, pm-agent, projects, attention)
- [x] M101: Pino migration complete — replace remaining 4 console.error calls in API routes (pdf-export, dsgvo-export, delegation-versions, execute) + component console.log calls
- [x] M102: API rate limiting — simple in-memory rate limiter middleware for all /api routes (100 req/min per IP, 429 response with Retry-After)
- [x] M103: API route test coverage — add ≥3 tests each for: /api/agent-runs, /api/settings, /api/projects, /api/health (currently 0 coverage)
- [x] M104: Integration test suite — end-to-end flow test: POST /api/project-briefs → GET /api/project-briefs/[id] → POST /api/delegations → GET /api/delegations/[id]
- [x] M105: Dashboard stats accuracy — /api/dashboard/stats currently returns mock-mixed data; ensure all counts come from real JSON stores, add snapshot test

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

## 🔴 High Priority — Intelligence Layer (M116–M120)

- [x] M116: Auto-Knowledge Extraction — extract Knowledge Cards from completed delegations, feed into context layer 5
- [x] M117: Context Engineer Tests + Integration — comprehensive tests for buildContext(), token budget, PII scrubbing (currently 0% coverage)
- [x] M118: Smart Delegation Retry — auto-detect failure cause, improve prompt, retry with backoff
- [x] M119: AI Decomposer Tests + Sub-task quality scoring
- [x] M120: Scheduled Delegation Queue — cron-based auto-execution of approved delegations

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

## 🔴 High Priority — Autonomy & UX (M126–M130)

- [x] M126: Linear → Auto-Delegation — webhook: Linear ticket "In Progress" → automatisch ForgePilot Delegation erstellen
- [x] M127: Delegation Templates — vorgefertigte Templates (Add API Route, Fix Bug, Write Tests, Refactor) für schnellere Erstellung
- [x] M128: Multi-Provider Fallback — wenn primärer AI-Provider scheitert, automatisch auf sekundären wechseln
- [x] M129: Delegation Cost Tracker — tatsächliche Token-Kosten pro Delegation summieren + Budget-Warnung im UI
- [x] M130: One-Click Deploy to Vercel — /settings/deployment Seite mit Vercel-Verbindungsstatus + Env-Var-Checkliste

## 🔴 High Priority — UX & Intelligence (M131–M135)

- [x] M131: Enhanced Projects Dashboard — Projekt-Status-Pipeline (intake→planning→ready→in_progress→attention→completed) mit Metriken + Next-Action-CTA
- [x] M132: AI Cost Analytics Dashboard — /analytics Seite mit Kosten pro Provider, Trend-Charts, Budget-Übersicht + Token-Verbrauch nach Zweck
- [x] M133: Delegation Health Monitor — automatische Erkennung von stuck/hängengebliebenen Delegations + Retry-Empfehlung
- [x] M134: GitHub PR Status Integration — PR-URL + CI-Status direkt in Delegation-Detailansicht (kein Tab-Wechsel nötig)
- [x] M135: Webhook Event Log — alle eingehenden Webhooks (Linear, n8n) in /settings/webhooks mit Status + Replay-Button

## 🔴 High Priority — Product Polish (M136–M140)

- [~] M136: Idea Refinement Wizard — mehrstufiger Dialog: Idee eingeben → KI generiert Fragen → Antworten fließen in Project Brief
- [~] M137: Delegation Bulk-Actions — mehrere Delegations gleichzeitig approve/cancel/archive (Checkbox-Liste)
- [~] M138: Notification Preferences — /settings/notifications mit granularen Einstellungen (welche Events triggern Bell)
- [~] M139: Work Item Kanban View — /work-items als Kanban-Board (todo/in_progress/done Spalten, drag-and-drop)
- [~] M140: API Key Rotation Alert — automatische Warnung wenn API-Key älter als 90 Tage (Badge in Settings)

## 🟠 Medium Priority — DX & Operations (M141–M145)

- [x] M141: Dark Mode Toggle — System-Präferenz + manueller Override (localStorage), gilt für alle Pages
- [x] M142: Global Search — Cmd+K Palette: Work Items, Delegations, Project Briefs, Navigations-Shortcuts
- [~] M143: CSV Export — Work Items + Delegations als CSV-Download (/api/work-items/export, /api/delegations/export)
- [x] M144: Keyboard Shortcuts — vollständige Shortcut-Map (j/k Navigation, a Approve, c Cancel, ? Hilfe-Overlay)
- [~] M145: Settings Import/Export — komplette Konfiguration (API Keys ausgenommen) als JSON exportieren/importieren

## 🟠 Medium Priority — Intelligence & Agent UX (M146–M153)

- [~] M146: Delegation Comment Thread — Kommentare pro Delegation (Nutzer + Agent-Output) mit Timestamp
- [~] M147: Work Item Priority Sort — Drag-and-Drop Prioritäts-Sortierung in der List-View
- [~] M148: Project Brief Diff View — vergleiche zwei Versionen eines Briefs side-by-side
- [~] M149: Agent Run Replay — gespeicherte Delegation-Runs wiedergeben (Context + Prompt + Response Timeline)
- [~] M150: Smart Notification Digest — tägliche/wöchentliche Zusammenfassung aller Aktivitäten per Email (optional)
- [~] M151: Telegram Command & Control — Bot-Integration: alle Status-Updates in Telegram, Steuerung via /approve /reject /status /runs /digest /notif
- [~] M152: Telegram Scheduled Digest — täglicher Digest 07:00 UTC via Vercel Cron (/api/cron/telegram-digest)
- [~] M153: Telegram Webhook Setup — /api/telegram/setup-webhook: automatisches Registrieren des Webhooks, "Webhook einrichten"-Button in Settings

## 🟠 Medium Priority — Observability & Reliability (M154–M159)

- [x] M154: Telegram Inline Keyboards — One-tap ✅ Genehmigen / ❌ Ablehnen direkt in Telegram-Nachricht für ausstehende Delegations
- [x] M155: AI Provider Health Monitor — runHealthCheck() mit Latenz, Status-Levels (healthy/degraded/unavailable/unconfigured), failStreak, GET/POST /api/ai/providers/health, Vercel Cron alle 30 Min
- [~] M156: Provider Health UI — /settings/providers zeigt Live-Status-Badges (●grün/●gelb/●rot) + letzte Latenz + failStreak aus Health-Cache
- [~] M157: Notification Channels — Konfigurierbare Kanäle in /settings/notifications: Bell, Telegram, Email — pro Typ wählbar
- [~] M158: Delegation SLA Tracker — SLA-Deadline pro Delegation (Erstellt + konfigurierbare Stunden), Badge wenn SLA verletzt
- [~] M159: Provider Cost Tracker — Token-Verbrauch pro Provider aus Eval-Logs aggregieren, /settings/providers zeigt Kosten-Trend

## 🔴 High Priority — Production-Readiness (M160–M164)

- [~] M160: `/api/ready` Readiness Probe — umfassender Health-Check: Delegations-Store erreichbar, AI-Provider konfiguriert, Scope-Lock OK; Docker HEALTHCHECK
- [~] M161: Config Backup Routine — tägliches automatisches Backup von `config/*.json` nach `config/backups/YYYY-MM-DD/`; GET/POST /api/backup; Vercel Cron 03:00 UTC; 7-Tage-Rotation
- [~] M162: SSE Stream für Agent Scope — `/api/agents/scope/stream` ersetzt 5s-Polling in ScopeBoard; Live/Poll-Toggle; EventSource mit Fallback
- [ ] M163: Approval-Stack im Header — ausstehende Delegations-Genehmigungen als Sticky-Banner in Navigation (Zahl + Quick-Approve-Button) statt nur in /delegations
- [ ] M164: Delegation Live-Timeline — Live-Ansicht laufender Delegations mit Logs, Cost-Anzeige, Risk-Badge, Trace-Link; Polling durch SSE ersetzen
