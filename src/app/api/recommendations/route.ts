import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { readConnectorConfigs } from '@/lib/connectors/config'
import { fetchLinearWorkItems } from '@/lib/connectors/linear-items'
import { fetchGitHubWorkItems } from '@/lib/connectors/github-items'
import { prioritizeItems } from '@/lib/nba-engine/prioritizer'
import type { WorkItem } from '@/lib/models/work-item'

export const dynamic = 'force-dynamic'

const LOCAL_ITEMS_FILE = path.join(process.cwd(), 'config', 'local-items.json')

function readLocalWorkItems(): WorkItem[] {
  try {
    if (!fs.existsSync(LOCAL_ITEMS_FILE)) {
      return []
    }

    return JSON.parse(fs.readFileSync(LOCAL_ITEMS_FILE, 'utf8')) as WorkItem[]
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const configs = readConnectorConfigs()

  try {
    const fetchers: Promise<WorkItem[]>[] = [
      fetchLinearWorkItems(configs.linear ?? {}),
      fetchGitHubWorkItems(configs.github ?? {})
    ]

    const results = await Promise.allSettled(fetchers)

    const items: WorkItem[] = []
    const errors: string[] = []
    
    items.push(...readLocalWorkItems())

    for (const result of results) {
      if (result.status === 'fulfilled') {
        items.push(...result.value)
      } else {
        errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
      }
    }

    // Pass all items through the NBA prioritizer
    const recommendations = prioritizeItems(items)

    return NextResponse.json({
      recommendations,
      total: recommendations.length,
      ...(errors.length > 0 ? { errors } : {}),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch recommendations',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
