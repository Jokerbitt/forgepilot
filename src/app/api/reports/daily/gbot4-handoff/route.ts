export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { buildDailyReport } from '@/lib/reports/daily-report'
import { scrubSecrets } from '@/lib/reports/scrub-secrets'
import { createDelegationRepository, getDelegationStorageMode, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { createKnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'
import { createProjectBriefRepository } from '@/lib/repositories/projectBriefRepository'
import { getOpenAttentionItems } from '@/lib/attention/store'

/** Issue-ID pattern used by ForgePilot + Linear (e.g. JOK-172, FP-3) */
const ISSUE_ID_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/g

/** Pull-request URL pattern for public GitHub repos */
const PR_URL_PATTERN = /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/g

export interface Gbot4HandoffPackage {
  generatedAt: string
  /** Full Gbot4 prompt with the report embedded — ready to paste into Grok/GPT */
  promptTemplate: string
  /** Scrubbed Daily Report in Markdown — safe to share */
  reportMarkdown: string
  safeContext: {
    activeDelegations: number
    pendingApprovals: number
    /** Linear/GitHub Issue-IDs extracted from the report — no tokens, no payloads */
    openLinearIssues: string[]
    /** Public PR-URLs extracted from the report */
    recentPRUrls: string[]
  }
  /** Human-readable instructions for the Gbot4 workflow */
  instructions: string
}

function buildPromptTemplate(reportMarkdown: string): string {
  return `Du bist ein unabhaengiger Critic fuer das ForgePilot-Projekt.
Analysiere den folgenden Daily Report und gib strukturiertes Feedback.

## Dein Auftrag
1. Identifiziere 2-3 kritische Risiken oder Qualitaetsprobleme
2. Bewerte den Fortschritt (1-10) mit kurzer Begruendung
3. Empfehle die naechste wichtigste Aktion

## Hinweise
- Du arbeitest AUSSCHLIESSLICH mit dem untenstehenden Report-Inhalt.
- Du hast KEINEN Zugriff auf API-Keys, Tokens oder interne Systeme.
- Halte dich an den vorgegebenen JSON-Output.

## Daily Report
${reportMarkdown}

## Format deiner Antwort
Antworte mit validem JSON:
{
  "verdict": "approved" | "needs_attention" | "critical",
  "score": 1-10,
  "risks": ["Risiko 1", "Risiko 2"],
  "recommendation": "Eine konkrete naechste Aktion",
  "linearComment": "Kurzer Kommentar fuer Linear-Issue"
}`
}

export async function GET(): Promise<NextResponse<Gbot4HandoffPackage | { error: string }>> {
  try {
    const delegationRepo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const projectBriefRepo = createProjectBriefRepository(SINGLE_TENANT_USER_ID)
    const knowledgeRepo = createKnowledgeCardRepository(SINGLE_TENANT_USER_ID)

    const [delegations, projectBriefs, knowledgeCards] = await Promise.all([
      delegationRepo.listByStatus(),
      projectBriefRepo.listAll(),
      knowledgeRepo.listAll(),
    ])

    const report = buildDailyReport({
      delegations,
      projectBriefs,
      knowledgeCards,
      attentionItems: getOpenAttentionItems(),
      storageMode: getDelegationStorageMode(process.env),
      authDisabled: process.env.FORGEPILOT_AUTH_DISABLED === 'true',
    })

    // Always scrub — defence in depth
    const reportMarkdown = scrubSecrets(report.markdown)

    // Extract safe context references (IDs and public URLs only)
    const issueMatches = reportMarkdown.match(ISSUE_ID_PATTERN) ?? []
    const prMatches = reportMarkdown.match(PR_URL_PATTERN) ?? []
    const openLinearIssues = [...new Set(issueMatches)]
    const recentPRUrls = [...new Set(prMatches)]

    const pendingApprovals = delegations.filter(d => d.status === 'pending').length
    const activeDelegations = delegations.filter(d =>
      d.status === 'running' || d.status === 'approved',
    ).length

    const handoff: Gbot4HandoffPackage = {
      generatedAt: report.generatedAt,
      promptTemplate: buildPromptTemplate(reportMarkdown),
      reportMarkdown,
      safeContext: {
        activeDelegations,
        pendingApprovals,
        openLinearIssues,
        recentPRUrls,
      },
      instructions: [
        '1. Kopiere den "promptTemplate"-Wert vollstaendig.',
        '2. Oeffne Grok/GPT und fuege den Prompt ein.',
        '3. Kopiere die JSON-Antwort.',
        '4. Kehre zu ForgePilot zurueck und fuege das Feedback unter "Grok Feedback einfuegen" ein.',
        '5. Klicke "Feedback speichern" — ForgePilot erstellt daraus ein Attention Item.',
        '',
        'Sicherheitshinweis: Dieser Handoff enthaelt KEINE API-Keys, Tokens oder Secrets.',
        'Teile niemals FORGEPILOT_ADMIN_PASSWORD, NEXTAUTH_SECRET oder andere Credentials mit externen Diensten.',
      ].join('\n'),
    }

    return NextResponse.json(handoff, {
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to build Gbot4 handoff package: ${message}` },
      { status: 500 },
    )
  }
}
