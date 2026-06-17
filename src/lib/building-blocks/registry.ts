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

export function getBlock(id: string): BuildingBlock | undefined {
  return BUILDING_BLOCKS.find(b => b.id === id)
}

export function getBlocksByCategory(category: BlockCategory): BuildingBlock[] {
  return BUILDING_BLOCKS.filter(b => b.category === category)
}
