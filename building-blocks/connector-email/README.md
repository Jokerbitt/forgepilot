# Email Connector

Provider-agnostic transactional email. Call `sendEmail()` everywhere; switch
vendor via `EMAIL_PROVIDER` with no code changes.

## Providers
| Provider | Env | Install |
|----------|-----|---------|
| `console` (default, dev) | — | — |
| `resend` | `RESEND_API_KEY`, `EMAIL_FROM` | `npm i resend` |
| `smtp` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | `npm i nodemailer` |

Auto-detects: Resend if `RESEND_API_KEY` is set, else SMTP if `SMTP_HOST`, else console.

## Usage
```ts
import { sendEmail } from '@/lib/email'

await sendEmail({
  to: user.email,
  subject: 'Verify your email',
  html: `<a href="${link}">Confirm</a>`,
})
```

Pairs well with the **OAuth** and **Auth** blocks (verification + password-reset mails).
