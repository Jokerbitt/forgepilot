export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { upsertAttentionItem } from '@/lib/attention/store'
import type { AttentionItem } from '@/lib/models/attention'

export type Gbot4Verdict = 'approved' | 'needs_attention' | 'critical'

export interface Gbot4FeedbackBody {
  verdict: Gbot4Verdict
  score: number
  risks: string[]
  recommendation: string
  linearComment: string
  /** Optional: attach feedback to a specific Linear Issue ID (e.g. "JOK-172") */
  sourceIssueId?: string
}

export interface Gbot4FeedbackResponse {
  saved: boolean
  attentionItemId: string
}

function verdictToSeverity(verdict: Gbot4Verdict): AttentionItem['severity'] {
  if (verdict === 'critical') return 'critical'
  if (verdict === 'needs_attention') return 'warning'
  return 'info'
}

function isGbot4FeedbackBody(body: unknown): body is Gbot4FeedbackBody {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  const verdicts: Gbot4Verdict[] = ['approved', 'needs_attention', 'critical']
  if (!verdicts.includes(b.verdict as Gbot4Verdict)) return false
  if (typeof b.score !== 'number' || b.score < 1 || b.score > 10) return false
  if (!Array.isArray(b.risks)) return false
  if (typeof b.recommendation !== 'string' || b.recommendation.trim() === '') return false
  if (typeof b.linearComment !== 'string') return false
  return true
}

/**
 * POST /api/reports/daily/gbot4-feedback
 *
 * Accepts Gbot4/Grok critic feedback and saves it as an AttentionItem.
 * No API keys or tokens are accepted — only the structured feedback payload.
 */
export async function POST(req: NextRequest): Promise<NextResponse<Gbot4FeedbackResponse | { error: string }>> {
  let body: unknown
  try {
    body = await req.json() as unknown
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isGbot4FeedbackBody(body)) {
    return NextResponse.json(
      {
        error: 'Invalid feedback payload. Required fields: verdict (approved|needs_attention|critical), score (1-10), risks (array), recommendation (string), linearComment (string).',
      },
      { status: 422 },
    )
  }

  const id = randomUUID()
  const riskList = body.risks.slice(0, 5).map(r => `- ${String(r)}`).join('\n')
  const issueNote = body.sourceIssueId ? ` (Issue: ${body.sourceIssueId})` : ''

  const attentionItem: AttentionItem = {
    id,
    type: 'review_passed',
    severity: verdictToSeverity(body.verdict),
    title: `Grok Critic: ${body.verdict.toUpperCase()} — Score ${body.score}/10${issueNote}`,
    body: [
      `**Verdict:** ${body.verdict}`,
      `**Score:** ${body.score}/10`,
      ``,
      `**Risks identified:**`,
      riskList || '- None reported',
      ``,
      `**Recommendation:** ${body.recommendation}`,
      ``,
      `**Linear comment:** ${body.linearComment}`,
    ].join('\n'),
    createdAt: new Date().toISOString(),
  }

  upsertAttentionItem(attentionItem)

  return NextResponse.json({ saved: true, attentionItemId: id }, { status: 201 })
}
