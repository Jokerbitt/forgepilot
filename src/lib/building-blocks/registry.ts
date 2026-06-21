/**
 * registry.ts — the catalog of reusable SaaS building blocks.
 *
 * Each entry points at real scaffold files under building-blocks/<category>/.
 * The agent reads those files on demand (token-efficient) and adapts them.
 */

import type { BuildingBlock, BlockCategory } from './types'

export const BUILDING_BLOCKS: BuildingBlock[] = [
  // ─── Auth ──────────────────────────────────────────────────────────────────
  {
    id: 'auth-credentials',
    name: 'Email/Password Auth (NextAuth)',
    category: 'auth',
    stack: 'nextjs',
    summary: 'Session-based email/password authentication with NextAuth v5 + bcrypt.',
    whenToUse: 'Use whenever the app needs user accounts, login, signup, or protected routes. Do NOT use for a purely local/offline tool with no users.',
    keywords: ['auth', 'login', 'signup', 'session', 'user', 'account', 'nextauth', 'password', 'register'],
    dependencies: ['next-auth@beta', 'bcryptjs', '@types/bcryptjs'],
    files: [
      { src: 'auth/auth.ts', dest: 'src/lib/auth/auth.ts', note: 'NextAuth config + session callbacks' },
      { src: 'auth/password.ts', dest: 'src/lib/auth/password.ts', note: 'bcrypt hash/verify helpers' },
      { src: 'auth/route.ts', dest: 'src/app/api/auth/[...nextauth]/route.ts', note: 'NextAuth route handler' },
      { src: 'auth/middleware.ts', dest: 'src/middleware.ts', note: 'Protect routes by matcher' },
      { src: 'auth/login-form.tsx', dest: 'src/components/auth/LoginForm.tsx', note: 'Login form component' },
    ],
    setupSteps: [
      'Add AUTH_SECRET to .env (generate: openssl rand -base64 32)',
      'Wire your user lookup in auth.ts authorize() to your database block',
      'Wrap protected pages or use the middleware matcher',
    ],
  },

  // ─── Database ──────────────────────────────────────────────────────────────
  {
    id: 'db-prisma-postgres',
    name: 'Postgres + Prisma',
    category: 'database',
    stack: 'node',
    summary: 'Production database layer: Prisma ORM + Postgres, with a typed client singleton and migration workflow.',
    whenToUse: 'Use for any SaaS that persists real data across users/sessions. Prefer this over localStorage/JSON for anything multi-user or production-bound.',
    keywords: ['database', 'db', 'postgres', 'prisma', 'persistence', 'data', 'orm', 'migration', 'sql', 'store'],
    dependencies: ['prisma', '@prisma/client'],
    files: [
      { src: 'database/schema.prisma', dest: 'prisma/schema.prisma', note: 'Prisma schema with User model starter' },
      { src: 'database/client.ts', dest: 'src/lib/db/client.ts', note: 'Prisma client singleton (no hot-reload leaks)' },
      { src: 'database/repository.ts', dest: 'src/lib/db/repository.ts', note: 'Generic typed repository pattern' },
    ],
    setupSteps: [
      'Add DATABASE_URL to .env',
      'Run: npx prisma migrate dev --name init',
      'Run: npx prisma generate',
      'Extend schema.prisma with your domain models, then migrate again',
    ],
  },

  // ─── UI Layout ───────────────────────────────────────────────────────────────
  {
    id: 'ui-app-shell',
    name: 'App Shell + Design System',
    category: 'ui-layout',
    stack: 'nextjs',
    summary: 'Responsive app shell: sidebar nav, top bar, dark theme, and a small set of primitive components (Button, Card, Input).',
    whenToUse: 'Use as the visual foundation for any dashboard-style SaaS. Skip for a single-page marketing site.',
    keywords: ['ui', 'layout', 'shell', 'sidebar', 'dashboard', 'design', 'tailwind', 'theme', 'navigation', 'component'],
    dependencies: ['clsx', 'tailwind-merge', 'lucide-react'],
    files: [
      { src: 'ui-layout/AppShell.tsx', dest: 'src/components/layout/AppShell.tsx', note: 'Sidebar + topbar shell' },
      { src: 'ui-layout/primitives.tsx', dest: 'src/components/ui/primitives.tsx', note: 'Button, Card, Input, Badge' },
      { src: 'ui-layout/cn.ts', dest: 'src/lib/cn.ts', note: 'clsx + tailwind-merge helper' },
    ],
    setupSteps: [
      'Ensure Tailwind is configured',
      'Wrap your pages in <AppShell> in the root layout',
      'Use primitives from ui/primitives instead of raw HTML elements',
    ],
  },

  // ─── Billing ───────────────────────────────────────────────────────────────
  {
    id: 'billing-stripe',
    name: 'Stripe Subscriptions',
    category: 'billing',
    stack: 'nextjs',
    summary: 'Subscription billing: Stripe checkout, customer portal, and a webhook handler that keeps subscription state in sync.',
    whenToUse: 'Use when the SaaS charges money via subscriptions. Requires the database block for storing subscription status. Do NOT use for free apps.',
    keywords: ['billing', 'stripe', 'payment', 'subscription', 'checkout', 'pricing', 'plan', 'webhook', 'paid'],
    dependencies: ['stripe', '@stripe/stripe-js'],
    files: [
      { src: 'billing/stripe.ts', dest: 'src/lib/billing/stripe.ts', note: 'Stripe client + checkout session helper' },
      { src: 'billing/checkout-route.ts', dest: 'src/app/api/billing/checkout/route.ts', note: 'Create checkout session' },
      { src: 'billing/webhook-route.ts', dest: 'src/app/api/billing/webhook/route.ts', note: 'Sync subscription state' },
    ],
    setupSteps: [
      'Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env',
      'Create products/prices in the Stripe dashboard, put price IDs in stripe.ts',
      'Register the webhook endpoint in Stripe pointing at /api/billing/webhook',
      'Add a subscription field to your User model (database block)',
    ],
  },

  // ─── Testing ─────────────────────────────────────────────────────────────────
  {
    id: 'testing-vitest',
    name: 'Vitest Setup',
    category: 'testing',
    stack: 'any',
    summary: 'Test harness: Vitest + Testing Library + jsdom, with config and an example test.',
    whenToUse: 'Use in EVERY new app — tests are non-negotiable for reliable autonomous builds. Set this up in the scaffold phase.',
    keywords: ['test', 'testing', 'vitest', 'jest', 'tdd', 'coverage', 'spec', 'unit'],
    dependencies: ['vitest', '@vitejs/plugin-react', 'jsdom', '@testing-library/react', '@testing-library/jest-dom'],
    files: [
      { src: 'testing/vitest.config.ts', dest: 'vitest.config.ts', note: 'Vitest config (jsdom, react plugin)' },
      { src: 'testing/setup.ts', dest: 'vitest.setup.ts', note: 'Testing Library matchers' },
      { src: 'testing/example.test.ts', dest: 'src/lib/__example__/sum.test.ts', note: 'Example test to verify setup' },
    ],
    setupSteps: [
      'Add "test:run": "vitest run" to package.json scripts',
      'Run: npm run test:run to verify the harness works',
      'Delete the example test once your real tests exist',
    ],
  },

  // ─── API CRUD ────────────────────────────────────────────────────────────────
  {
    id: 'api-crud-resource',
    name: 'CRUD API Resource',
    category: 'api-crud',
    stack: 'nextjs',
    summary: 'A complete REST resource: GET/POST/PATCH/DELETE route handlers with Zod validation and typed responses.',
    whenToUse: 'Use as the template for every new API resource (todos, projects, customers, …). Copy + rename per resource.',
    keywords: ['api', 'crud', 'rest', 'route', 'endpoint', 'resource', 'zod', 'validation'],
    dependencies: ['zod'],
    files: [
      { src: 'api-crud/route.ts', dest: 'src/app/api/[resource]/route.ts', note: 'GET (list) + POST (create)' },
      { src: 'api-crud/id-route.ts', dest: 'src/app/api/[resource]/[id]/route.ts', note: 'GET/PATCH/DELETE by id' },
      { src: 'api-crud/schema.ts', dest: 'src/lib/[resource]/schema.ts', note: 'Zod schemas + types' },
    ],
    setupSteps: [
      'Rename [resource] to your noun (e.g. todos)',
      'Define the Zod schema for your entity in schema.ts',
      'Wire the handlers to your database repository (database block)',
    ],
  },

  // ─── Deployment ──────────────────────────────────────────────────────────────
  {
    id: 'deploy-vercel-docker',
    name: 'Deployment Config',
    category: 'deployment',
    stack: 'nextjs',
    summary: 'Ship config: Dockerfile (multi-stage), .dockerignore, GitHub Actions CI, and a vercel.json.',
    whenToUse: 'Use in the final phase once the app builds and tests pass, to make it deployable.',
    keywords: ['deploy', 'docker', 'vercel', 'ci', 'github actions', 'pipeline', 'production', 'build'],
    dependencies: [],
    files: [
      { src: 'deployment/Dockerfile', dest: 'Dockerfile', note: 'Multi-stage Next.js production image' },
      { src: 'deployment/dockerignore', dest: '.dockerignore', note: 'Exclude node_modules, .next, .env' },
      { src: 'deployment/ci.yml', dest: '.github/workflows/ci.yml', note: 'Lint + type-check + test on PR' },
    ],
    setupSteps: [
      'Set output: "standalone" in next.config',
      'Add required secrets to GitHub repo settings',
      'Run docker build . to verify the image builds',
    ],
  },
]

