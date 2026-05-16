import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { readConnectorConfigsFromEnv } from '@/lib/connectors/config'
import { fetchLinearWorkItems } from '@/lib/connectors/linear-items'
import { fetchGitHubWorkItems } from '@/lib/connectors/github-items'
import type { WorkItem } from '@/lib/models/work-item'

export const dynamic = 'force-dynamic'

type Source = 'all' | 'linear' | 'github' | 'local'

const LOCAL_ITEMS_FILE = path.join(process.cwd(), 'config', 'local-items.json')

function readLocalWorkItems(): WorkItem[] {
  try {
    if (!fs.existsSync(LOCAL_ITEMS_FILE)) {
      return []
    }

    return JSON.parse(fs.readFileSync(LOCAL_ITEMS_FILE, 'utf-8')) as WorkItem[]
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const source = (request.nextUrl.searchParams.get('source') ?? 'all') as Source
  const configs = readConnectorConfigsFromEnv(process.env)

  try {
    const fetchers: Promise<WorkItem[]>[] = []

    if (source === 'all' || source === 'linear') {
      fetchers.push(fetchLinearWorkItems(configs.linear ?? {}))
    }
    if (source === 'all' || source === 'github') {
      fetchers.push(fetchGitHubWorkItems(configs.github ?? {}))
    }
    if (source === 'all' || source === 'local') {
      fetchers.push(Promise.resolve(readLocalWorkItems()))
    }

    const results = await Promise.allSettled(fetchers)

    const items: WorkItem[] = []
    const errors: string[] = []

    for (const result of results) {
      if (result.status === 'fulfilled') {
        items.push(...result.value)
      } else {
        errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
      }
    }

    items.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

    return NextResponse.json({
      items,
      total: items.length,
      ...(errors.length > 0 ? { errors } : {}),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch work items',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
