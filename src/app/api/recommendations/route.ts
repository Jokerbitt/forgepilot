import { NextRequest, NextResponse } from 'next/server'
import { readConnectorConfigsFromEnv } from '@/lib/connectors/config'
import { fetchLinearWorkItems } from '@/lib/connectors/linear-items'
import { fetchGitHubWorkItems } from '@/lib/connectors/github-items'
import { prioritizeItems } from '@/lib/nba-engine/prioritizer'
import type { WorkItem } from '@/lib/models/work-item'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const configs = readConnectorConfigsFromEnv(process.env)

  try {
    const fetchers: Promise<WorkItem[]>[] = [
      fetchLinearWorkItems(configs.linear ?? {}),
      fetchGitHubWorkItems(configs.github ?? {})
    ]

    const results = await Promise.allSettled(fetchers)

    const items: WorkItem[] = []
    const errors: string[] = []
    
    // Load local items
    try {
      const fs = require('fs')
      const path = require('path')
      const localItemsPath = path.join(process.cwd(), 'config', 'local-items.json')
      if (fs.existsSync(localItemsPath)) {
        const localItems = JSON.parse(fs.readFileSync(localItemsPath, 'utf8'))
        items.push(...localItems)
      }
    } catch (e) {
      console.error('Failed to load local items', e)
    }

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