// ─── AI Routing (local/cloud auto-router) ───────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'ai-routing',
  name: 'AI Auto-Router (local/cloud)',
  category: 'ai-routing',
  stack: 'node',
  summary: 'Provider-agnostic AI routing: prefer local Ollama, fall back to cloud (Anthropic), with a clean provider interface.',
  whenToUse: 'Use for ANY app that calls an LLM. Gives you local-first inference (free, private) with automatic cloud fallback. Do NOT use for apps with no AI features.',
  keywords: ['ai', 'llm', 'gpt', 'claude', 'ollama', 'model', 'provider', 'routing', 'chat', 'generate', 'inference', 'openai', 'anthropic'],
  dependencies: ['@anthropic-ai/sdk'],
  files: [
    { src: 'ai-routing/provider-types.ts', dest: 'src/lib/ai/provider-types.ts', note: 'AIProvider interface + result types' },
    { src: 'ai-routing/ollama-provider.ts', dest: 'src/lib/ai/ollama-provider.ts', note: 'Local Ollama provider' },
    { src: 'ai-routing/anthropic-provider.ts', dest: 'src/lib/ai/anthropic-provider.ts', note: 'Cloud Anthropic provider' },
    { src: 'ai-routing/openai-provider.ts', dest: 'src/lib/ai/openai-provider.ts', note: 'Cloud OpenAI provider (optional — npm i openai)' },
    { src: 'ai-routing/auto-router.ts', dest: 'src/lib/ai/auto-router.ts', note: 'resolveProvider + generateText with fallback' },
  ],
  setupSteps: [
    'Set AI_MODE=auto|local|cloud, OLLAMA_MODEL, ANTHROPIC_API_KEY in .env',
    'Call generateText({ prompt, purpose }) from your routes',
    'Add more providers by implementing the AIProvider interface',
  ],
})

