# Analytics Connector

Provider-agnostic product analytics. Call `analytics().track(...)`; swap vendor
via `ANALYTICS_PROVIDER`.

| Provider | Env | Notes |
|----------|-----|-------|
| `console` (default, dev) | — | logs only |
| `posthog` | `POSTHOG_KEY`, `POSTHOG_HOST?` | HTTP capture API, no SDK; EU host by default (DSGVO) |

```ts
import { analytics } from '@/lib/analytics'
await analytics().track({ name: 'signup.completed', distinctId: user.id, properties: { plan } })
await analytics().identify(user.id, { email: user.email, plan })
```

Server-side capture keeps keys off the client. Calls never throw — analytics
must not break a request. Swap to Plausible/Umami by adding a provider.
