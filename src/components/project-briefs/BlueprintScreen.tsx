'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ProjectBrief, Requirement, UseCase, Risk, Finding, FindingConfidence } from '@/lib/models/project-brief'

interface Props {
  initialBrief: ProjectBrief
}

const STATUS_LABELS: Record<ProjectBrief['status'], string> = {
  draft: 'Entwurf',
  in_review: 'In Review',
  accepted: 'Freigegeben',
  archived: 'Archiviert',
}

const STATUS_COLORS: Record<ProjectBrief['status'], string> = {
  draft: 'bg-gray-800 text-gray-400',
  in_review: 'bg-yellow-900/40 text-yellow-400',
  accepted: 'bg-green-900/40 text-green-400',
  archived: 'bg-gray-900 text-gray-600',
}

const PRIORITY_COLORS: Record<Requirement['priority'], string> = {
  must:   'bg-red-900/40 text-red-400',
  should: 'bg-yellow-900/40 text-yellow-400',
  could:  'bg-blue-900/40 text-blue-400',
  wont:   'bg-gray-800 text-gray-600',
}

const PRIORITY_LABELS: Record<Requirement['priority'], string> = {
  must: 'Muss', should: 'Sollte', could: 'Könnte', wont: 'Nicht',
}

export function BlueprintScreen({ initialBrief }: Props) {
  const router = useRouter()
  const [brief, setBrief] = useState<ProjectBrief>(initialBrief)
  const [generating, startGenerate] = useTransition()
  const [approving, startApprove] = useTransition()
  const [delegating, startDelegate] = useTransition()
  const [researching, startResearch] = useTransition()
  const [generationNotes, setGenerationNotes] = useState('')
  const [researchNotes, setResearchNotes] = useState('')
  const [researchError, setResearchError] = useState('')
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [delegationError, setDelegationError] = useState('')

  const acceptedReqs = brief.requirements.filter(r => r.status === 'accepted')
  const proposedReqs = brief.requirements.filter(r => r.status === 'proposed')
  const canApprove   = acceptedReqs.length > 0 && brief.status !== 'accepted' && brief.status !== 'archived'

  // Group requirements by priority
  const byPriority = (['must', 'should', 'could', 'wont'] as const).map(p => ({
    priority: p,
    items: brief.requirements.filter(r => r.priority === p && r.status !== 'rejected'),
  })).filter(g => g.items.length > 0)

  async function patchBrief(patch: Partial<ProjectBrief>) {
    const res = await fetch(`/api/project-briefs/${brief.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const updated = await res.json() as ProjectBrief
      setBrief(updated)
    }
  }

  async function patchRequirement(requirementId: string, status: Requirement['status']) {
    const res = await fetch(`/api/project-briefs/${brief.id}/requirements`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requirementId, status }),
    })
    if (res.ok) {
      const updatedReqs = await res.json() as Requirement[]
      setBrief(prev => ({ ...prev, requirements: updatedReqs }))
    }
  }

  function handleGenerate() {
    startGenerate(async () => {
      const res = await fetch(`/api/project-briefs/${brief.id}/generate-requirements`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json() as { brief: ProjectBrief; generationNotes: string }
        setBrief(data.brief)
        setGenerationNotes(data.generationNotes)
      }
    })
  }

  function handleApprove() {
    startApprove(async () => {
      await patchBrief({
        status: 'accepted',
        reviewedAt: new Date().toISOString(),
        reviewedBy: 'user',
      })
      setShowApproveConfirm(false)
    })
  }

  async function handleArchive() {
    await patchBrief({ status: 'archived' })
    setShowArchiveConfirm(false)
    router.push('/project-briefs')
  }

  function handleResearch() {
    setResearchError('')
    setResearchNotes('')
    startResearch(async () => {
      const res = await fetch(`/api/project-briefs/${brief.id}/research-run`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json() as {
          generationNotes: string
          newRequirementsCount: number
          newRisksCount: number
        }
        setResearchNotes(
          `Research abgeschlossen: +${data.newRequirementsCount} Requirements, +${data.newRisksCount} Risiken. ${data.generationNotes}`
        )
        // Reload brief to get enriched requirements/risks
        const briefRes = await fetch(`/api/project-briefs/${brief.id}`)
        if (briefRes.ok) setBrief(await briefRes.json() as ProjectBrief)
      } else {
        const err = await res.json() as { error?: string }
        setResearchError(err.error ?? 'Research fehlgeschlagen')
      }
    })
  }

  function handleDelegate() {
    setDelegationError('')
    startDelegate(async () => {
      const res = await fetch(`/api/project-briefs/${brief.id}/create-delegation`, {
        method: 'POST',
      })
      if (res.ok) {
        const delegation = await res.json() as { id: string }
        router.push(`/delegations/${delegation.id}`)
      } else {
        const err = await res.json() as { error?: string }
        setDelegationError(err.error ?? 'Fehler beim Erstellen der Delegation')
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/project-briefs" className="hover:text-gray-300 transition-colors">Projekte</Link>
          <span>›</span>
          <span className="text-gray-300 truncate max-w-xs">{brief.title}</span>
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{brief.title}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[brief.status]}`}>
                {STATUS_LABELS[brief.status]}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Erstellt {new Date(brief.createdAt).toLocaleDateString('de-DE')} ·
              Scope: {brief.scope} ·
              {brief.requirements.length} Requirements ({acceptedReqs.length} akzeptiert)
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {brief.status !== 'accepted' && brief.status !== 'archived' && (
              <>
                <button
                  onClick={handleResearch}
                  disabled={researching || generating}
                  className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {researching ? (
                    <><span className="animate-spin">⟳</span> Recherchiert…</>
                  ) : (
                    <>🔍 Research starten</>
                  )}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating || researching}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {generating ? (
                    <><span className="animate-spin">⟳</span> Generiere…</>
                  ) : (
                    <>✨ Requirements generieren</>
                  )}
                </button>
              </>
            )}

            {canApprove && (
              <button
                onClick={() => setShowApproveConfirm(true)}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                ✓ Brief freigeben
              </button>
            )}

            {brief.status === 'accepted' && (
              <button
                onClick={handleDelegate}
                disabled={delegating}
                className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5"
              >
                {delegating ? (
                  <><span className="animate-spin">⟳</span> Erstelle…</>
                ) : (
                  <>🚀 Delegation starten</>
                )}
              </button>
            )}

            {brief.status !== 'archived' && (
              <button
                onClick={() => setShowArchiveConfirm(true)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
              >
                Archivieren
              </button>
            )}
          </div>
        </div>

        {/* KI Notes Banner */}
        {generationNotes && (
          <div className="mb-4 p-3 bg-blue-950/40 border border-blue-800/50 rounded-lg text-sm text-blue-300 flex gap-2">
            <span className="shrink-0">💡</span>
            <span><strong>KI-Annahmen:</strong> {generationNotes}</span>
          </div>
        )}

        {/* Research Success Banner */}
        {researchNotes && (
          <div className="mb-4 p-3 bg-indigo-950/40 border border-indigo-800/50 rounded-lg text-sm text-indigo-300 flex items-center gap-2">
            <span className="shrink-0">🔍</span>
            <span>{researchNotes}</span>
            <button onClick={() => setResearchNotes('')} className="ml-auto text-indigo-500 hover:text-indigo-300">✕</button>
          </div>
        )}

        {/* Research Error Banner */}
        {researchError && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-sm text-red-300 flex items-center gap-2">
            <span>⚠️</span>
            <span>{researchError}</span>
            <button onClick={() => setResearchError('')} className="ml-auto text-red-500 hover:text-red-300">✕</button>
          </div>
        )}

        {/* Delegation Error Banner */}
        {delegationError && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-sm text-red-300 flex items-center gap-2">
            <span>⚠️</span>
            <span>{delegationError}</span>
            <button onClick={() => setDelegationError('')} className="ml-auto text-red-500 hover:text-red-300">✕</button>
          </div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT — Overview */}
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Projektübersicht</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Idee</p>
                  <blockquote className="text-sm text-gray-300 italic border-l-2 border-gray-700 pl-3">{brief.rawIdea}</blockquote>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Problem</p>
                  <p className="text-sm text-white">{brief.problemStatement}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Ziel</p>
                  <p className="text-sm text-white">{brief.desiredOutcome}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Zielgruppe</p>
                  <p className="text-sm text-white">{brief.targetAudience}</p>
                </div>
                {brief.constraints.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Constraints</p>
                    <div className="flex flex-wrap gap-1">
                      {brief.constraints.map((c, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
                {brief.nonGoals.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Nicht-Ziele</p>
                    <ul className="space-y-0.5">
                      {brief.nonGoals.map((g, i) => (
                        <li key={i} className="text-xs text-gray-500 line-through">{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Research Brief */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Research</h2>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-1.5 py-0.5 text-xs rounded bg-gray-800 text-gray-400">{brief.privacyMode}</span>
                <span className="px-1.5 py-0.5 text-xs rounded bg-gray-800 text-gray-400">{brief.researchMode}</span>
              </div>
              <Link
                href={`/api/project-briefs/${brief.id}/research-brief`}
                target="_blank"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Research Brief ansehen →
              </Link>
            </div>

            {/* Research Findings */}
            {brief.lastResearchRun && (
              <FindingsPanel run={brief.lastResearchRun} />
            )}
          </div>

          {/* MIDDLE — Requirements */}
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Requirements</h2>
                <span className="text-xs text-gray-600">
                  {acceptedReqs.length} akzeptiert · {proposedReqs.length} offen
                </span>
              </div>

              {brief.requirements.length === 0 ? (
                <div className="text-center py-6 text-gray-600 text-sm">
                  <span className="block text-2xl mb-2">📋</span>
                  Noch keine Requirements.<br />
                  Klicke &ldquo;Requirements generieren&rdquo; um zu starten.
                </div>
              ) : (
                <div className="space-y-4">
                  {byPriority.map(group => (
                    <div key={group.priority}>
                      <p className="text-xs text-gray-600 uppercase tracking-wide mb-2">{PRIORITY_LABELS[group.priority]}</p>
                      <div className="space-y-2">
                        {group.items.map(req => (
                          <RequirementCard
                            key={req.id}
                            req={req}
                            onStatusChange={patchRequirement}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Use Cases + Risks */}
          <div className="space-y-4">
            {/* Use Cases */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Use Cases</h2>
              {brief.useCases.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-3">Keine Use Cases. Requirements generieren um erste Use Cases zu erhalten.</p>
              ) : (
                <div className="space-y-3">
                  {brief.useCases.map(uc => (
                    <UseCaseCard key={uc.id} uc={uc} />
                  ))}
                </div>
              )}
            </div>

            {/* Risks */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Risiken</h2>
              {brief.risks.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-3">Keine Risiken identifiziert.</p>
              ) : (
                <div className="space-y-3">
                  {brief.risks.map(risk => (
                    <RiskCard key={risk.id} risk={risk} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Approve Dialog */}
        {showApproveConfirm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold mb-2">Brief freigeben?</h3>
              <div className="text-sm text-gray-400 space-y-1 mb-4">
                <p>✓ {acceptedReqs.length} Requirements akzeptiert</p>
                <p>✓ {brief.useCases.filter(u => u.status === 'accepted').length} Use Cases akzeptiert</p>
                {brief.risks.some(r => r.isOpenAssumption) && (
                  <p className="text-yellow-500">⚠ {brief.risks.filter(r => r.isOpenAssumption).length} offene Annahmen</p>
                )}
                <p className="text-gray-500 mt-2 text-xs">Nach der Freigabe kannst du den Brief direkt als Delegation starten.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
                >
                  {approving ? 'Wird freigegeben…' : 'Jetzt freigeben'}
                </button>
                <button
                  onClick={() => setShowApproveConfirm(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Archive Dialog */}
        {showArchiveConfirm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold mb-2">Brief archivieren?</h3>
              <p className="text-sm text-gray-400 mb-4">Der Brief wird nicht gelöscht und kann jederzeit wiederhergestellt werden.</p>
              <div className="flex gap-2">
                <button onClick={handleArchive} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg">
                  Archivieren
                </button>
                <button onClick={() => setShowArchiveConfirm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────

const CONFIDENCE_COLORS: Record<FindingConfidence, string> = {
  high:      'bg-green-900/40 text-green-400',
  medium:    'bg-yellow-900/40 text-yellow-400',
  low:       'bg-red-900/40 text-red-400',
  uncertain: 'bg-gray-800 text-gray-500',
}

function FindingsPanel({ run }: { run: import('@/lib/models/project-brief').ResearchRun }) {
  const [expanded, setExpanded] = useState(false)
  const summaryOutput = run.outputs.find(o => o.type === 'findings_summary')

  return (
    <div className="bg-gray-900 border border-indigo-900/40 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Research Findings</h2>
        <div className="flex items-center gap-2">
          {run.confidenceScore !== undefined && (
            <span className="text-xs text-gray-500">
              Konfidenz: <span className="text-white">{run.confidenceScore}%</span>
            </span>
          )}
          {run.actualCostUsd !== undefined && run.actualCostUsd > 0 && (
            <span className="text-xs text-gray-600">${run.actualCostUsd.toFixed(4)}</span>
          )}
        </div>
      </div>

      {/* Summary */}
      {summaryOutput && (
        <p className="text-xs text-gray-400 mb-3 line-clamp-3">{summaryOutput.content}</p>
      )}

      {/* Findings list */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors mb-2 flex items-center gap-1"
      >
        {expanded ? '▲' : '▼'} {run.findings.length} Findings
      </button>

      {expanded && (
        <div className="space-y-2">
          {run.findings.map(f => (
            <FindingCard key={f.id} finding={f} />
          ))}
        </div>
      )}

      {/* Open uncertainties */}
      {run.openUncertainties.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <p className="text-xs text-yellow-500 mb-1.5">⚠ Offene Annahmen ({run.openUncertainties.length})</p>
          <ul className="space-y-1">
            {run.openUncertainties.map((u, i) => (
              <li key={i} className="text-xs text-gray-500 line-clamp-2">· {u}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-2.5">
      <div className="flex items-start gap-2">
        <span className={`shrink-0 px-1.5 py-0.5 text-xs rounded font-medium ${CONFIDENCE_COLORS[finding.confidence]}`}>
          {finding.confidence}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-white leading-snug">{finding.claim}</p>
          {finding.summary && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{finding.summary}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-1">
            {finding.isOpenAssumption && (
              <span className="px-1 py-0.5 text-xs bg-yellow-950/40 text-yellow-600 rounded">Annahme</span>
            )}
            {finding.tags.slice(0, 2).map(tag => (
              <span key={tag} className="px-1 py-0.5 text-xs bg-gray-900 text-gray-600 rounded">{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function RequirementCard({
  req,
  onStatusChange,
}: {
  req: Requirement
  onStatusChange: (id: string, status: Requirement['status']) => void
}) {
  const isAccepted = req.status === 'accepted'
  const isRejected = req.status === 'rejected'

  return (
    <div className={`rounded-lg border p-3 transition-opacity ${
      isRejected ? 'opacity-40 border-gray-800' : isAccepted ? 'border-green-800/50 bg-green-950/20' : 'border-gray-700 bg-gray-800/40'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${PRIORITY_COLORS[req.priority]}`}>
              {PRIORITY_LABELS[req.priority]}
            </span>
            {req.source === 'ai_proposed' && !isAccepted && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-blue-950/50 text-blue-400">KI</span>
            )}
            {req.source === 'research' && !isAccepted && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-indigo-950/50 text-indigo-400">🔍 Research</span>
            )}
            {isAccepted && <span className="text-xs text-green-400">✓</span>}
          </div>
          <p className="text-sm font-medium text-white truncate">{req.title}</p>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{req.description}</p>
        </div>
      </div>

      {!isAccepted && !isRejected && (
        <div className="flex gap-1.5 mt-2">
          <button
            onClick={() => onStatusChange(req.id, 'accepted')}
            className="px-2 py-0.5 text-xs bg-green-900/50 hover:bg-green-900 text-green-400 rounded transition-colors"
          >
            ✓ Annehmen
          </button>
          <button
            onClick={() => onStatusChange(req.id, 'rejected')}
            className="px-2 py-0.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-500 rounded transition-colors"
          >
            ✕ Ablehnen
          </button>
        </div>
      )}
      {isAccepted && (
        <button
          onClick={() => onStatusChange(req.id, 'proposed')}
          className="mt-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Rückgängig
        </button>
      )}
    </div>
  )
}

function UseCaseCard({ uc }: { uc: UseCase }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border border-gray-700 rounded-lg p-3">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-white">{uc.title}</p>
          <span className="text-gray-600 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">Akteur: {uc.actor}</p>
      </button>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-gray-800">
          <p className="text-xs text-gray-500 mb-1">Auslöser: {uc.trigger}</p>
          <ol className="text-xs text-gray-300 space-y-0.5 list-decimal list-inside">
            {uc.mainFlow.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        </div>
      )}
    </div>
  )
}

function RiskCard({ risk }: { risk: Risk }) {
  const impactColor = risk.impact === 'high' ? 'text-red-400' : risk.impact === 'medium' ? 'text-yellow-400' : 'text-gray-400'
  return (
    <div className="border border-gray-700 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-white">{risk.title}</p>
        <span className={`text-xs shrink-0 ${impactColor}`}>
          {risk.impact === 'high' ? '🔴' : risk.impact === 'medium' ? '🟡' : '🟢'} {risk.impact}
        </span>
      </div>
      <p className="text-xs text-gray-400">{risk.description}</p>
      {risk.mitigationIdea && (
        <p className="text-xs text-gray-500 mt-1">💡 {risk.mitigationIdea}</p>
      )}
      {risk.isOpenAssumption && (
        <span className="mt-1.5 inline-block px-1.5 py-0.5 text-xs bg-yellow-950/40 text-yellow-500 rounded">Offene Annahme</span>
      )}
    </div>
  )
}
