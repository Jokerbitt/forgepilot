# Billing Stub

M172 introduces a safe billing readiness layer. It does not create charges and does not persist subscription state yet.

## Goals

- Make pricing hypotheses visible in the app.
- Detect whether Stripe environment variables are configured.
- Add a fail-closed webhook boundary.
- Prepare integration points for tenant-aware subscription state after the persistence migration lands.

## Environment Variables

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_SOLO_PRO=
STRIPE_PRICE_TEAM=
STRIPE_CUSTOMER_PORTAL_URL=
```

## API

- `GET /api/billing/status`
- `POST /api/billing/webhook`

The status endpoint never returns secret values. It only returns booleans and readiness metadata.

The webhook endpoint currently validates configuration and signature presence, then returns a stub response. Real signature verification and persistence should be added when the project has tenant-aware subscription storage.

## Product Packaging

- Solo Local: self-hosted, bring your own keys, local-first.
- Solo Pro: hosted convenience, advanced routing and critic workflows.
- Team: shared queue, approvals, audit logs and tenant isolation.

## Follow-up

- Add real Stripe SDK verification.
- Store subscription status by tenant.
- Connect plan state to feature gates.
- Add customer portal redirect.
- Add billing audit events.
