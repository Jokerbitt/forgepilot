/**
 * CLI for token-free scaffolding from a building-blocks bundle.
 *
 *   npx tsx scripts/create-app.ts --bundle saas-starter --target ~/dev/my-app
 *   npx tsx scripts/create-app.ts --blocks connector-email,connector-storage --target ./app
 *   npx tsx scripts/create-app.ts --bundle ai-app --target ./app --dry-run
 *
 * Copies vetted block files straight in — no LLM tokens. The agent then only
 * writes the app-specific code on top.
 */
import { createApp, summarizeCreateApp } from '../src/lib/building-blocks/create-app'

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function main(): void {
  const bundleId = arg('--bundle')
  const blocksRaw = arg('--blocks')
  const targetDir = arg('--target')
  const dryRun = process.argv.includes('--dry-run')
  const force = process.argv.includes('--force')

  if (!targetDir || (!bundleId && !blocksRaw)) {
    // eslint-disable-next-line no-console
    console.error('Usage: create-app.ts (--bundle <id> | --blocks <id,id>) --target <dir> [--dry-run] [--force]')
    process.exit(1)
  }

  const result = createApp({
    bundleId,
    blockIds: blocksRaw?.split(',').map(s => s.trim()).filter(Boolean),
    targetDir: targetDir!,
    dryRun,
    force,
  })

  // eslint-disable-next-line no-console
  console.log(`${dryRun ? '[dry-run] ' : ''}${summarizeCreateApp(result)}`)
  if (result.plan.setupSteps.length) {
    // eslint-disable-next-line no-console
    console.log('\nNext steps:')
    for (const step of result.plan.setupSteps) console.log('  -', step)
  }
}

main()
