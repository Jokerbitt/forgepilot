<!-- Security checklist for the app. Destination: docs/security.md (or repo root). -->

# Security Checklist

Actionable baseline for a Next.js 15 / TypeScript app. Treat unchecked items as
release blockers.

## Environment & secrets

- [ ] **Validate env at startup** with `validateEnv()` (`security/env-validation.ts`),
      imported from `instrumentation.ts`. Boot must fail loudly on misconfiguration.
- [ ] **No secrets in the client bundle.** Only `NEXT_PUBLIC_*` vars reach the
      browser — never prefix an API key or DB URL with `NEXT_PUBLIC_`.
- [ ] **No secrets in source control.** `.env*` is gitignored; rotate any key that
      ever landed in a commit.
- [ ] **No secrets in logs.** Mask keys/tokens before logging (see GET masking in
      the settings route).

## HTTP hardening

- [ ] **Security headers** applied app-wide via `next.config` `headers()`
      (`security/security-headers.ts`): CSP, `X-Frame-Options: DENY`,
      `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS, `Permissions-Policy`.
- [ ] **Tighten the CSP** — replace `'unsafe-inline'` with nonces/hashes; scope
      `connect-src`/`img-src` to the origins you actually use.
- [ ] **HTTPS only** in production; HSTS preload once verified.

## API routes

- [ ] **Wrap handlers** with `withApiGuards` (`security/api-handler.ts`) for
      consistent error handling, body-size caps, auth, and rate-limit hooks.
- [ ] **Rate limit** sensitive and unauthenticated endpoints (login, AI calls,
      uploads).
- [ ] **Authn/authz** checked on every protected route — never trust the client.
- [ ] **Errors never leak internals** — return generic messages; log details
      server-side only.

## Input validation

- [ ] **Zod everywhere** untrusted data enters: request bodies, query params,
      route params, webhook payloads, and external API responses.
- [ ] **Parse, don't assume** — narrow `unknown`, never cast with `as` to skip checks.
- [ ] **Escape/parameterize** all DB queries (use the ORM/driver's parameter binding,
      never string interpolation).

## Dependencies & supply chain

- [ ] **Audit regularly** — `npm audit` / `pnpm audit` in CI; fail on high/critical.
- [ ] **Lockfile committed**; enable Dependabot/Renovate for patch updates.
- [ ] **Minimize dependencies**; review new ones before adding.

## Before every release

- [ ] `npm audit` clean (or accepted).
- [ ] No new `NEXT_PUBLIC_*` secrets.
- [ ] Env schema covers all required vars.
- [ ] Headers present on a deployed preview (check response in DevTools).
