/**
 * Agent Knowledge Packages — domain expertise injected into every agent run.
 *
 * Each package is a curated block of engineering best-practices that an expert
 * developer would know. Packages are auto-selected based on goal keywords and
 * skillCategory, then injected into buildPrompt() so the agent has the right
 * mental model before it writes a single line of code.
 */

export type KnowledgeDomain =
  | 'nextjs'
  | 'typescript'
  | 'react'
  | 'testing'
  | 'architecture'
  | 'api'
  | 'database'
  | 'css'
  | 'performance'
  | 'security'

// ─── Domain packages ─────────────────────────────────────────────────────────

const PACKAGES: Record<KnowledgeDomain, string> = {

  nextjs: `
## Engineering Knowledge: Next.js App Router
- Use Server Components by default; add 'use client' only when browser APIs or state are needed
- Route handlers (route.ts): export ONLY GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS — any other export breaks the build
- Dynamic routes need \`export const dynamic = 'force-dynamic'\` when they depend on request data
- Never \`import\` server-side modules (fs, child_process) in 'use client' components
- Prefer \`fetch\` with \`cache: 'no-store'\` over \`getServerSideProps\` patterns
- API responses: always return \`NextResponse.json()\` with explicit status codes
- File-based routing: \`page.tsx\` for pages, \`layout.tsx\` for layouts, \`loading.tsx\` for suspense
- Environment variables: NEXT_PUBLIC_* for client, plain for server-only
- Use \`useRouter\` from 'next/navigation' (App Router), not 'next/router'
`,

  typescript: `
## Engineering Knowledge: TypeScript Strict
- Never use \`any\` — use \`unknown\` and narrow with type guards, or define precise types
- Prefer interfaces for object shapes, type aliases for unions/intersections
- Use \`satisfies\` operator to validate literals while preserving narrowed type
- Discriminated unions over optional fields: \`{ status: 'ok'; data: T } | { status: 'error'; error: string }\`
- \`as\` casts are a code smell — if you need one, you likely need a type guard instead
- Generic constraints: \`<T extends SomeType>\` beats \`T = any\`
- Use \`Readonly<T>\`, \`ReadonlyArray<T>\` for data that should not be mutated
- Avoid enums — use string literal unions: \`type Status = 'pending' | 'approved' | 'running'\`
- Barrel exports (\`index.ts\`) hide dependency structure — prefer direct imports in library code
`,

  react: `
## Engineering Knowledge: React
- Keep components small: one concept per component, max ~150 lines
- Co-locate state as close to usage as possible — lift only when siblings need it
- Avoid \`useEffect\` for derived state — compute it during render instead
- \`useEffect\` dependency arrays must be exhaustive — the linter rule exists for a reason
- Custom hooks (\`useXxx\`) are the right abstraction for reusable stateful logic
- Never call setState inside render — it creates infinite loops
- Keys in lists must be stable IDs, not array indices (indices break reconciliation)
- Memoize (\`useMemo\`, \`useCallback\`) only when profiling shows it helps — premature optimization hurts readability
- Error boundaries wrap async-loaded sections; \`Suspense\` wraps async components
- Event handlers: onClick={() => fn()} vs onClick={fn} — use the shorter form unless you need to pass args
`,

  testing: `
## Engineering Knowledge: Testing with Vitest
- Test behavior, not implementation — tests should survive refactors
- Arrange-Act-Assert structure: setup → execute → verify
- One logical assertion per test case; multiple \`expect()\` calls are fine when checking the same behavior
- Mock at the boundary: mock fs, fetch, databases — not internal functions
- \`vi.mock('module')\` hoists to the top; use \`vi.importActual\` to keep real implementations where needed
- \`vi.spyOn\` for verifying side effects; restore with \`vi.restoreAllMocks()\` in afterEach
- Test file naming: \`*.test.ts\` alongside the source, or \`*.spec.ts\` for integration tests
- Cover: happy path, error path, edge cases (empty, null, boundary values)
- Never test private implementation — only the public surface
- Integration tests that touch real files or real DBs are more valuable than unit tests with heavy mocks
`,

  architecture: `
## Engineering Knowledge: Software Architecture
- Single Responsibility: each module/function does one thing and has one reason to change
- Dependency direction: UI → Business Logic → Data — never reverse this
- Parse, don't validate: convert untrusted input into typed domain objects at the boundary
- Fail fast: validate inputs at entry points, trust internal types thereafter
- Prefer composition over inheritance — small focused interfaces beat deep class hierarchies
- Make illegal states unrepresentable with types instead of runtime checks
- Side effects belong at the edges: pure core logic, effectful shell
- Name things by what they are, not what they do: \`UserRepository\` not \`UserManager\`
- Avoid shared mutable state — pass data explicitly or use event-driven patterns
- Coupling is not bad; unexpected coupling is bad — make dependencies visible
`,

  api: `
## Engineering Knowledge: API Design
- REST: nouns in URLs (/users/123), verbs via HTTP methods (GET/POST/PUT/PATCH/DELETE)
- Status codes: 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable, 500 Internal Error
- Never swallow errors — log with context, return meaningful error responses
- Idempotent operations (PUT, DELETE) should be safe to retry
- Validate input at the API boundary with zod or similar — never trust client data
- Return consistent shapes: \`{ data: T }\` on success, \`{ error: string }\` on failure
- Use query params for filtering/pagination, body for mutations
- Rate limit expensive endpoints; return 429 with Retry-After header
- CORS: configure explicitly, never use wildcard (*) in production with credentials
`,

  database: `
## Engineering Knowledge: Data Persistence
- Prefer atomic writes: write to a temp file, then rename — never partially-written state
- JSON files as a database: read → modify → write is not atomic; use file locking for concurrent access
- Index what you query: if you filter by status, have an index on status
- Pagination: never load all records into memory — use cursor-based or offset pagination
- Soft deletes (mark as deleted) beat hard deletes for audit trails and recovery
- Validate data shape on read, not just write — stored data can be stale
- Migrations: always forward-only, never destructive without explicit backup step
- Connection pools: size to (2 × CPU cores + 1) as a starting point
`,

  css: `
## Engineering Knowledge: Tailwind CSS
- Utility-first: avoid custom CSS unless Tailwind has no utility for it
- Group related utilities logically: layout, spacing, typography, color, state
- Use \`cn()\` or \`clsx()\` to compose conditional classes cleanly
- Design tokens via Tailwind config (\`tailwind.config.ts\`) — never hardcode colors
- Dark mode: use \`dark:\` variant consistently, not one-off overrides
- Responsive: mobile-first — base styles apply to mobile, prefix larger breakpoints (\`md:\`, \`lg:\`)
- Extract components (not classes) when a pattern repeats — \`@apply\` leads to specificity issues
- Avoid arbitrary values (\`[123px]\`) except for one-off cases that don't need a token
`,

  performance: `
## Engineering Knowledge: Performance
- Measure before optimizing — gut feeling is wrong 80% of the time
- The fastest code is code that doesn't run — remove unnecessary work first
- Lazy load: code-split large components/routes with \`dynamic()\` in Next.js
- Avoid waterfalls: parallel \`Promise.all\` beats sequential awaits
- Memoize expensive computations (\`useMemo\`) only after profiling confirms the cost
- Images: always specify width/height, use \`next/image\` for automatic optimization
- Bundle size: check with \`@next/bundle-analyzer\` before and after large dependency additions
- Database: N+1 queries are the most common bottleneck — batch or join instead
`,

  security: `
## Engineering Knowledge: Security
- Never trust user input — validate type, range, length, format at every entry point
- SQL injection: use parameterized queries, never string concatenation
- XSS: escape HTML output, use CSP headers, avoid \`dangerouslySetInnerHTML\`
- Secrets: never in code or git — use environment variables, never log them
- CSRF: use SameSite cookies and CSRF tokens for state-changing requests
- Dependency audit: \`npm audit\` before every release
- Authentication: hash passwords with bcrypt/argon2 (min cost factor 12), never MD5/SHA1
- Authorization: check permissions on every server action, not just UI visibility
- HTTPS everywhere: redirect HTTP to HTTPS, use HSTS headers
`,
}

