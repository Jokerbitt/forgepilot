import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { readResearchDocuments, upsertResearchDocument } from '@/lib/knowledge/research-store'
import { runResearchAgent } from '@/lib/agent-runner/research-agent'
import { readStoredApiKeys } from '@/lib/connectors/config'
import type { ResearchDocument } from '@/lib/models/research'

export async function GET() {
  const docs = readResearchDocuments()
  return NextResponse.json(docs)
}

export async function POST(req: Request) {
  const body = await req.json() as {
    topic: string
    question?: string
    relatedWorkItemId?: string
    relatedProjectBriefId?: string
    tags?: string[]
  }

  if (!body.topic?.trim()) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 })
  }

  const storedKeys = readStoredApiKeys()
  const apiKey = storedKeys.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY nicht konfiguriert. Bitte in den Einstellungen hinterlegen.' },
      { status: 422 },
    )
  }

  const now = new Date().toISOString()
  const doc: ResearchDocument = {
    id: nanoid(10),
    topic: body.topic.trim(),
    question: body.question?.trim() || undefined,
    status: 'running',
    keyFindings: [],
    sections: [],
    citations: [],
    tags: body.tags ?? [],
    relatedWorkItemId: body.relatedWorkItemId,
    relatedProjectBriefId: body.relatedProjectBriefId,
    createdAt: now,
    updatedAt: now,
    model: 'claude-opus-4-7',
  }

  upsertResearchDocument(doc)

  // Run research asynchronously
  void (async () => {
    try {
      const result = await runResearchAgent(doc, { apiKey })
      const completed: ResearchDocument = {
        ...doc,
        ...result,
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      upsertResearchDocument(completed)
    } catch (err) {
      const failed: ResearchDocument = {
        ...doc,
        status: 'failed',
        abstract: `Fehler: ${(err as Error).message.slice(0, 300)}`,
        updatedAt: new Date().toISOString(),
      }
      upsertResearchDocument(failed)
    }
  })()

  return NextResponse.json({ id: doc.id, status: 'running' }, { status: 202 })
}
