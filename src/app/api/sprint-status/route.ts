export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Delegation } from '@/lib/models/delegation'

const CONFIG_DIR = path.join(process.cwd(), 'config')

export interface CriticalPathIssue {
  id: string
  title: string
  status: string
}

export interface SprintStatusResponse {
  sprintName: string
  done: number
  total: number
  inProgress: CriticalPathIssue[]
  percent: number
}

interface LinearIssue {
  id: string
  title: string
  status: string
  description?: string
}

const FALLBACK: SprintStatusResponse = {
  sprintName: 'Sprint',
  done: 0,
  total: 0,
  inProgress: [],
  percent: 0,
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
  } catch {
    return null
  }
}

export async function GET(): Promise<NextResponse<SprintStatusResponse>> {
  try {
    const linearIssues = readJson<LinearIssue[]>(path.join(CONFIG_DIR, 'linear-issues.json'))

    if (linearIssues && linearIssues.length > 0) {
      const done = linearIssues.filter(i =>
        /done|completed|merged|closed/i.test(i.status),
      ).length
      const total = linearIssues.length
      const percent = total > 0 ? Math.round((done / total) * 100) : 0

      const inProgress: CriticalPathIssue[] = linearIssues
        .filter(i => /in.?progress|review|started/i.test(i.status))
        .slice(0, 5)
        .map(i => ({ id: i.id, title: i.title, status: i.status }))

      return NextResponse.json({
        sprintName: 'Current Sprint',
        done,
        total,
        inProgress,
        percent,
      })
    }

    // Fallback: derive from delegations
    const delegations = readJson<Delegation[]>(path.join(CONFIG_DIR, 'delegations.json'))
    if (!delegations || delegations.length === 0) {
      return NextResponse.json(FALLBACK)
    }

    const done = delegations.filter(d => d.status === 'completed').length
    const total = delegations.length
    const percent = total > 0 ? Math.round((done / total) * 100) : 0

    const inProgress: CriticalPathIssue[] = delegations
      .filter(d => d.status === 'running')
      .slice(0, 5)
      .map(d => ({
        id: d.id,
        title: d.title ?? d.id,
        status: d.status,
      }))

    return NextResponse.json({
      sprintName: 'Sprint (Delegations)',
      done,
      total,
      inProgress,
      percent,
    })
  } catch {
    return NextResponse.json(FALLBACK)
  }
}