// ─── Keyword → domain mapping ─────────────────────────────────────────────────

const KEYWORD_MAP: Array<{ keywords: string[]; domain: KnowledgeDomain }> = [
  { keywords: ['next.js', 'nextjs', 'app router', 'route.ts', 'page.tsx', 'layout', 'middleware'], domain: 'nextjs' },
  { keywords: ['typescript', 'type', 'interface', 'generic', 'infer', 'narrowing', 'assertion'], domain: 'typescript' },
  { keywords: ['react', 'component', 'hook', 'usestate', 'useeffect', 'context', 'jsx', 'tsx'], domain: 'react' },
  { keywords: ['test', 'vitest', 'jest', 'spec', 'mock', 'coverage', 'assertion', 'unit', 'integration'], domain: 'testing' },
  { keywords: ['architecture', 'refactor', 'restructure', 'design', 'pattern', 'solid', 'dependency', 'module'], domain: 'architecture' },
  { keywords: ['api', 'endpoint', 'route', 'rest', 'http', 'request', 'response', 'fetch', 'webhook'], domain: 'api' },
  { keywords: ['database', 'json', 'store', 'persist', 'storage', 'file', 'write', 'read', 'save'], domain: 'database' },
  { keywords: ['style', 'tailwind', 'css', 'design', 'ui', 'layout', 'color', 'theme', 'responsive'], domain: 'css' },
  { keywords: ['performance', 'speed', 'optimize', 'slow', 'bundle', 'cache', 'lazy', 'load'], domain: 'performance' },
  { keywords: ['auth', 'security', 'permission', 'token', 'secret', 'password', 'xss', 'csrf', 'injection'], domain: 'security' },
]

