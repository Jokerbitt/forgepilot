# ADR-003: Runner Autonomy — Security Hardening of the Live Execution Path

**Date:** 2026-06-26
**Status:** Proposed
**Risk Class:** C (requires ADR + human approval)

## Context

Sven's goal is a runner that delegations can execute **fully unattended** ("vollautonom"). The resilience layer (PR #684) already lets the runner survive a dead cloud token, timeouts, and crashes. A 4-agent deep audit plus a fresh code scout (2026-06-26) found that the **execution path itself is not yet safe enough to run unsupervised**. Four concrete gaps:

### P1 — `--dangerously` flags, Policy-Engine is decorative
- Claude CLI is spawned with `--dangerously-skip-permissions` (`route.ts:649`); the Codex fallback goes further with `--dangerously-bypass-approvals-and-sandbox` (`route.ts:2104`). Both disable the agent runtime's own permission/sandbox gating.
- A Deny-first **Policy-Engine exists** (`src/lib/policy/engine.ts` `evaluatePolicy()`, 7 rules in `rules.ts`: risk-class-c, secret-tools, destructive-actions, budget, goal-required, dod-required, privacy-public) — but it is **never called on the live execute path**. `getExecutionStartBlocker()` (`src/lib/delegation-execution.ts:76`) only checks status + the `requiresApproval` flag + measurable DoD. The policy verdict is computed for UI display, not enforced.
- A safer runner already exists: `tool-use-runner.ts` has a path-jail (`BLOCKED_PATHS` incl. `.env`, `.git/`) + command-allowlist (no `rm`, no `git push --force`, shell-injection guard). It is only used when both CLI and Codex are absent.

### P2 — RiskClass-C self-approval, no audit
- `getExecutionStartBlocker` blocks Risk-C **only** when `contract.requiresApproval === true` (`delegation-execution.ts:84`). Autopilot/pilot routes can create a Risk-C delegation with `requiresApproval: false` → self-approval.
- The data model (`src/lib/models/delegation.ts`) has **no `approvedBy` field** — only an optional unstructured `approvalId: string`. There is no record of *who* approved, *when*, or on *what evidence*.

### P3 — Budget is checked post-hoc only, no in-flight kill
- `checkBudget()` (`src/lib/budget/guard.ts:39`) runs **after** the agent exits (`route.ts:1267`). `actualCostUsd` is parsed from the final output.
- Live cost/token counts *are* available mid-run from the stream-json `result` events (`route.ts:830`) but are only logged, never gated. A runaway agent can burn well past `maxBudgetUsd` before the post-hoc check sees it. The kill machinery exists (`process.kill(-pid, 'SIGTERM')` on timeout, `route.ts:709-761`) but is wall-clock-only.

### P4 — Server secrets leak into the agent's environment
- `buildRunnerBaseEnv()` (`src/lib/delegations/runner-env.ts:15`) is a **blacklist**: it strips only `NODE_ENV` + one API key, and passes **every other** parent-process env var to the spawned agent. So `CRON_SECRET`, `AUTH_SECRET`, `AUDIT_SECRET`, `DATABASE_URL`, and any other server secret are handed to a `--dangerously`-flagged agent (exfiltration surface).
- `GH_TOKEN`/`GITHUB_TOKEN` + `ANTHROPIC_API_KEY` are injected **on purpose** (the Claude-CLI agent runs `gh pr create` / `git push` itself). Ollama + the API tool-runner do PR/push in ForgePilot's own process instead.

## Decision

Harden the path in **two tiers**, matched to risk:

- **Tier 1 — implemented autonomously now** (additive, security-*increasing*, unit-tested, no behavior change without an explicit opt-in):
  - **P3 in-flight budget kill** — accumulate live cost from the stream `result` events; when it exceeds the effective budget limit, SIGTERM the process group and finalize `failed` (`budgetPaused`). Reuses the existing kill machinery.
  - **P4 secret-scrubbed agent env** — turn `buildRunnerBaseEnv` into a pattern-based scrub: drop everything matching `*_SECRET / *_TOKEN / *_KEY / *_PASSWORD / *_CREDENTIAL` (plus the named ForgePilot server secrets), then the caller re-injects the *intended* `GH_TOKEN` + provider key explicitly. System vars (PATH/HOME/…) don't match, so the runner is unaffected.
  - **P1 policy gate, wired but report-only by default** — call `evaluatePolicy(contract)` before every spawn. Default = **report-only**: a `deny` verdict is logged as a visible warning, the run proceeds (zero behavior change). `FORGEPILOT_POLICY_ENFORCE=1` flips it to **fail-closed**: a `deny` blocks the spawn (`status=failed`, no agent). This lets Sven watch real verdicts before arming the block.
  - **P2 `approvedBy` audit field** — add an optional structured `approvedBy: { actor; approvedAt; reason? }` to the contract + populate it on the approve route. Additive; no enforcement change yet.

