/**
 * Environment construction for runner agent subprocesses (Claude CLI / Codex).
 *
 * Two keys must NOT be inherited from the ForgePilot server process:
 *  - the provider API key (ANTHROPIC_API_KEY / OPENAI_API_KEY): so the CLI uses
 *    its own session auth (Max OAuth token / subscription) instead of a possibly
 *    credit-less key.
 *  - NODE_ENV: the dev server runs with NODE_ENV=development; inheriting that into
 *    the agent makes `next build` (and other production tooling) in the TARGET
 *    repo use the development React build, which breaks production builds. We do
 *    NOT pin a replacement value — each tool then picks its own default
 *    (next build → production, vitest → test), so builds and tests are both
 *    correct without per-repo workarounds.
 */
export function buildRunnerBaseEnv(
  parentEnv: NodeJS.ProcessEnv,
  stripApiKeyVar: 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY',
): NodeJS.ProcessEnv {
  const base: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(parentEnv)) {
    if (key === 'NODE_ENV' || key === stripApiKeyVar) continue
    base[key] = value
  }
  return base as NodeJS.ProcessEnv
}

/** Default wall-clock deadline for a single runner process: 30 minutes. */
export const DEFAULT_RUNNER_TIMEOUT_MS = 1_800_000

/** Lower bound so a misconfigured tiny value can't kill the agent instantly. */
const MIN_RUNNER_TIMEOUT_MS = 60_000

/**
 * Resolve the wall-clock deadline (ms) after which a runner process is forcibly
 * terminated, independent of whether it is still producing output. The
 * `startupTimer` only fires when the agent produces NO output at all; a long-
 * running or mid-task-stuck agent (occasional output, never finishing) would
 * otherwise leave the delegation pinned at `status=running` forever. This
 * deadline is the 24/7 safety net.
 *
 * Env override: `FORGEPILOT_RUNNER_TIMEOUT_MS`. Pure + unit-tested. Invalid,
 * non-positive, or below-floor values fall back to the default / floor.
 */
export function resolveRunnerTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.FORGEPILOT_RUNNER_TIMEOUT_MS?.trim()
  if (!raw) return DEFAULT_RUNNER_TIMEOUT_MS
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RUNNER_TIMEOUT_MS
  return Math.max(MIN_RUNNER_TIMEOUT_MS, Math.floor(parsed))
}
