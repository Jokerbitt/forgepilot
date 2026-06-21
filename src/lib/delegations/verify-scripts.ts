/**
 * Resolve a repo's verify scripts from its package.json `scripts` map.
 *
 * ForgePilot's own convention is `test:run`, but an external target repo (a
 * standalone Next.js/Prisma app, say) commonly uses `test`. The build/test gates
 * and the agent prompt must run the script that ACTUALLY exists — otherwise the
 * gate silently skips (false-green) or the agent runs a missing script and the
 * run is wasted on a pointless retry. Pure + unit-testable.
 */

export interface VerifyScripts {
  /** Build script name, or null if none. */
  build: string | null
  /** Best test script name (prefers a non-watch run), or null if none. */
  test: string | null
  /** Lint script name, or null. */
  lint: string | null
  /** Type-check script name, or null. */
  typeCheck: string | null
}

/** Preference order for the test script — a non-watch run first. */
const TEST_PREFERENCE = ['test:run', 'test:ci', 'test:unit', 'test']
const TYPECHECK_PREFERENCE = ['type-check', 'typecheck', 'tsc']

function pick(scripts: Record<string, string>, names: string[]): string | null {
  for (const name of names) {
    const value = scripts[name]
    if (typeof value === 'string' && value.trim().length > 0) return name
  }
  return null
}

/** Resolve the build/test/lint/type-check script names a repo actually has. */
export function resolveVerifyScripts(scripts: Record<string, string> | undefined | null): VerifyScripts {
  const s = scripts ?? {}
  return {
    build: pick(s, ['build']),
    test: pick(s, TEST_PREFERENCE),
    lint: pick(s, ['lint']),
    typeCheck: pick(s, TYPECHECK_PREFERENCE),
  }
}

/** Build a `&&`-joined verify command from the scripts a repo actually has. */
export function verifyCommand(scripts: Record<string, string> | undefined | null): string {
  const v = resolveVerifyScripts(scripts)
  const parts: string[] = []
  if (v.test) parts.push(`npm run ${v.test}`)
  if (v.lint) parts.push('npm run lint')
  if (v.typeCheck) parts.push(`npm run ${v.typeCheck}`)
  if (parts.length === 0 && v.build) parts.push('npm run build')
  return parts.join(' && ') || 'npm run build'
}
