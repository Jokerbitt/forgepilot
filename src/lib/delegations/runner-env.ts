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
