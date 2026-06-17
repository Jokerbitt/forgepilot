export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { BUILDING_BLOCKS } from '@/lib/building-blocks/registry'

/**
 * GET /api/building-blocks
 * Returns the catalog of reusable SaaS building blocks for the UI library view.
 */
export async function GET() {
  const blocks = BUILDING_BLOCKS.map(b => ({
    id: b.id,
    name: b.name,
    category: b.category,
    stack: b.stack,
    summary: b.summary,
    whenToUse: b.whenToUse,
    dependencies: b.dependencies,
    fileCount: b.files.length,
    files: b.files.map(f => ({ dest: f.dest, note: f.note })),
    setupSteps: b.setupSteps,
  }))

  const byCategory: Record<string, number> = {}
  for (const b of BUILDING_BLOCKS) byCategory[b.category] = (byCategory[b.category] ?? 0) + 1

  return NextResponse.json({
    total: blocks.length,
    totalFiles: BUILDING_BLOCKS.reduce((n, b) => n + b.files.length, 0),
    byCategory,
    blocks,
  })
}
