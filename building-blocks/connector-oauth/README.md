# OAuth Login Connector

Dependency-free OAuth 2.0 (Authorization Code) for **Google** and **GitHub**.
Adds social sign-in alongside the credentials Auth block — same session cookie.

## Setup
1. Register an OAuth app with each provider; set the callback to
   `${OAUTH_REDIRECT_BASE}/api/auth/oauth/<provider>/callback`.
2. Env:
   ```
   OAUTH_REDIRECT_BASE=https://app.example.com
   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
   GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET=...
   ```
3. Files:
   - `src/lib/oauth/providers.ts` — config + flow helpers
   - `src/app/api/auth/oauth/[provider]/route.ts` — start (redirect to consent)
   - `src/app/api/auth/oauth/[provider]/callback/route.ts` — callback
4. **Adapt the callback** (marked `ADAPT`): upsert the user via your **db** block
   and mint a session via your **auth** block.
5. Add buttons: `<a href="/api/auth/oauth/google">Continue with Google</a>`.

CSRF is handled via a short-lived `oauth_state_<provider>` cookie.
