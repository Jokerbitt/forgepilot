# M6 Autonomous Delivery Loop

Goal: ForgePilot should feel like a daily development assistant, not a dashboard that Sven has to operate manually.

## Milestones

### M6.1 Daily Assistant Autonomy Cycle
- Status: done
- Scope: one endpoint that runs watchdog, chooses the safest next delegation, and starts it when policy allows.
- Evidence: `/api/daily-assistant/autonomy-cycle`

### M6.2 Delivery Cycle After Agent Completion
- Status: in progress
- Scope: after a delegation completes, choose the next delivery step automatically.
- Work packages:
  - DoD Quality Check for completed safe delegations
  - Critic Review after quality check
  - PR creation after quality and critic are present
  - PR review/merge recommendation without unsafe automatic merge
  - Repair-required state when quality fails
- Evidence: `/api/daily-assistant/delivery-cycle`

### M6.3 Assistant-Controlled Repair Loop
- Status: planned
- Scope: failed quality, failed runner, provider errors and merge conflicts become small repair delegations instead of dead ends.

### M6.4 Operator Briefing
- Status: planned
- Scope: one German daily summary: what the assistant did, what is running, what is blocked, what needs Sven.

## Guardrails

- Risk C never runs automatically.
- Failed delegations block new autonomous work unless explicitly forced.
- PR merge remains a deliberate review step.
- Provider/OAuth failures must become readable next actions, not silent running states.
- API keys remain optional; Claude/Codex CLI and local runners stay first-class.