// ─── AI Guardrails ───────────────────────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'ai-guardrails',
  name: 'AI Guardrails (cost, rate, validation, PII)',
  category: 'ai-guardrails',
  stack: 'node',
  summary: 'Safety rails for AI calls: cost caps, rate limiting, prompt-injection detection, and PII scrubbing.',
  whenToUse: 'Use alongside the AI router for any production AI app to control spend and protect users. Skip for a throwaway prototype.',
  keywords: ['ai', 'guardrail', 'cost', 'budget', 'rate limit', 'pii', 'injection', 'safety', 'validation', 'scrub', 'limit'],
  dependencies: [],
  files: [
    { src: 'ai-guardrails/cost-guard.ts', dest: 'src/lib/ai/guards/cost-guard.ts', note: 'Cost estimate + budget cap' },
    { src: 'ai-guardrails/rate-limit.ts', dest: 'src/lib/ai/guards/rate-limit.ts', note: 'Sliding-window rate limiter' },
    { src: 'ai-guardrails/input-validation.ts', dest: 'src/lib/ai/guards/input-validation.ts', note: 'Prompt sanitize + injection detection' },
    { src: 'ai-guardrails/pii-scrubber.ts', dest: 'src/lib/ai/guards/pii-scrubber.ts', note: 'Redact emails/cards/IBAN/phone' },
  ],
  setupSteps: [
    'Wrap LLM calls: sanitizePrompt → checkRateLimit → checkBudget → generate',
    'Scrub PII before logging any prompt or response',
    'Move rate-limit + budget state to Redis/DB for multi-instance prod',
  ],
})

