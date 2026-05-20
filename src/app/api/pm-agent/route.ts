export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { readProjectBriefs } from '@/lib/project-briefs'
import { readMilestones, readWorkPackages } from '@/lib/knowledge/milestone-store'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { runPMAgent, type PMAgentResult } from '@/lib/agent-runner/pm-agent'
import { appendPMHistory } from '@/lib/agent-runner/pm-history-store'
import { saveNotification } from '@/lib/notifications/notification-store'
import type { Delegation } from '@/lib/models/delegation'
import type { NotificationSeverity } from '@/lib/models/notification'

const PM_PLAN_FILE = path.join(process.cwd(), 'config', 'pm-plan.json')

function readDelegations(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config', 'delegations.json'), 'utf-8')) as Delegation[]
  } catch { return [] }
}

function readLastPMPlan(): PMAgentResult | null {
  try { return JSON.parse(fs.readFileSync(PM_PLAN_FILE, 'utf-8')) as PMAgentResult }
  catch { return null }
}

function writePMPlan(plan: PMAgentResult) {
  const tmp = PM_PLAN_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(plan, null, 2), 'utf-8')
  fs.renameSync(tmp, PM_PLAN_FILE)
}

export async function GET() {
  const plan = readLastPMPlan()
  return NextResponse.json({ plan })
}

export async function POST() {
  const storedKeys = readStoredApiKeys()
  const apiKey = storedKeys.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 422 })
  }

  const briefs = readProjectBriefs().filter(b => b.status !== 'archived')
  const milestones = readMilestones()
  const workPackages = readWorkPackages()
  const delegations = readDelegations()

  try {
    const result = await runPMAgent(briefs, milestones, workPackages, delegations, { apiKey })
    writePMPlan(result)
    appendPMHistory(result)

    if (result.overallHealth === 'red' || result.overallHealth === 'yellow') {
      const severity: NotificationSeverity = result.overallHealth === 'red' ? 'critical' : 'warning'
      const title = result.overallHealth === 'red'
        ? 'PM Agent: Kritische Blocker'
        : 'PM Agent: Warnung'
      const body = result.blockers.slice(0, 2).join(' · ')
      saveNotification({
        id: crypto.randomUUID(),
        type: 'pm-alert',
        severity,
        title,
        body: body || result.summary.slice(0, 120),
        link: '/pm-agent',
        read: false,
        createdAt: new Date().toISOString(),
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
