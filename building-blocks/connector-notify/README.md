# Notify Connector

Provider-agnostic outbound notifications. Call `notify()`; route to Slack, a
generic signed webhook, or console via `NOTIFY_PROVIDER`.

| Provider | Env | Notes |
|----------|-----|-------|
| `console` (default, dev) | — | logs only |
| `slack` | `SLACK_WEBHOOK_URL` | Incoming Webhook, no SDK |
| `webhook` | `NOTIFY_WEBHOOK_URL`, `NOTIFY_WEBHOOK_SECRET?` | POST JSON + optional `X-Signature` HMAC |

```ts
import { notify } from '@/lib/notify'
await notify({ title: 'New signup', level: 'success', context: { email: user.email } })
```

Great for ops alerts, signup/churn pings, and build/job completion notices.