// ─── Settings ────────────────────────────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'settings',
  name: 'Settings System (store + page + API)',
  category: 'settings',
  stack: 'nextjs',
  summary: 'Typed app settings: file store with atomic writes, Zod schema, masked-API-key route, and a settings page.',
  whenToUse: 'Use for any app where users configure theme, AI mode, API keys, or preferences. Almost every real app needs this.',
  keywords: ['settings', 'config', 'preferences', 'api key', 'theme', 'options', 'configuration'],
  dependencies: ['zod'],
  files: [
    { src: 'settings/settings-store.ts', dest: 'src/lib/settings/store.ts', note: 'Typed atomic JSON store' },
    { src: 'settings/settings-schema.ts', dest: 'src/lib/settings/schema.ts', note: 'Zod schema + defaults' },
    { src: 'settings/settings-route.ts', dest: 'src/app/api/settings/route.ts', note: 'GET (masked) + PATCH' },
    { src: 'settings/SettingsPage.tsx', dest: 'src/app/settings/page.tsx', note: 'Settings UI' },
  ],
  setupSteps: [
    'Extend the Zod schema with your app-specific settings',
    'API keys are masked on GET — never return raw secrets to the client',
    'Swap the file store for your database in production',
  ],
})

// ─── Security Hardening ──────────────────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'security',
  name: 'Security Hardening',
  category: 'security',
  stack: 'nextjs',
  summary: 'Production hardening: startup env validation, security headers, and a guarded API-handler wrapper.',
  whenToUse: 'Use in EVERY production app before launch. Skip only for a local-only throwaway.',
  keywords: ['security', 'hardening', 'headers', 'csp', 'env', 'validation', 'rate limit', 'guard', 'production', 'safe'],
  dependencies: ['zod'],
  files: [
    { src: 'security/env-validation.ts', dest: 'src/lib/security/env-validation.ts', note: 'Validate env at startup' },
    { src: 'security/security-headers.ts', dest: 'src/lib/security/headers.ts', note: 'Recommended security headers' },
    { src: 'security/api-handler.ts', dest: 'src/lib/security/api-handler.ts', note: 'withApiGuards wrapper' },
  ],
  setupSteps: [
    'Call validateEnv() in instrumentation.ts so bad config fails fast',
    'Wire securityHeaders into next.config headers()',
    'Wrap sensitive routes with withApiGuards (rate-limit + auth + body cap)',
  ],
})

// ─── Landing Page ────────────────────────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'landing',
  name: 'Marketing Landing Page',
  category: 'landing',
  stack: 'nextjs',
  summary: 'Conversion-ready landing sections: Hero, Features grid, and Pricing tiers — all prop-driven.',
  whenToUse: 'Use when the app needs a public marketing/home page. Skip for an internal-only tool.',
  keywords: ['landing', 'marketing', 'hero', 'pricing', 'features', 'home', 'public', 'cta', 'conversion'],
  dependencies: ['lucide-react'],
  files: [
    { src: 'landing/Hero.tsx', dest: 'src/components/landing/Hero.tsx', note: 'Hero with CTAs' },
    { src: 'landing/Features.tsx', dest: 'src/components/landing/Features.tsx', note: 'Feature grid' },
    { src: 'landing/Pricing.tsx', dest: 'src/components/landing/Pricing.tsx', note: 'Pricing tiers' },
  ],
  setupSteps: [
    'Compose the sections in your marketing route (e.g. app/(marketing)/page.tsx)',
    'Pass your real copy, features and pricing tiers as props',
    'Pair with the billing block to wire pricing CTAs to checkout',
  ],
})

