# SMS Connector

Provider-agnostic SMS for OTP codes, alerts, and reminders. Call `sendSms()`;
swap vendor via `SMS_PROVIDER`.

| Provider | Env | Notes |
|----------|-----|-------|
| `console` (default, dev) | — | logs only |
| `twilio` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | REST API, no SDK |

```ts
import { sendSms } from '@/lib/sms'
await sendSms({ to: '+491701234567', body: `Your ProjectFlow code: ${code}` })
```

Use E.164 numbers (`+<country><number>`). Pair with an OTP flow for 2FA or
phone verification.
