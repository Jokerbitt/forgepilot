import fs from 'fs'
import path from 'path'
import type { PMAgentResult } from './pm-agent'

export const PM_PLAN_FILE = path.join(process.cwd(), 'config', 'pm-plan.json')
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export function readLastPMPlan(): PMAgentResult | null {
  try { return JSON.parse(fs.readFileSync(PM_PLAN_FILE, 'utf-8')) as PMAgentResult }
  catch { return null }
}

export function writePMPlan(plan: PMAgentResult): void {
  const tmp = PM_PLAN_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(plan, null, 2), 'utf-8')
  fs.renameSync(tmp, PM_PLAN_FILE)
}

export function isPlanStale(plan: PMAgentResult | null): boolean {
  if (!plan) return true
  if (!plan.runAt) return true
  const lastRun = new Date(plan.runAt).getTime()
  return Date.now() - lastRun > TWENTY_FOUR_HOURS_MS
}