// ─── Dashboard Widgets ───────────────────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'dashboard',
  name: 'Dashboard Widgets',
  category: 'dashboard',
  stack: 'nextjs',
  summary: 'Data-display building blocks: KPI StatCard, generic typed DataTable (sortable), and EmptyState.',
  whenToUse: 'Use for any dashboard/admin/analytics view. Pairs with the app-shell from the ui-layout block.',
  keywords: ['dashboard', 'table', 'stat', 'kpi', 'chart', 'admin', 'analytics', 'widget', 'metrics', 'data'],
  dependencies: ['lucide-react'],
  files: [
    { src: 'dashboard/StatCard.tsx', dest: 'src/components/dashboard/StatCard.tsx', note: 'KPI card with delta' },
    { src: 'dashboard/DataTable.tsx', dest: 'src/components/dashboard/DataTable.tsx', note: 'Generic sortable table' },
    { src: 'dashboard/EmptyState.tsx', dest: 'src/components/dashboard/EmptyState.tsx', note: 'Reusable empty state' },
  ],
  setupSteps: [
    'Use StatCard for top-of-dashboard KPIs',
    'DataTable<T> is generic — define columns with optional render functions',
    'Show EmptyState whenever a list/table has no rows',
  ],
})

// ─── Forms, Toasts & Modals ──────────────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'forms-toast',
  name: 'Forms, Toasts & Modals',
  category: 'forms-toast',
  stack: 'nextjs',
  summary: 'Interaction essentials: typed useForm hook, a toast notification system, and an accessible modal.',
  whenToUse: 'Use in almost every app — forms, user feedback, and dialogs are universal needs.',
  keywords: ['form', 'toast', 'modal', 'dialog', 'notification', 'validation', 'input', 'feedback', 'alert'],
  dependencies: [],
  files: [
    { src: 'forms-toast/useForm.ts', dest: 'src/hooks/useForm.ts', note: 'Typed form hook with validation' },
    { src: 'forms-toast/ToastProvider.tsx', dest: 'src/components/ToastProvider.tsx', note: 'Toast context + useToast()' },
    { src: 'forms-toast/Modal.tsx', dest: 'src/components/Modal.tsx', note: 'Accessible modal/dialog' },
  ],
  setupSteps: [
    'Wrap the app in <ToastProvider> in the root layout',
    'Use useToast() to show success/error feedback after actions',
    'useForm<T>({ initial, validate }) — pass a Zod-backed validate fn',
  ],
})

// ─── Connector: Email ─────────────────────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'connector-email',
  name: 'Email (Resend / SMTP)',
  category: 'connector-email',
  stack: 'node',
  summary: 'Provider-agnostic transactional email: one sendEmail() call, swap Resend ↔ SMTP ↔ console via env.',
  whenToUse: 'Use when the app sends email — verification, password reset, invites, notifications. Skip for apps that never email users.',
  keywords: ['email', 'mail', 'resend', 'smtp', 'verification', 'password reset', 'invite', 'notification', 'transactional', 'nodemailer'],
  dependencies: ['resend'],
  files: [
    { src: 'connector-email/provider.ts', dest: 'src/lib/email/provider.ts', note: 'EmailProvider interface + console provider' },
    { src: 'connector-email/resend-provider.ts', dest: 'src/lib/email/resend-provider.ts', note: 'Resend implementation' },
    { src: 'connector-email/smtp-provider.ts', dest: 'src/lib/email/smtp-provider.ts', note: 'SMTP fallback (npm i nodemailer)' },
    { src: 'connector-email/index.ts', dest: 'src/lib/email/index.ts', note: 'resolveEmailProvider + sendEmail' },
  ],
  setupSteps: [
    'Set EMAIL_PROVIDER (resend|smtp|console) + EMAIL_FROM; for Resend add RESEND_API_KEY',
    'Call sendEmail({ to, subject, html }) from routes/actions',
    'Default is the console provider — no setup needed in dev',
  ],
})

// ─── Connector: OAuth Login ───────────────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'connector-oauth',
  name: 'OAuth Login (Google / GitHub)',
  category: 'connector-oauth',
  stack: 'nextjs',
  summary: 'Dependency-free OAuth 2.0 social sign-in for Google + GitHub, sharing the credentials Auth block session.',
  whenToUse: 'Use to add "Continue with Google/GitHub" alongside the credentials Auth block. Skip if email/password (or no auth) is enough.',
  keywords: ['oauth', 'social login', 'google', 'github', 'sign in', 'sso', 'login with', 'authorization'],
  dependencies: [],
  files: [
    { src: 'connector-oauth/providers.ts', dest: 'src/lib/oauth/providers.ts', note: 'Provider config + authorize/token/profile helpers' },
    { src: 'connector-oauth/start-route.ts', dest: 'src/app/api/auth/oauth/[provider]/route.ts', note: 'Redirect to consent screen' },
    { src: 'connector-oauth/callback-route.ts', dest: 'src/app/api/auth/oauth/[provider]/callback/route.ts', note: 'Exchange code → session (ADAPT to your auth/db)' },
  ],
  setupSteps: [
    'Set OAUTH_REDIRECT_BASE + GOOGLE_/GITHUB_CLIENT_ID/SECRET',
    'Adapt callback-route.ts: upsert user (db block) + mint session (auth block)',
    'Add buttons linking to /api/auth/oauth/google and /github',
  ],
})

