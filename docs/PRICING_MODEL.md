# ForgePilot Pricing Model

This is a launch hypothesis, not a final business decision.

## Packaging Principles

- Local-first should remain a core differentiator.
- Users should understand when they pay for ForgePilot and when they pay providers.
- Cloud AI costs should be visible, not hidden.
- Self-hosting should be possible.
- Team features should justify team pricing through coordination, auditability and permissions.

## Recommended Packages

### Solo Local

For individual developers running ForgePilot on their own machine or NAS.

Includes:

- local JSON persistence
- Ollama/LM Studio routing
- project briefs
- delegations
- agent scope board
- GitHub PR workflow
- local backups

Pricing hypothesis:

- free open-source core, or
- one-time self-hosted license, or
- low monthly plan

Best launch path:

Start with open-source core to build trust and adoption.

### Solo Pro

For developers using ForgePilot daily with cloud models.

Includes:

- everything in Solo Local
- hosted convenience option
- premium provider routing
- cost analytics
- Grok/critic evaluations
- deeper project memory

Pricing hypothesis:

- monthly subscription
- bring-your-own API keys first
- optional usage credits later

### Team

For small teams coordinating multiple humans and AI agents.

Includes:

- multi-user auth
- tenant isolation
- role-based approvals
- audit logs
- shared delegation queue
- team provider policies
- Linear/GitHub governance

Pricing hypothesis:

- per-seat subscription
- usage-based add-on for managed AI credits

### Enterprise / Self-Hosted

For regulated or privacy-sensitive teams.

Includes:

- self-hosted deployment
- local-first policy enforcement
- private model routing
- SSO later
- audit export
- custom retention policies

Pricing hypothesis:

- annual license
- support package

## Billing Architecture Recommendation

Phase 1:

- bring-your-own API keys
- no managed AI credits
- Stripe only for ForgePilot subscription

Phase 2:

- optional managed cloud credits
- hard monthly budget caps
- provider-level usage reports

Phase 3:

- team workspaces
- usage pools
- invoice-ready audit exports

## Pricing Risks

- If ForgePilot looks like a wrapper around AI APIs, pricing power is weak.
- If scope control, project memory and review discipline become visible, pricing power improves.
- If local-first saves measurable cloud cost, ROI becomes easy to explain.

## Current Recommendation

Do not launch with complex pricing.

Use:

- Open-source/self-hosted core
- Solo Pro for hosted convenience and advanced orchestration
- Team later, after auth and tenant isolation are proven
