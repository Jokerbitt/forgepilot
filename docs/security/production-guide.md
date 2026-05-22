# ForgePilot — Production Security Guide

## Quick Start Checklist

Before running ForgePilot in any environment that is reachable from a network:

- [ ] `NEXTAUTH_SECRET` set to a randomly generated 32+ character string
- [ ] `FORGEPILOT_ADMIN_PASSWORD` set to a strong password (12+ characters)
- [ ] `NEXTAUTH_URL` set to your actual deployment URL (https:// in production)
- [ ] `FORGEPILOT_AUTH_DISABLED` is NOT set (or set to `false`)
- [ ] `/api/ready` returns `auth_security: pass`

---

## Required Environment Variables

### NEXTAUTH_SECRET

Signing key for JWT session tokens. Must be random, at least 32 characters.

```bash
# Generate a secure value:
openssl rand -base64 32
```

```env
NEXTAUTH_SECRET=<output of above command>
```

**Never use the placeholder value** `generate-with-openssl-rand-base64-32` — it is a known string and provides zero security.

### FORGEPILOT_ADMIN_PASSWORD

Password for the single admin account. Minimum 12 characters.

```env
FORGEPILOT_ADMIN_PASSWORD=YourStrongPassword2026!
```

- Use a password manager to generate it
- Minimum 12 characters, recommend 20+
- The runtime warns in logs if the password is too short

### NEXTAUTH_URL

Must match the exact URL users access ForgePilot from. Required for OAuth redirects and cookie scoping.

```env
# Local dev:
NEXTAUTH_URL=http://localhost:3000

# NAS deployment:
NEXTAUTH_URL=http://192.168.1.100:3000

# Production with domain + HTTPS:
NEXTAUTH_URL=https://forgepilot.yourdomain.com
```

In production, this must use `https://`. The readiness probe will flag it as a security issue otherwise.

---

## Auth Bypass (Development Only)

To disable auth in local development:

```env
FORGEPILOT_AUTH_DISABLED=true
```

This setting is **blocked in production** (`NODE_ENV=production` or `VERCEL_ENV=production`). Even if accidentally set, the middleware enforces auth in production environments.

---

## API Key Authentication (Machine-to-Machine)

For automated scripts, n8n, or CLI access:

```env
FORGEPILOT_API_KEY=your-long-random-api-key
```

When set, all `/api/` routes require:
```
Authorization: Bearer <your-api-key>
```

Excluded routes (always public regardless of API key):
- `/api/health`
- `/api/ready`
- `/api/intake` (n8n webhook)
- `/api/cron/*`
- `/api/webhooks/*`
- `/api/telegram/webhook`

---

## Verifying Your Security Configuration

The readiness probe at `/api/ready` includes an `auth_security` check:

```bash
curl http://localhost:3000/api/ready | jq '.checks[] | select(.name == "auth_security")'
```

Expected output when correctly configured:
```json
{
  "name": "auth_security",
  "status": "pass",
  "message": "Auth credentials meet security requirements"
}
```

If it shows `warn` or `fail`, the `message` field lists the specific issues to fix.

---

## Docker Deployment

Pass secrets via environment variables, never via `docker-compose.yml` committed to git:

```bash
# .env.production (git-ignored, lives on the NAS)
NEXTAUTH_SECRET=<generated>
NEXTAUTH_URL=http://192.168.1.100:3000
FORGEPILOT_ADMIN_PASSWORD=<strong password>
```

```yaml
# docker-compose.yml — references .env file, no inline secrets
services:
  forgepilot:
    env_file:
      - .env.production
```

---

## Security Architecture

| Layer | Mechanism |
|---|---|
| Middleware | JWT token check on every request via `getToken()` |
| API routes | `requireAuth()` defense-in-depth guard |
| Password validation | `timingSafeEqual` (no timing attacks) |
| Production bypass prevention | `isProductionRuntime()` blocks `FORGEPILOT_AUTH_DISABLED` in prod |
| Placeholder detection | `isAuthSecure()` rejects known-bad placeholder values |
| Readiness probe | `/api/ready` fails in production if auth is misconfigured |
| Rate limiting | 429 responses for excessive mutations |
| Body size limit | 10 MB cap enforced in middleware |
