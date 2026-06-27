# ADR-004: Risk-C Human-Approval Execution Path

**Date:** 2026-06-27
**Status:** Accepted (E1–E4 decided by Sven — see Resolution)
**Risk Class:** C (requires ADR + human approval)

## Context

ADR-003 hardened the runner and, as a side effect, made **Risk-C effectively un-runnable**:
its D2 resolution blocks any Risk-C run without a human `approvedBy` record — and **no human
Risk-C approval path exists**. ADR-003 D3 even names this explicitly: *"The full path-jailed
Risk-C runner stays available as future work if a human Risk-C execution path is ever introduced."*

This is the one lever that unlocks "große Apps autonom bauen": large, architecture-changing work
(auth, payments, schema/migrations, security rules) is classed Risk-C and therefore cannot run
today, not even with a human at the keyboard. This ADR introduces that missing human path.

### What already exists (smaller build than expected)

A code scout (2026-06-27) confirmed the **safe runner is already built and in production use**:

- `claude-api` mode → `runWithClaudeAPI` → `runWithToolUse` (`src/lib/agents/tool-use-runner.ts`).
  Its security model is exactly what Risk-C needs: file-jail to `projectRoot` (no `../` escape),
  writes blocked on `.env`/secrets/`.git/` (`BLOCKED_PATHS`, line 243), a strict command-allowlist
  (no `rm`, no `git push --force`, shell-injection guard, line 176+), and git writes blocked on
  `main`/`master`. **No `--dangerously` flags.**
- `selectDelegationExecutionMode` (`src/lib/delegations/execution-mode.ts:22`) already produces this
  mode, and `isDangerousRunnerMode` (line 51) already classifies `claude-api` as **safe**.

### What is missing (the actual gaps)

1. **No approval path.** `POST /api/delegations/[id]/approve` hard-rejects Risk-C with 403
   (`approve/route.ts:30-35`). Every UI approve button is hardcoded to `riskClass !== 'C'`
   (`PendingApprovalsBar.tsx`, `delegations/page.tsx:341`, `delegations/[id]/page.tsx:561`).
   There is no way — UI or API — to record a human `approvedBy` for a Risk-C delegation.

2. **No runner pinning.** Even with a human approval, `selectDelegationExecutionMode` prefers the
   `--dangerously` CLI when `zeroKeyReady` — so an approved Risk-C run would pick `claude-cli`,
   hit the D3 fail-closed guard (`route.ts:2712`), and 403. Risk-C must be *pinned* to a
   non-dangerous runner (`claude-api` / `ollama-agent`).

3. **Self-repo only (today).** The `claude-api` tool-use runner refuses external target repos
   (`route.ts:2699`: "kann (noch) nicht in ein externes Ziel-Repo schreiben"). So a Risk-C path
   built on it initially covers **ForgePilot's own repo**, not arbitrary external apps.

## Decision

Introduce a **deliberately narrow, audited** human-approval path for Risk-C, reusing the existing
path-jailed runner. The gate stays "deny by default"; this adds a single, guarded exception.

Proposed shape (subject to E1–E4 below):

- **Approval API:** replace the blanket 403 in `approve/route.ts` with a Risk-C branch that accepts
  an approval **only** when (a) the actor is human (passes `isHumanApproval`, never `autonomous-mode`),
  (b) the actor is on an authorized allowlist, and (c) a non-empty `reason` is supplied. Records the
  full `approvedBy: { actor, approvedAt, reason }` audit entry that `getExecutionStartBlocker`
  already requires. No change to the central D2 choke-point — it keeps enforcing human approval.
- **Runner:** per Sven's E2-C decision, Risk-C may use the full CLI/Codex runner (`--dangerously`).
  The ADR-003 D3 spawn-guard, which blocked Risk-C from any dangerous runner, is **lifted for Risk-C**
  (see Resolution for the exact change and the residual-risk acceptance). The human-approval
  choke-point (D2) and the policy gate / secret-scrub / budget-kill remain the active guards.
- **UI:** a distinct "Risk-C freigeben" affordance (separate from the one-click A/B approve) behind a
  confirmation modal that **requires** a typed reason and shows the blast-radius warning. Risk-C never
  joins batch-approve.
- **Scope:** ship for ForgePilot's own repo first; external-repo Risk-C is a follow-up (needs the
  tool-use runner's external-writeback, see E4).

### Open decisions for Sven (Option A/B/C)

**E1 — Who may approve Risk-C?**
- **A (recommended):** Only an explicit authorized-approver allowlist (config, e.g. `['sven']`).
  Anyone else gets 403 even via API. Smallest blast radius, matches single-operator reality.
- **B:** Any authenticated human user (just not `autonomous-mode`). Simpler, but every human session
  can green-light auth/payments/schema changes.
- **C:** Keep Risk-C fully blocked; only a code change can ever run it. Safest, but the "große Apps
  autonom" goal stays out of reach.

**E2 — Which runner executes an approved Risk-C?**
- **A (recommended):** Pin to `claude-api` (path-jailed `tool-use-runner`). No `--dangerously`,
  file-jail + command-allowlist bound the blast radius. D3 guard stays armed.
