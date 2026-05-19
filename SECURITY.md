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