// ─── Connector: File Storage ──────────────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'connector-storage',
  name: 'File Storage (S3 / R2 / local)',
  category: 'connector-storage',
  stack: 'node',
  summary: 'Provider-agnostic object storage for uploads/attachments: storage().put/get/url, swap S3/R2 ↔ local disk via env.',
  whenToUse: 'Use when users upload files — avatars, attachments, documents, images. Skip for apps with no file uploads.',
  keywords: ['storage', 'upload', 'file', 'attachment', 'avatar', 'image', 's3', 'r2', 'bucket', 'document', 'media'],
  dependencies: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
  files: [
    { src: 'connector-storage/provider.ts', dest: 'src/lib/storage/provider.ts', note: 'StorageProvider interface + safeKey' },
    { src: 'connector-storage/local-provider.ts', dest: 'src/lib/storage/local-provider.ts', note: 'Local-disk default (zero config)' },
    { src: 'connector-storage/s3-provider.ts', dest: 'src/lib/storage/s3-provider.ts', note: 'S3/R2/MinIO implementation' },
    { src: 'connector-storage/index.ts', dest: 'src/lib/storage/index.ts', note: 'storage() resolver' },
  ],
  setupSteps: [
    'Default is local disk — set STORAGE_LOCAL_DIR + STORAGE_PUBLIC_BASE',
    'For S3/R2 set STORAGE_PROVIDER=s3 + S3_BUCKET/REGION/keys (+ S3_ENDPOINT for R2)',
    'Use safeKey(prefix, filename) before put() to sanitize user filenames',
  ],
})

// ─── Connector: Postgres / Supabase ───────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'connector-supabase',
  name: 'Postgres / Supabase DB',
  category: 'connector-supabase',
  stack: 'node',
  summary: 'Move the SQLite default to Postgres/Supabase with a one-block Prisma datasource swap — models/queries unchanged.',
  whenToUse: 'Use when the app needs hosted Postgres, multi-user cloud, Supabase Realtime/Storage, or Row-Level Security. Stay on SQLite (database block) for local-first.',
  keywords: ['postgres', 'postgresql', 'supabase', 'cloud database', 'hosted', 'realtime', 'rls', 'pgvector', 'production database'],
  dependencies: ['@supabase/supabase-js'],
  files: [
    { src: 'connector-supabase/datasource.prisma', dest: 'prisma/_datasource-postgres.prisma', note: 'Swap-in datasource block for schema.prisma' },
    { src: 'connector-supabase/client.ts', dest: 'src/lib/supabase/client.ts', note: 'Supabase client (Storage/Realtime/RLS only)' },
  ],
  setupSteps: [
    'Replace the datasource block in prisma/schema.prisma with the Postgres one',
    'Set DATABASE_URL (pooled :6543) + DIRECT_URL (:5432) to your Supabase string',
    'Run prisma migrate deploy && prisma generate — models stay identical',
  ],
})

// ─── Connector: Notifications ─────────────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'connector-notify',
  name: 'Notifications (Slack / Webhook)',
  category: 'connector-notify',
  stack: 'node',
  summary: 'Provider-agnostic outbound notifications: one notify() call, route to Slack, a signed webhook, or console via env.',
  whenToUse: 'Use for ops alerts, signup/churn pings, or job/build completion notices. Skip if the app never notifies external channels.',
  keywords: ['notify', 'notification', 'slack', 'webhook', 'alert', 'ping', 'ops', 'channel'],
  dependencies: [],
  files: [
    { src: 'connector-notify/provider.ts', dest: 'src/lib/notify/provider.ts', note: 'Notifier interface + console provider' },
    { src: 'connector-notify/slack.ts', dest: 'src/lib/notify/slack.ts', note: 'Slack incoming webhook' },
    { src: 'connector-notify/webhook.ts', dest: 'src/lib/notify/webhook.ts', note: 'Generic webhook + HMAC signature' },
    { src: 'connector-notify/index.ts', dest: 'src/lib/notify/index.ts', note: 'resolveNotifyProvider + notify()' },
  ],
  setupSteps: [
    'Set NOTIFY_PROVIDER (slack|webhook|console); for Slack add SLACK_WEBHOOK_URL',
    'Call notify({ title, level, context }) from routes/actions',
    'Default is the console provider — no setup in dev',
  ],
})

