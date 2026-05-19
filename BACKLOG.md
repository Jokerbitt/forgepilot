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

## 🔴 High Priority

- [x] feat: Ollama model auto-detection — list available local models in `/settings/providers` via GET `http://localhost:11434/api/tags`
- [ ] feat: Settings — separate model picker for fast vs coding purpose (currently only changeable via config file)
- [ ] feat: Agent execution live-stream via SSE (replace 3s polling in `/orchestrations` with Server-Sent Events)
- [ ] feat: Global search — search across all Briefs, Delegations, Work Items, Knowledge Cards (`/search` page + `Cmd+K` shortcut)
- [x] feat: GitHub PR auto-creation after delegation execution completes (uses existing GITHUB_TOKEN)
- [ ] feat: Project Brief templates — 3 presets: SaaS Product, Mobile App, REST API (one-click populate)

## 🟡 Medium Priority

- [ ] feat: Delegation batch-approve UI — select multiple pending delegations, approve all at once
- [ ] feat: Export Project Brief as Markdown file (download button on brief detail page)
- [ ] feat: Rate-limit / quota tracker — show Gemini free tier usage (calls today vs 1500 limit) in dashboard
- [ ] feat: Keyboard shortcuts — `g i` = go to /idea, `g d` = /delegations, `g k` = /knowledge, `/` = search
- [ ] feat: Work Items bulk-import via CSV (paste or upload, auto-parse title/priority/type columns)
- [ ] feat: DSGVO data export — download all processing records as ZIP (Art. 20 right to portability)
- [ ] feat: Mobile responsive improvements — fix layout on screens < 768px (navigation, tables, modals)
- [ ] feat: Webhook endpoint for external triggers — `POST /api/webhooks/intake` for n8n/Zapier

## 🟢 Lower Priority

- [ ] feat: Dark/Light mode toggle (persist in localStorage, default dark)
- [ ] feat: Project Brief PDF export (use puppeteer or jsPDF)
- [ ] feat: Agent skill library page — show all available agent skills with descriptions
- [ ] feat: Delegation contract versioning — track changes to contracts over time
- [ ] feat: Work item dependencies — mark item B as "blocked by" item A
- [ ] chore: Add Playwright E2E tests for critical flows (idea → brief → delegation)
- [ ] chore: Upgrade dependencies (next, typescript, tailwind) to latest versions
- [ ] docs: Add JSDoc comments to all public lib functions

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
