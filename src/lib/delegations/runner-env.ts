/**
 * Environment construction for runner agent subprocesses (Claude CLI / Codex).
 *
 * Default-DENY for secrets. The spawned agent runs with `--dangerously-*` flags,
 * so it must NOT inherit the ForgePilot SERVER's secrets (CRON_SECRET,
 * AUTH_SECRET, AUDIT_SECRET, DATABASE_URL, provider API keys, …) — that would be
 * a credential-exfiltration surface. We scrub every env var whose NAME looks like
 * a credential and let the spawning code re-inject the few the agent legitimately
 * needs (its own auth token, GH_TOKEN) EXPLICITLY afterwards.
 *
 * NODE_ENV is also dropped: the dev server runs with NODE_ENV=development;
 * inheriting that into the agent makes `next build` (and other production tooling)
 * in the TARGET repo use the development React build, which breaks production
 * builds. We do NOT pin a replacement value — each tool then picks its own default
 * (next build → production, vitest → test), so builds and tests are both correct
 * without per-repo workarounds.
 */

/**
 * Env-var NAME patterns (matched case-insensitively against the variable name,
 * never its value) that look like a credential. System vars the runner needs —
 * PATH, HOME, USER, SHELL, LANG, TMPDIR, FORGEPILOT_* … — don't match, so the
 * agent keeps everything required to actually build/test. The intended
 * credentials (GH_TOKEN, the provider key / OAuth token) are scrubbed here too
 * and re-injected explicitly by the caller, keeping the contract default-deny.
 */
const SECRET_NAME_PATTERNS: readonly RegExp[] = [
  /SECRET/i,
  /PASSWORD/i,
  /PASSWD/i,
  /TOKEN/i,
  /API[_-]?KEY/i,
  /ACCESS[_-]?KEY/i,
  /PRIVATE[_-]?KEY/i,
  /_KEY$/i,
  /CREDENTIAL/i,
  /DATABASE_URL/i,
  /CONNECTION[_-]?STRING/i,
  /_DSN$/i,
]

/** True when an env-var name looks like a credential and must not reach the agent. */
export function isSecretEnvName(name: string): boolean {
  return SECRET_NAME_PATTERNS.some(pattern => pattern.test(name))
}

/**
 * ADR-003 D4: full default-deny ALLOWLIST. A pattern-based secret scrub
 * (isSecretEnvName) is a blacklist — it misses a secret whose name doesn't look
 * credential-shaped (e.g. `INTERNAL_FOO`). The allowlist flips it: only env vars a
 * build/test toolchain legitimately needs reach the agent; everything else is
 * dropped. Kept deliberately GENEROUS (system + every common toolchain prefix) so
 * it does not break real builds; extend per target via FORGEPILOT_RUNNER_ENV_ALLOW.
 */
const ALLOWED_ENV_EXACT: ReadonlySet<string> = new Set([
  'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'PWD', 'OLDPWD', 'TERM', 'TZ',
  'LANG', 'LANGUAGE', 'TMPDIR', 'TMP', 'TEMP', 'SHLVL', 'HOSTNAME', 'CI',
  'COLUMNS', 'LINES', 'COLORTERM', 'SSH_AUTH_SOCK', 'DISPLAY', 'EDITOR',
  'GOPATH', 'GOROOT', 'GOCACHE', 'GOMODCACHE', 'GOBIN', 'GOFLAGS', 'GOPROXY',
])
const ALLOWED_ENV_PREFIX: readonly string[] = [
  'LC_', 'XDG_',
  'FORGEPILOT_',                                              // runner config
  'NODE_', 'npm_', 'NVM_', 'PNPM_', 'YARN_', 'BUN_', 'COREPACK_', // node/js
  'PYTHON', 'PYENV_', 'PIP_', 'VIRTUAL_ENV', 'CONDA_', 'POETRY_', // python
  'CARGO_', 'RUSTUP_', 'RUST_',                               // rust
  'JAVA_', 'JDK_', 'GRADLE_', 'MAVEN_', 'M2_',                // java
  'HOMEBREW_', 'BREW_',                                       // brew
  'DOTNET_', 'NUGET_',                                        // .net
  'COMPOSER_', 'PHP_',                                        // php
  'GEM_', 'BUNDLE_', 'RBENV_',                                // ruby
]

/** Read the per-run extra-allow list (FORGEPILOT_RUNNER_ENV_ALLOW=VAR1,VAR2). */
function readEnvAllowList(env: NodeJS.ProcessEnv): string[] {
  return (env.FORGEPILOT_RUNNER_ENV_ALLOW ?? '').split(',').map(s => s.trim()).filter(Boolean)
}

/** True when an env-var name is on the runner allowlist (system + toolchain + extra). */
export function isAllowedEnvName(name: string, extraAllow: readonly string[] = []): boolean {
  if (ALLOWED_ENV_EXACT.has(name)) return true
  if (extraAllow.includes(name)) return true
  return ALLOWED_ENV_PREFIX.some(prefix => name.startsWith(prefix))
}

export function buildRunnerBaseEnv(parentEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const extraAllow = readEnvAllowList(parentEnv)
  const base: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(parentEnv)) {
    if (key === 'NODE_ENV') continue                  // tool picks its own default
    if (isSecretEnvName(key)) continue                // never leak a credential (P4)
    if (!isAllowedEnvName(key, extraAllow)) continue  // default-deny unknown (D4)
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