- **B:** Allow `claude-api` **or** `ollama-agent` (also jailed, fully local/zero-cost) — let the
  normal selector pick among the safe runners, just exclude the dangerous ones.
- **C:** Allow the CLI with `--dangerously` for Risk-C too — **rejected**: reopens exactly the hole
  ADR-003 D3 closed.

**E3 — What evidence/friction is required to approve?**
- **A (recommended):** Mandatory typed `reason` **plus** a confirmation modal (typed reason, blast-
  radius warning) **plus** an audit log line. Never part of batch-approve.
- **B:** Mandatory `reason` only (API + a single confirm). Lighter, still audited.
- **C:** No extra friction beyond being an authorized human — **rejected**: a Risk-C run deserves a
  conscious, recorded act.

**E4 — Scope: which repos?**
- **A (recommended):** ForgePilot's own repo only for now; document external-repo Risk-C as future
  work. Matches what `tool-use-runner` can safely do today.
- **B:** Extend `tool-use-runner` with external-repo writeback (isolated clone + writeback, like the
  Ollama path) so Risk-C can target external apps. Larger build; do it as a separate PR after A lands.

## Consequences

**Positive:**
- Unlocks Risk-C — the single remaining blocker for autonomously building large/architecture-level
  changes — **without** weakening any ADR-003 guard. D2 (human approval) and D3 (no dangerous runner)
  stay enforced; this adds the *human* path D2 was always meant to have.
- Reuses the already-validated path-jailed runner; net new surface is an approval branch + a UI modal
  + a selection rule, not a new execution engine.
- Every Risk-C run carries a who/when/why audit record by construction.

**Negative / Trade-offs:**
- Any human-approval path is, by definition, a way to run dangerous work — the allowlist (E1-A) and
  the typed-reason modal (E3-A) are the mitigations, not the absence of the path.
- The path-jailed runner is slower / less capable than the CLI for very large tasks (the reason CLI
  exists). Risk-C tasks may run longer or need more turns/budget.
- Self-repo-only (E4-A) means "große *externe* Apps autonom" still waits on E4-B.

## Alternatives Considered

- **Keep Risk-C blocked (status quo / E1-C)** — rejected as the default: it permanently caps the
  product's headline capability. Kept as a valid choice if Sven wants zero Risk-C autonomy.
- **Route Risk-C through the CLI with `--dangerously` + extra checks** — rejected: directly contradicts
  ADR-003 D3; the path-jail is the whole point.
- **Build a brand-new Risk-C runtime** — rejected: `tool-use-runner` already is the right model; no
  reason to duplicate it.

## Resolution (2026-06-27)

Sven decided **E1-A / E2-C / E3-A / E4-A**:

- **E1 → A (authorized-approver allowlist).** Risk-C can be approved only by an actor on an explicit
  allowlist (`FORGEPILOT_RISK_C_APPROVERS`, comma-separated; empty = nobody, fail-closed). The approve
  route rejects Risk-C for any actor that is automated (`isHumanApproval` false) or not on the list.

- **E2 → C (CLI `--dangerously` allowed for Risk-C).** Consciously chosen for the extra power/speed the
  CLI runner gives large, architecture-level tasks — the headline "große Apps autonom" goal. This is a
  **deliberate partial rollback of ADR-003 D3**: the spawn-point guard (`isDangerousRunnerMode` block in
  `execute/route.ts`) no longer blocks Risk-C from the CLI/Codex runner. **Residual risk accepted:** an
  approved Risk-C agent runs with the runtime's own permission/sandbox gating disabled (it can touch
  `.env`/`.git`, run `rm`, `git push --force`, arbitrary shell) — the path-jail + command-allowlist of
  `tool-use-runner` do **not** apply. The mitigations that remain in force:
  - **D2 human approval** — every Risk-C run needs a human `approvedBy` from the allowlist (E1). No
    automated/self-approval path exists. This is the primary brake and is *not* loosened.
  - **Policy gate (D1)** enforced (`FORGEPILOT_POLICY_ENFORCE=1`) — evaluates the contract before spawn.
  - **Secret-scrubbed env (P4)** — the agent does not inherit server secrets.
  - **In-flight budget kill (P3)** — a runaway Risk-C agent is SIGTERM'd at the budget ceiling.

  The `tool-use-runner` path-jail stays the default for Risk-A/B-via-API and remains available; choosing
  the dangerous runner for Risk-C is the explicit, audited trade-off recorded here. **Revisit trigger:**
  if a Risk-C run ever causes destructive collateral (force-push, secret leak, out-of-scope deletion),
  revert E2 to a path-jailed runner (E2-A/B).

- **E3 → A (typed reason + confirmation modal).** The UI requires a typed justification behind a
  blast-radius confirmation modal; the reason is stored in `approvedBy.reason`. Risk-C is never part of
  one-click or batch approve.

- **E4 → A (ForgePilot self-repo first).** External-repo Risk-C is out of scope for this change and
  tracked as future work (extend `tool-use-runner`/CLI external writeback).

Implementation lands as a feature branch + PR with unit tests. The central D2 choke-point
(`getExecutionStartBlocker`) is unchanged; only the D3 *spawn-guard* is narrowed to exclude Risk-C, and
a guarded Risk-C branch is added to the approve route + UI.