- **Tier 2 — requires Sven's go (Governance, this ADR's open decisions):**
  - **Arm `FORGEPILOT_POLICY_ENFORCE`** in the runtime once the report-only logs look right.
  - **P2 hard rule:** should Autopilot *ever* self-approve Risk-C? (See options.)
  - **P4 full allowlist** (Default-Deny env) instead of the scrub-list — stronger, but needs a live runner validation pass to prove nothing breaks.
  - **Drop the `--dangerously` flags / route Risk-C through `tool-use-runner`** (path-jail) instead of the CLI.

### Open decisions for Sven (Option A/B/C)

**D1 — Policy enforcement mode (P1):**
- **A (recommended):** Ship report-only now; arm `FORGEPILOT_POLICY_ENFORCE=1` after reviewing a few real verdicts. Reversible, evidence-based.
- **B:** Arm enforce immediately — maximal safety, but a too-strict default rule could block legitimate runs on day one.
- **C:** Keep policy advisory (UI only), never block. Lowest friction, lowest safety — not recommended for unattended runs.

**D2 — Risk-C self-approval (P2):**
- **A (recommended):** Risk-C **always** needs a human `approvedBy` record; Autopilot may *prepare* but never *self-approve* Risk-C. (Matches existing `risk-class-c` policy rule.)
- **B:** Allow Autopilot to self-approve Risk-C only above an NBA score threshold, with a mandatory `approvedBy: { actor: 'autopilot', evidence }` audit entry.
- **C:** Status quo (`requiresApproval` flag only) — rejected: no audit, silent bypass.

**D3 — `--dangerously` flags (P1, deeper):**
- **A (recommended):** Keep the flags for Risk-A/B (the agent needs write permission to do its job), but gate the *spawn decision* behind the policy gate, and route **Risk-C through the path-jailed `tool-use-runner`** instead of the CLI.
- **B:** Remove the flags entirely and rely on the agent runtime's own approval prompts — breaks unattended operation (prompts hang with no human).
- **C:** Keep flags unchanged — status quo, rejected.

**D4 — Agent env (P4):**
- **A (recommended):** Ship the scrub-list now (Tier 1); move to a full Default-Deny allowlist after one live runner validation.
- **B:** Full allowlist immediately — needs the live pass first to avoid breaking the runner.
- **C:** Status quo blacklist — rejected (leaks server secrets).

## Consequences

**Positive:**
- The expensive/irreversible failure modes (runaway budget, secret exfiltration) are closed *now*, autonomously, with no behavior change until Sven opts in.
- The Policy-Engine stops being decorative — one env flag turns it into a real fail-closed gate.
- Risk-C gets a real audit trail.
- Every Tier-2 change is reversible and evidence-gated (report-only logs, live validation) before it goes hard.

**Negative / Trade-offs:**
- Report-only policy adds one `evaluatePolicy` call + log per spawn (negligible cost).
- The secret-scrub could, in theory, strip an env var a target repo's build genuinely needs if it matches a secret pattern — mitigated by re-injecting the known-needed vars and by the scrub being pattern-scoped to secret-shaped names.
- The `approvedBy` field is additive but unused until D2 is decided.

## Alternatives Considered

- **Do nothing / keep advisory policy** — rejected: leaves the unattended path unsafe (the whole point of "vollautonom").
- **Big-bang enforce everything at once** — rejected: a too-strict default rule or a missing env var would break the runner with no evidence trail; violates the project's "live-validate before arming" pattern.
- **Replace CLI runners with `tool-use-runner` everywhere** — deferred: the path-jail is the right model, but the API tool-runner is slower/less capable than the CLI for large tasks; reserve it for Risk-C (D3-A).
