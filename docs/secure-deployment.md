# Secure Deployment Guide

ForgePilot is designed to run on your machine or NAS. Because it manages agent executions and API keys, correct auth configuration is essential before exposing it on any network.

---

## Minimum Required Environment Variables

```bash
# Required — generate with: openssl rand -base64 32
NEXTAUTH_SECRET=<random-32-bytes>
NEXTAUTH_URL=http://localhost:3000

# Required — your login password
FORGEPILOT_ADMIN_PASSWORD=<strong-password>

# At least one AI provider key
ANTHROPIC_API_KEY=sk-ant-...
```

Without `NEXTAUTH_SECRET` and `FORGEPILOT_ADMIN_PASSWORD`, the app will refuse to start in production mode.

---

## Auth Modes

| Mode | `FORGEPILOT_AUTH_DISABLED` | When to use |
|---|---|---|
| **Enabled (default)** | unset or `false` | All deployments — NAS, Docker, cloud |
| **Disabled (dev only)** | `true` | Local dev only — blocked in `NODE_ENV=production` |

Setting `FORGEPILOT_AUTH_DISABLED=true` in production has no effect — the middleware enforces auth regardless. This is intentional and cannot be bypassed via env var in production.

---

## Generating a Secure Secret

```bash
# macOS / Linux
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Use a **different secret** for each environment (dev, staging, production). Rotating the secret invalidates all existing sessions.

---

## Local Development (localhost only)

```bash
cp .env.example .env.local
# Edit .env.local and set NEXTAUTH_SECRET + FORGEPILOT_ADMIN_PASSWORD
npm install
npm run dev
```

The dev server binds to `localhost:3000` by default. No firewall change needed.

---

## NAS / Docker Deployment

```bash
# 1. Copy and configure
cp .env.example .env.production
# Set NEXTAUTH_SECRET, FORGEPILOT_ADMIN_PASSWORD, NEXTAUTH_URL (your NAS URL), DATABASE_URL

# 2. Start with Postgres
docker-compose up -d

# 3. Run migrations
npm run db:migrate

# 4. Verify storage
curl http://localhost:3000/api/storage-status
```

### Reverse Proxy (nginx / Caddy)

Always terminate TLS at the proxy — never expose the Next.js port directly.

```nginx
server {
    listen 443 ssl;
    server_name forgepilot.yourdomain.local;

    ssl_certificate     /etc/ssl/certs/forgepilot.crt;
    ssl_certificate_key /etc/ssl/private/forgepilot.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Set `NEXTAUTH_URL=https://forgepilot.yourdomain.local` to match.

---

## Security Layers (Active by Default)

The middleware stack enforces these checks on every request:

| Layer | What it does |
|---|---|
| Request-ID | Attaches `x-request-id` to every request for log correlation |
| Body size guard | Returns 413 if request body exceeds 10 MB |
| Rate limiting | 100 requests / 60s per IP on API routes; 429 on excess |
| API key auth | `Authorization: Bearer <FORGEPILOT_API_KEY>` required when `FORGEPILOT_API_KEY` is set |
| Session auth | All non-public routes require a valid NextAuth session |

Public routes that bypass auth (webhooks and health checks):
- `/api/health`
- `/api/webhooks/linear`
- `/api/webhooks/github`
- `/api/intake`
- `/login`
- `/setup`

---

## Rate Limiting

Default: 100 requests per 60-second window per IP. Adjust with:

```bash
RATE_LIMIT_MAX=200         # requests per window
RATE_LIMIT_WINDOW_MS=60000 # window in milliseconds
```

---

## API Key for Automation

For n8n, external scripts, or CI pipelines calling ForgePilot APIs:

```bash
FORGEPILOT_API_KEY=<random-token>
```

Pass the key in requests:
```bash
curl -H "Authorization: Bearer $FORGEPILOT_API_KEY" http://localhost:3000/api/delegations
```

Webhooks from Linear and GitHub do not require this header — they use HMAC signature verification instead.

---

## Secrets Never to Commit

`.env.local` and `.env.production` are in `.gitignore`. Never commit:
- `NEXTAUTH_SECRET`
- `FORGEPILOT_ADMIN_PASSWORD`
- `FORGEPILOT_API_KEY`
- Any provider API key (`ANTHROPIC_API_KEY`, `XAI_API_KEY`, etc.)

Use `.env.example` as the template — it contains only placeholder values.

---

## Readiness Check

After deployment, verify all security layers are active:

```bash
curl http://localhost:3000/api/auth/readiness
# Expect: { "authEnabled": true, "secretSet": true, "adminPasswordSet": true }

curl http://localhost:3000/api/readiness
# Expect: no critical gaps in the readiness report
```

If `authEnabled: false` appears in production, check that `NODE_ENV=production` is set and `FORGEPILOT_AUTH_DISABLED` is not set to `true`.
