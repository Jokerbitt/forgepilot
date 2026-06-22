/**
 * Pure formatters that turn raw build/test command output into the concise log
 * lines persisted to a delegation's `.logs[]`.
 *
 * Before this, the runner logs persisted only the command lines ("$ npm run
 * build") plus output ONLY on failure — so a green build/test left no trace in
 * the API logs and the outcome was not reconstructable from the logs alone.
 * These helpers produce a short result line (success or failure) that always
 * carries a tail of the actual output, keeping the build/test verdict visible
 * in the logs either way.
 */

/** Take the last `n` non-empty lines of raw command output, joined by newline. */
export function lastOutputLines(output: string, n: number): string {
  if (!output) return ''
  const lines = output
    .split('\n')
    .map(line => line.replace(/\s+$/, ''))
    .filter(line => line.trim().length > 0)
  return lines.slice(-n).join('\n')
}

/**
 * Extract the "<N> passed" test count from a test runner's output (vitest / jest
 * style). vitest prints both "Test Files X passed" and "Tests  N passed (N)";
 * we prefer the per-test "Tests" line and fall back to the last "<N> passed"
 * occurrence so the file-count line never wins. Returns null when not found.
 */
export function parsePassedCount(output: string): number | null {
  if (!output) return null
  const testsLine = output.match(/Tests\s+(\d+)\s+passed/i)
  if (testsLine) {
    const n = Number(testsLine[1])
    if (Number.isFinite(n)) return n
  }
  const all = [...output.matchAll(/(\d+)\s+passed/gi)]
  if (all.length === 0) return null
  const n = Number(all[all.length - 1][1])
  return Number.isFinite(n) ? n : null
}

/** Concise green-build log line, with a short tail of the build output. */
export function formatBuildSuccessLog(output: string): string {
  const tail = lastOutputLines(output, 3)
  return tail ? `✅ Build grün.\n${tail}` : '✅ Build grün.'
}

/** Concise green-test log line, including the passed count when detectable. */
export function formatTestSuccessLog(output: string): string {
  const passed = parsePassedCount(output)
  const head = passed != null ? `✅ Tests grün (${passed} passed).` : '✅ Tests grün.'
  const tail = lastOutputLines(output, 3)
  return tail ? `${head}\n${tail}` : head
}

/**
 * Failure log line carrying a meaningful tail (default 800 chars) of the raw
 * output so the cause is reconstructable from the logs.
 */
export function formatFailureLog(label: string, output: string, maxChars = 800): string {
  const tail = (output ?? '').slice(-maxChars).trimEnd()
  return tail ? `${label}\n${tail}` : label
}
