import type { Delegation, DelegationReport, CriticScore } from '@/lib/models/delegation'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { runGrokCritic, type GrokCriticResult } from './grok-critic'

export function mapGrokResultToCriticScore(result: GrokCriticResult): CriticScore {
  const verdictMap: Record<GrokCriticResult['verdict'], CriticScore['verdict']> = {
    PASS: 'approved',
    NEEDS_REVISION: 'needs-revision',
    FAIL: 'rejected',
  }

  return {
    correctness: result.correctnessScore,
    efficiency: result.efficiencyScore,
    drift: result.driftScore,
    verdict: verdictMap[result.verdict],
    summary: result.reason,
    runAt: result.evaluatedAt,
  }
}

export function buildCriticAgentOutput(report: DelegationReport | undefined, fallback: string): string {
  const parts = [
    ...(report?.keyPoints ?? []),
    ...(report?.changes ?? []),
    ...(report?.filesAdded?.map(file => `Added: ${file}`) ?? []),
    ...(report?.filesModified?.map(file => `Modified: ${file}`) ?? []),
    ...(report?.filesDeleted?.map(file => `Deleted: ${file}`) ?? []),
    ...(typeof report?.testsPassed === 'number' ? [`Tests passed: ${report.testsPassed}`] : []),
    ...(typeof report?.linesAdded === 'number' ? [`Lines added: ${report.linesAdded}`] : []),
    ...(typeof report?.linesRemoved === 'number' ? [`Lines removed: ${report.linesRemoved}`] : []),
    ...(report?.prUrl ? [`Pull request: ${report.prUrl}`] : []),
    ...(report?.warnings?.map(warning => `Warning: ${warning}`) ?? []),
  ].filter(Boolean)

  return parts.length > 0 ? parts.join('\n') : fallback
}

export async function persistGrokCriticForDelegation(
  delegation: Delegation,
  report: DelegationReport | undefined = delegation.summaryReport,
): Promise<CriticScore | null> {
  const result = await runGrokCritic({
    delegationTitle: delegation.title || delegation.contract.goal,
    delegationContract: delegation.contract.goal,
    acceptanceCriteria: delegation.contract.definitionOfDone ?? [],
    agentOutput: buildCriticAgentOutput(report, delegation.contract.goal),
    filesChanged: [
      ...(report?.filesAdded ?? []),
      ...(report?.filesModified ?? []),
      ...(report?.filesDeleted ?? []),
    ],
  })

  if (!result) return null

  const criticScore = mapGrokResultToCriticScore(result)
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  await repo.update(delegation.id, { criticScore })
  return criticScore
}
