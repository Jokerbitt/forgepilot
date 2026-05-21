# ForgePilot Launch Prep

## Positioning

ForgePilot is the operating layer for AI-assisted software delivery.

Short description:

> Local-first AI workflow OS for planning, delegating, supervising, and reviewing agent-driven software work.

Primary users:

- solo developers using Claude Code, Codex, Cursor, Antigravity or similar tools
- technical founders coordinating many AI-assisted workstreams
- small teams that need AI output to become auditable, scoped and merge-ready

## Launch Promise

ForgePilot should not promise "fully autonomous software development."

It should promise:

- clearer project planning
- safer AI delegation
- fewer merge conflicts
- local-first model routing
- better review discipline
- durable project memory
- a cockpit for human approval

## Public Demo Checklist

- Command Center shows clear next action.
- Project Brief flow works from a fresh idea.
- Delegation can be created with acceptance criteria and file scope.
- Agent scope board shows who owns which files.
- Provider health and local AI status are visible.
- SaaS Readiness page honestly shows launch gaps.
- E2E smoke test can be run locally.

## Pre-Launch Blockers

- Auth must be merged, configured and tested in a deployed environment.
- Tenant isolation must have a concrete migration path.
- Billing must have at least a stubbed Stripe lifecycle.
- Onboarding must guide a new user without reading docs.
- UI must feel like a professional SaaS cockpit, not an internal prototype.
- README must not overstate autonomy.

## Launch Milestones

### Internal Alpha

Goal: Sven can use ForgePilot daily on local/NAS setup.

Required:

- local-first model router stable
- delegation queue reliable
- scope locks visible
- backups and restore tested
- GitHub PR creation workflow tested

### Private Beta

Goal: 3-5 technical users can self-host and understand the value.

Required:

- onboarding flow
- auth enabled by default for shared deployments
- setup guide
- demo video
- clear known limitations

### Public Launch Candidate

Goal: GitHub visitors understand the product in under 60 seconds.

Required:

- polished README
- screenshots or demo video
- pricing hypothesis
- SaaS-readiness audit
- core E2E happy path
- security notes

## Messaging Guardrails

Use:

- "controlled AI agent execution"
- "local-first model routing"
- "human approval where risk matters"
- "project memory and writeback"
- "agent coordination"

Avoid:

- "replace developers"
- "fully autonomous without oversight"
- "zero-cost cloud AI"
- "production SaaS ready" until auth, tenant isolation and billing are complete
