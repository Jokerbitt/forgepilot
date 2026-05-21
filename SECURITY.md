# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| `main` branch | ✅ Active |
| older branches | ❌ No security updates |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in ForgePilot, please report it responsibly by emailing **sven.bittl@gmx.de** with:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fix (optional but appreciated)

You will receive a response within **48 hours**. We will work with you to understand and address the issue before any public disclosure.

## Security Design Principles

ForgePilot is built with security as a first-class concern:

- **Local-first**: all data stays on your own hardware by default
- **No telemetry**: ForgePilot does not phone home — Sentry and OTel are opt-in via env vars
- **API key isolation**: keys are stored in `config/api-keys.json` on your own filesystem, never transmitted to ForgePilot servers
- **PII scrubbing**: the Context Engineer automatically redacts emails, phone numbers, and personal identifiers before any AI call
- **Zod validation**: all API routes validate input — malformed requests are rejected before processing
- **GDPR-by-design**: processing ledger, retention cleanup, and right to erasure are built into the core

## Scope

In scope for security reports:
- Authentication bypasses
- Data leakage between users (when multi-user auth is active)
- API routes accessible without authentication
- Dependency vulnerabilities with a known exploit
- XSS, CSRF, or injection vulnerabilities

Out of scope:
- Vulnerabilities in self-hosted infrastructure not related to ForgePilot code
- Social engineering attacks
- Denial of service on self-hosted instances

## Accepted Dev-Only Vulnerabilities (npm audit)

The following vulnerabilities are known and **accepted** because they affect development tooling only and have no impact on production deployments:

| Package | Advisory | Severity | Reason accepted |
|---|---|---|---|
| `esbuild <=0.24.2` | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) | Moderate | Dev server only (Vite/Vitest). Not shipped to production. Fix requires `vitest` major version bump — deferred. |
| `vite <=6.4.1` | Depends on vulnerable esbuild | Moderate | Dev dependency only. Same as above. |
| `vitest / vite-node <=2.2.0-beta.2` | Depends on vulnerable vite | Moderate | Test runner only. Not in production bundle. |
| `postcss <8.5.10` | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | Moderate | Pulled in by `next` internally. Direct fix requires downgrading Next.js to a pre-release version — not acceptable. Will be resolved in a future Next.js patch release. |

**Last reviewed:** 2026-05-21 — `npm audit fix` (without `--force`) was run and resolved all auto-fixable issues. Remaining 9 moderate advisories require breaking changes and are tracked here.