// ─── Skill category → domain mapping ─────────────────────────────────────────

const SKILL_DOMAIN_MAP: Record<string, KnowledgeDomain[]> = {
  'api-route':     ['nextjs', 'api', 'typescript'],
  'ui-component':  ['react', 'css', 'typescript'],
  'data-model':    ['typescript', 'database'],
  'test':          ['testing'],
  'refactor':      ['architecture', 'typescript'],
  'infrastructure':['database', 'security'],
  'documentation': [],
}

/**
 * Select which knowledge domains are relevant for this goal + skill.
 * Returns at most 3 domains to keep the prompt lean.
 */
export function selectDomains(
  goal: string,
  context: string,
  skillCategory?: string,
): KnowledgeDomain[] {
  const text = `${goal} ${context}`.toLowerCase()
  const found = new Set<KnowledgeDomain>()

  // Skill category has highest priority
  if (skillCategory && SKILL_DOMAIN_MAP[skillCategory]) {
    for (const d of SKILL_DOMAIN_MAP[skillCategory]) found.add(d)
  }

  // Keyword scan
  for (const { keywords, domain } of KEYWORD_MAP) {
    if (found.has(domain)) continue
    if (keywords.some(k => text.includes(k))) {
      found.add(domain)
    }
  }

  // Always include typescript for code tasks
  found.add('typescript')

  return Array.from(found).slice(0, 3)
}

/**
 * Build the knowledge block to inject into the agent system prompt.
 */
export function buildKnowledgeBlock(
  goal: string,
  context: string,
  skillCategory?: string,
): string {
  const domains = selectDomains(goal, context, skillCategory)
  if (domains.length === 0) return ''

  const blocks = domains.map(d => PACKAGES[d]).join('\n')
  return `\n---\n${blocks}`
}