// ─── Connector: Realtime (SSE) ────────────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'connector-realtime',
  name: 'Realtime (Server-Sent Events)',
  category: 'connector-realtime',
  stack: 'nextjs',
  summary: 'Push live updates to the browser via SSE — zero-dep in-process pub/sub broker + stream route + client hook.',
  whenToUse: 'Use for live boards/dashboards, presence, or instant notifications. Skip for fully static or request/response-only apps.',
  keywords: ['realtime', 'live', 'sse', 'server-sent events', 'stream', 'presence', 'push', 'subscribe', 'websocket'],
  dependencies: [],
  files: [
    { src: 'connector-realtime/broker.ts', dest: 'src/lib/realtime/broker.ts', note: 'In-process pub/sub (hot-reload safe)' },
    { src: 'connector-realtime/sse-route.ts', dest: 'src/app/api/realtime/[channel]/route.ts', note: 'SSE stream endpoint' },
    { src: 'connector-realtime/useEventStream.ts', dest: 'src/lib/realtime/useEventStream.ts', note: 'Client hook' },
  ],
  setupSteps: [
    'After a mutation: broker.publish(channel, type, data)',
    'Client: useEventStream(url, eventType) to receive',
    'Auth + authorize the channel in the route; back publish() with Redis for multi-instance',
  ],
})

// ─── Connector: Analytics ─────────────────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'connector-analytics',
  name: 'Product Analytics (PostHog)',
  category: 'connector-analytics',
  stack: 'node',
  summary: 'Provider-agnostic product analytics: track()/identify() via PostHog HTTP API (EU host by default) or console.',
  whenToUse: 'Use to measure feature usage, funnels, and retention. Skip for an internal tool or a privacy-only app with no tracking.',
  keywords: ['analytics', 'tracking', 'posthog', 'plausible', 'metrics', 'events', 'funnel', 'retention', 'telemetry'],
  dependencies: [],
  files: [
    { src: 'connector-analytics/provider.ts', dest: 'src/lib/analytics/provider.ts', note: 'Analytics interface + console provider' },
    { src: 'connector-analytics/posthog.ts', dest: 'src/lib/analytics/posthog.ts', note: 'PostHog HTTP capture (no SDK)' },
    { src: 'connector-analytics/index.ts', dest: 'src/lib/analytics/index.ts', note: 'analytics() resolver' },
  ],
  setupSteps: [
    'Set ANALYTICS_PROVIDER (posthog|console); for PostHog add POSTHOG_KEY (+ POSTHOG_HOST)',
    'Call analytics().track({ name, distinctId, properties }) server-side',
    'Default is the console provider — no setup in dev',
  ],
})

// ─── Connector: Scheduled Jobs / Cron ─────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'connector-jobs',
  name: 'Scheduled Jobs / Cron',
  category: 'connector-jobs',
  stack: 'nextjs',
  summary: 'Named background jobs behind a Bearer-secured cron endpoint: register a job, schedule it, run by name.',
  whenToUse: 'Use for recurring work — expiring invites, digests, usage rollups, cleanup, retries. Skip if nothing runs on a schedule.',
  keywords: ['cron', 'job', 'scheduled', 'background', 'recurring', 'digest', 'cleanup', 'rollup', 'task queue'],
  dependencies: [],
  files: [
    { src: 'connector-jobs/registry.ts', dest: 'src/lib/jobs/registry.ts', note: 'registerJob/getJob/listJobs' },
    { src: 'connector-jobs/route.ts', dest: 'src/app/api/cron/[job]/route.ts', note: 'Bearer-secured runner (GET+POST)' },
  ],
  setupSteps: [
    'Register jobs: registerJob({ name, schedule, run })',
    'Set CRON_SECRET; schedule each job (vercel.json crons or external pinger)',
    'Hit /api/cron/<job> with Authorization: Bearer CRON_SECRET',
  ],
})

