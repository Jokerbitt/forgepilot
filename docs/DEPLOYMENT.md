# ForgePilot — Deployment Guide

## Quick Start (Local)

```bash
git clone https://github.com/Jokerbitt/forgepilot
cd forgepilot
cp .env.example .env.local
# Edit .env.local: add at least one AI provider API key
npm install
npm run dev
# → http://localhost:3000
```

## Docker (NAS / Self-Hosted)

```bash
docker build -t forgepilot .
docker run -p 3000:3000 \
  -v $(pwd)/config:/app/config \
  -e ANTHROPIC_API_KEY=sk-... \
  forgepilot
```

Or with docker-compose:
```bash
docker-compose up -d
```

## Vercel

1. Fork the repo on GitHub
2. Import into Vercel
3. Add environment variables (see .env.example)
4. Deploy

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Recommended | Primary AI provider |
| `XAI_API_KEY` | Optional | Grok critic evaluation |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Optional | Gemini (free tier) |
| `FORGEPILOT_AUTH_ENABLED` | Optional | Set `true` to require login |
| `FORGEPILOT_ADMIN_EMAIL` | If auth on | Admin login email |
| `FORGEPILOT_ADMIN_PASSWORD` | If auth on | Admin login password |
| `NEXTAUTH_SECRET` | If auth on | Random 32-char secret |
| `NEXTAUTH_URL` | If auth on | Full URL, e.g. `https://fp.example.com` |
| `SENTRY_DSN` | Optional | Error monitoring |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Optional | OpenTelemetry traces |

## Auth Setup

By default, ForgePilot runs without authentication — anyone with the URL has access.

To enable single-user auth:
```env
FORGEPILOT_AUTH_ENABLED=true
FORGEPILOT_ADMIN_EMAIL=you@example.com
FORGEPILOT_ADMIN_PASSWORD=a-strong-password
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
```
