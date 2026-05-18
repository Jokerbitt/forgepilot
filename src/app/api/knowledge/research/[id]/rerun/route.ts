import { NextResponse } from 'next/server'
import { getResearchDocument, upsertResearchDocument } from '@/lib/knowledge/research-store'
import { runResearchAgent } from '@/lib/agent-runner/research-agent'
import { readStoredApiKeys } from '@/lib/connectors/config'
import type { ResearchDocument } from '@/lib/models/research'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const existing = getResearchDocument(params.id)
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (existing.status === 'running') {
    return NextResponse.json({ error: 'Research is already running' }, { status: 409 })
  }

  const storedKeys = readStoredApiKeys()
  const apiKey = storedKeys.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY nicht konfiguriert' },
      { status: 422 },
    )
  }

  const now = new Date().toISOString()
  const restarted: ResearchDocument = {
    ...existing,
    status: 'running',
    abstract: undefined,
    keyFindings: [],
    sections: [],
    citations: [],
    completedAt: undefined,
    updatedAt: now,
    model: 'claude-opus-4-7',
  }
  upsertResearchDocument(restarted)

  void (async () => {
    try {
      const result = await runResearchAgent(restarted, { apiKey })
      upsertResearchDocument({
        ...restarted,
        ...result,
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      upsertResearchDocument({
        ...restarted,
        status: 'failed',
        abstract: `Fehler: ${(err as Error).message.slice(0, 300)}`,
        updatedAt: new Date().toISOString(),
      })
    }
  })()

  return NextResponse.json({ id: restarted.id, status: 'running' }, { status: 202 })
}