// ─── Connector: Search ────────────────────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'connector-search',
  name: 'Full-Text Search (Meilisearch / in-memory)',
  category: 'connector-search',
  stack: 'node',
  summary: 'Provider-agnostic full-text search: index() + search() over your docs, in-memory TF-IDF by default or Meilisearch via env.',
  whenToUse: 'Use when users need to search across records (tasks, docs, products). Skip if a simple DB WHERE/LIKE is enough.',
  keywords: ['search', 'full-text', 'fulltext', 'meilisearch', 'index', 'query', 'find', 'autocomplete', 'fuzzy'],
  dependencies: [],
  files: [
    { src: 'connector-search/provider.ts', dest: 'src/lib/search/provider.ts', note: 'SearchProvider interface + tokenize' },
    { src: 'connector-search/memory-provider.ts', dest: 'src/lib/search/memory-provider.ts', note: 'Zero-dep TF-IDF default' },
    { src: 'connector-search/meilisearch.ts', dest: 'src/lib/search/meilisearch.ts', note: 'Meilisearch HTTP provider' },
    { src: 'connector-search/index.ts', dest: 'src/lib/search/index.ts', note: 'search() resolver' },
  ],
  setupSteps: [
    'Set SEARCH_PROVIDER (memory|meilisearch); for Meili add MEILI_HOST + MEILI_KEY',
    'Index after writes: search().index(namespace, docs)',
    'Default is in-memory — no setup in dev; consider SQLite FTS5 for DB-native search',
  ],
})

// ─── Connector: SMS ───────────────────────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'connector-sms',
  name: 'SMS (Twilio)',
  category: 'connector-sms',
  stack: 'node',
  summary: 'Provider-agnostic SMS for OTP codes, alerts and reminders: one sendSms() call, Twilio REST or console via env.',
  whenToUse: 'Use for phone verification / 2FA codes or SMS alerts. Skip if the app has no phone-based flows.',
  keywords: ['sms', 'text message', 'twilio', 'otp', 'two-factor', '2fa', 'phone', 'verification code'],
  dependencies: [],
  files: [
    { src: 'connector-sms/provider.ts', dest: 'src/lib/sms/provider.ts', note: 'SmsProvider interface + console provider' },
    { src: 'connector-sms/twilio.ts', dest: 'src/lib/sms/twilio.ts', note: 'Twilio REST (no SDK)' },
    { src: 'connector-sms/index.ts', dest: 'src/lib/sms/index.ts', note: 'sendSms() resolver' },
  ],
  setupSteps: [
    'Set SMS_PROVIDER (twilio|console); for Twilio add TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM',
    'Call sendSms({ to, body }) with E.164 numbers',
    'Default is the console provider — no setup in dev',
  ],
})

// ─── Connector: PDF ───────────────────────────────────────────────────────────
BUILDING_BLOCKS.push({
  id: 'connector-pdf',
  name: 'PDF Generation (invoices / reports)',
  category: 'connector-pdf',
  stack: 'node',
  summary: 'Generate invoices, receipts and reports as real PDFs (title, meta, table, totals) with pdf-lib — no headless browser.',
  whenToUse: 'Use when the app issues invoices, receipts, or downloadable reports. Skip if no documents are generated.',
  keywords: ['pdf', 'invoice', 'receipt', 'report', 'document', 'download', 'export', 'billing document'],
  dependencies: ['pdf-lib'],
  files: [
    { src: 'connector-pdf/document.ts', dest: 'src/lib/pdf/document.ts', note: 'renderPdf(spec) → PDF bytes' },
    { src: 'connector-pdf/route.ts', dest: 'src/app/api/documents/[id]/pdf/route.ts', note: 'Example download route (adapt)' },
  ],
  setupSteps: [
    'npm i pdf-lib',
    'Map your record into a PdfDocSpec and call renderPdf()',
    'Stream as application/pdf or archive via the storage connector',
  ],
})

export function getBlock(id: string): BuildingBlock | undefined {
  return BUILDING_BLOCKS.find(b => b.id === id)
}

export function getBlocksByCategory(category: BlockCategory): BuildingBlock[] {
  return BUILDING_BLOCKS.filter(b => b.category === category)
}
