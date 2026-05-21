# Grok (xAI) Setup

ForgePilot uses Grok as an independent critic/evaluator alongside Claude.

## Setup
1. Get API key: https://console.x.ai ($25 free credits)
2. Add to `.env.local`: `XAI_API_KEY=xai-...`
3. In ForgePilot: Settings → AI Providers → xAI (Grok) → enable

## Usage
- **Interactive critic**: send `docs/GROK_BRIEFING.md` to any Grok interface
- **API critic**: `POST /api/eval/critic` with `type: "delegation"` or `type: "code-review"`
- **Models**: `grok-3-mini` (fast, cheap) or `grok-3` (strongest)
