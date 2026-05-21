# n8n → ForgePilot Integration Setup

## Overview

This guide shows how to connect Linear (via n8n) to ForgePilot so that
tickets are automatically turned into project briefs and delegations.

## 1. Verify Execute-Loop Health

Call the health endpoint to see what execution mode is available:

```
GET http://localhost:3000/api/execute-loop/health
```

You'll see:
- `claude-cli`: Full agentic execution (Claude writes code, creates PR)
- `claude-api`: Text plan only (no code written)
- `simulation`: Demo mode (no AI key configured)

## 2. Configure API Key

In ForgePilot Settings → API Keys, add your Anthropic API key.
Or set `ANTHROPIC_API_KEY` in `.env.local`.

## 3. n8n Workflow: Linear → ForgePilot

### Trigger
- Node: **Linear Trigger**
- Event: `Issue Created` or `Issue Assigned`

### Filter (optional)
- Node: **IF**
- Condition: `{{ $json.issue.labels }}` contains `forge-it` or `ai-delegate`

### Format Payload
- Node: **Set** (or **Function**)
```javascript
return {
  title: $json.issue.title,
  rawIdea: $json.issue.description || $json.issue.title,
  problemStatement: `Linear ticket: ${$json.issue.identifier} — ${$json.issue.title}`,
  targetAudience: 'ForgePilot users',
  desiredOutcome: $json.issue.description || 'Implement as described',
  constraints: [],
  scope: 'standard',
  researchMode: 'standard',
  privacyMode: 'local',
  autoDelegate: true,
  autoApprove: true,
  autoExecute: false,  // set true to auto-start Claude immediately
}
```

### Send to ForgePilot
- Node: **HTTP Request**
- Method: `POST`
- URL: `http://YOUR_NAS_IP:3000/api/intake`
- Body: `{{ $json }}`
- Header: `x-forgepilot-signature: {{ $env.FORGEPILOT_SECRET }}` (optional)

## 4. Response

```json
{
  "brief": { "id": "...", "title": "...", "status": "accepted" },
  "delegation": { "id": "...", "status": "approved" },
  "pipeline": {
    "briefCreated": true,
    "briefAccepted": true,
    "delegationCreated": true,
    "delegationApproved": true,
    "executionTriggered": false
  }
}
```

Copy the `delegation.id` and manually trigger execution when ready:
```
POST http://localhost:3000/api/delegations/{delegation.id}/execute
```

Or set `autoExecute: true` to start immediately.

## 5. Auto-Execute (fully autonomous)

Set `autoExecute: true` in the n8n payload.

ForgePilot will:
1. Create the brief
2. Accept it
3. Create a delegation (Risk A, budget $2)
4. Approve it
5. Immediately start Claude Code (or API fallback)

Claude will: checkout branch → write code → run tests → create PR → done.

You get a Telegram notification when the PR is ready.

## 6. Environment Variables Needed

```
ANTHROPIC_API_KEY=sk-ant-...       # For Claude CLI + API
INTAKE_WEBHOOK_SECRET=...           # Optional HMAC secret
NEXT_PUBLIC_BASE_URL=http://...     # Self-URL for internal calls
GITHUB_TOKEN=...                    # For gh CLI (PR creation)
TELEGRAM_BOT_TOKEN=...              # For notifications
TELEGRAM_CHAT_ID=...                # For notifications
```
