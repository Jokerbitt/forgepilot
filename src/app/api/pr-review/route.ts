export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { runPRReview } from '@/lib/agent-runner/pr-reviewer'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { PRReviewSchema } from '@/lib/validation/schemas'

export async function POST(req: Request) {
  const body = await parseBody(req, PRReviewSchema)
  if (isValidationError(body)) return body

  const { prNumber, delegationId, expectedScope } = body

  const storedKeys = readStoredApiKeys()
  const ghToken =
    storedKeys.GITHUB_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim()

  if (!ghToken) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN not configured. Bitte in den Einstellungen hinterlegen.' },
      { status: 422 }
    )
  }

  try {
    const result = await runPRReview({ prNumber, ghToken, delegationId, expectedScope })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Review fehlgeschlagen: ${message}` }, { status: 500 })
  }
}
