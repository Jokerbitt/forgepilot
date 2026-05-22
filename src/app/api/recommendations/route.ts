import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { prioritizeJokItems } from '@/lib/nba-engine/prioritizer'
import type { WorkItem, RecommendationResult } from '@/lib/nba-engine/types'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 20

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')
const LINEAR_FILE = path.join(process.cwd(), 'config', 'linear-issues.json')

function readJsonFile<T>(filePath: string): T[] {
  try {
    if (!fs.existsSync(filePath)) return []
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as T[]
  } catch {
    return []
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<RecommendationResult>> {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, limitParam ? parseInt(limitParam, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT),
    )

    const items: WorkItem[] = [
      ...readJsonFile<WorkItem>(DELEGATIONS_FILE),
      ...readJsonFile<WorkItem>(LINEAR_FILE),
    ]

    const scored = prioritizeJokItems(items)
    const top = scored.slice(0, limit)

    const result: RecommendationResult = {
      items: top,
      generatedAt: new Date().toISOString(),
      totalItems: scored.length,
    }

    return NextResponse.json(result)
  } catch {
    const fallback: RecommendationResult = {
      items: [],
      generatedAt: new Date().toISOString(),
      totalItems: 0,
    }
    return NextResponse.json(fallback)
  }
}
