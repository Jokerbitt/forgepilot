'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ProjectBrief, Requirement, UseCase, Risk, Finding, FindingConfidence, ResearchRun } from '@/lib/models/project-brief'

interface Props {
  initialBrief: ProjectBrief
}

type ReadinessTone = 'good' | 'warning' | 'blocked'

interface BlueprintViewModel {
  acceptedReqs: Requirement[]
  proposedReqs: Requirement[]
  openRisks: Risk[]
  openAssumptions: Risk[]
  acceptedUseCases: UseCase[]
  readinessScore: number
  readinessTone: ReadinessTone
  nextAction: string
  nextActionDetail: string
  deliveryStage: string
  contextMode: string
}

const STATUS_LABELS: Record<ProjectBrief['status'], string> = {
  draft: 'Entwurf',
  in_review: 'In Review',
  accepted: 'Freigegeben',
  archived: 'Archiviert',
}

const STATUS_STYLES: Record<ProjectBrief['status'], string> = {
  draft: 'border-slate-700 bg-slate-900 text-slate-300',
  in_review: 'border-amber-700/60 bg-amber-950/40 text-amber-200',
  accepted: 'border-emerald-700/60 bg-emerald-950/40 text-emerald-200',
  archived: 'border-slate-800 bg-slate-950 text-slate-500',
}

const PRIORITY_STYLES: Record<Requirement['priority'], string> = {
  must: 'border-red-700/50 bg-red-950/30 text-red-200',
  should: 'border-amber-700/50 bg-amber-950/30 text-amber-200',
  could: 'border-sky-700/50 bg-sky-950/30 text-sky-200',
  wont: 'border-slate-700 bg-slate-900 text-slate-500',
}

const PRIORITY_LABELS: Record<Requirement['priority'], string> = {
  must: 'Must',
  should: 'Should',
  could: 'Could',
  wont: 'Wont',
}

const WORKFLOW_STEPS = [
  'Brief',
  'Requirements',
  'Risiken',
  'Context',
  'Approval',
  'Delegation',
]

export function BlueprintScreen({ initialBrief }: Props) {
  const router = useRouter()
  const [brief, setBrief] = useState<ProjectBrief>(initialBrief)
  const [generating, startGenerate] = useTransition()
  const [approving, startApprove] = useTransition()
  const [delegating, startDelegate] = useTransition()
  const [researching, startResearch] = useTransition()
  const [ticketing, startTicket] = useTransition()
  const [generationNotes, setGenerationNotes] = useState('')
  const [researchNotes, setResearchNotes] = useState('')
  const [researchError, setResearchError] = useState('')
  const [linearTicketUrl, setLinearTicketUrl] = useState('')
  const [linearTicketError, setLinearTicketError] = useState('')
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [delegationError, setDelegationError] = useState('')

  const vm = useMemo(() => buildBlueprintViewModel(brief), [brief])
  const canApprove = vm.acceptedReqs.length > 0 && brief.status !== 'accepted' && brief.status !== 'archived'

  const byPriority = (['must', 'should', 'could', 'wont'] as const)
    .map(priority => ({
      priority,
      items: brief.requirements.filter(req => req.priority === priority && req.status !== 'rejected'),
    }))
    .filter(group => group.items.length > 0)

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
      const res = await fetch(`/api/project-briefs/${brief.id}/generate-requirements`, { method: 'POST' })
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
      const res = await fetch(`/api/project-briefs/${brief.id}/research-run`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as {
          generationNotes: string
          newRequirementsCount: number
          newRisksCount: number
        }
        setResearchNotes(`Research abgeschlossen: +${data.newRequirementsCount} Requirements, +${data.newRisksCount} Risiken. ${data.generationNotes}`)
        const briefRes = await fetch(`/api/project-briefs/${brief.id}`)
        if (briefRes.ok) setBrief(await briefRes.json() as ProjectBrief)
      } else {
        const err = await res.json() as { error?: string }
        setResearchError(err.error ?? 'Research fehlgeschlagen')
      }
    })
  }

  function handleCreateLinearTicket() {
    setLinearTicketError('')
    setLinearTicketUrl('')
    startTicket(async () => {
      const res = await fetch(`/api/project-briefs/${brief.id}/create-linear-ticket`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as { url: string; identifier: string }
        setLinearTicketUrl(data.url)
      } else {
        const err = await res.json() as { error?: string }
        setLinearTicketError(err.error ?? 'Linear-Ticket konnte nicht erstellt werden')
      }
    })
  }

  function handleDelegate() {
    setDelegationError('')
    startDelegate(async () => {
      const res = await fetch(`/api/project-briefs/${brief.id}/create-delegation`, { method: 'POST' })
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/project-briefs" className="hover:text-slate-300">Projekte</Link>
          <span>/</span>
          <span className="max-w-xs truncate text-slate-300">{brief.title}</span>
        </div>

        <section className="mb-5 border-b border-slate-800 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-md border px-2 py-1 text-xs font-medium ${STATUS_STYLES[brief.status]}`}>
                  {STATUS_LABELS[brief.status]}
                </span>
                <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-400">
                  Scope {brief.scope}
                </span>
                <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-400">
                  {vm.contextMode}
                </span>
              </div>
              <h1 className="max-w-4xl text-2xl font-semibold tracking-normal text-white sm:text-3xl">
                {brief.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                {brief.problemStatement}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              {brief.status !== 'accepted' && brief.status !== 'archived' && (
                <>
                  <ActionButton onClick={handleResearch} disabled={researching || generating} tone="secondary">
                    {researching ? 'Research laeuft' : 'Research starten'}
                  </ActionButton>
                  <ActionButton onClick={handleGenerate} disabled={generating || researching} tone="secondary">
                    {generating ? 'Generiere' : 'Requirements generieren'}
                  </ActionButton>
                </>
              )}
              {canApprove && (
                <ActionButton onClick={() => setShowApproveConfirm(true)} tone="success">
                  Brief freigeben
                </ActionButton>
              )}
              {brief.status === 'accepted' && (
                <ActionButton onClick={handleDelegate} disabled={delegating} tone="primary">
                  {delegating ? 'Erstelle Delegation' : 'Delegation starten'}
                </ActionButton>
              )}
              <ActionButton onClick={handleCreateLinearTicket} disabled={ticketing} tone="secondary">
                {ticketing ? 'Erstelle Ticket' : 'Linear Ticket'}
              </ActionButton>
              {brief.status !== 'archived' && (
                <ActionButton onClick={() => setShowArchiveConfirm(true)} tone="ghost">
                  Archivieren
                </ActionButton>
              )}
            </div>
          </div>
        </section>

        <StatusMessages
          generationNotes={generationNotes}
          researchNotes={researchNotes}
          researchError={researchError}
          linearTicketUrl={linearTicketUrl}
          linearTicketError={linearTicketError}
          delegationError={delegationError}
          onDismissResearch={() => setResearchNotes('')}
          onDismissResearchError={() => setResearchError('')}
          onDismissLinearTicket={() => setLinearTicketUrl('')}
          onDismissLinearError={() => setLinearTicketError('')}
          onDismissDelegationError={() => setDelegationError('')}
        />

        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricPanel label="Readiness" value={`${vm.readinessScore}%`} detail={vm.deliveryStage} tone={vm.readinessTone} progress={vm.readinessScore} />
          <MetricPanel label="Requirements" value={`${vm.acceptedReqs.length}/${brief.requirements.length}`} detail={`${vm.proposedReqs.length} offen`} tone={vm.acceptedReqs.length > 0 ? 'good' : 'warning'} />
          <MetricPanel label="Risiken" value={`${vm.openRisks.length}`} detail={`${vm.openAssumptions.length} offene Annahmen`} tone={vm.openRisks.length > 2 ? 'blocked' : vm.openRisks.length > 0 ? 'warning' : 'good'} />
          <MetricPanel label="Research" value={brief.lastResearchRun ? `${brief.lastResearchRun.confidenceScore ?? 0}%` : 'offen'} detail={brief.researchMode} tone={brief.lastResearchRun ? 'good' : 'warning'} />
        </section>

        <section className={`mb-5 border bg-slate-900/70 ${vm.readinessTone === 'good' ? 'border-l-4 border-emerald-700/60 border-l-emerald-500' : vm.readinessTone === 'warning' ? 'border-l-4 border-amber-700/60 border-l-amber-500' : 'border-l-4 border-red-700/60 border-l-red-500'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
            <div className="border-b border-slate-800 p-4 lg:border-b-0 lg:border-r">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Naechste beste Aktion</p>
              <h2 className="mt-2 text-lg font-semibold text-white">{vm.nextAction}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{vm.nextActionDetail}</p>
            </div>
            <div className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Projektziel</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{brief.desiredOutcome}</p>
              <p className="mt-3 text-xs text-slate-500">Zielgruppe</p>
              <p className="mt-1 text-sm text-slate-300">{brief.targetAudience}</p>
            </div>
          </div>
        </section>

        <section className="mb-5 border border-slate-800 bg-slate-900/50 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Delivery Pipeline</p>
              <p className="mt-1 text-sm text-slate-400">Vom Brief zur kontrollierten Agentenarbeit</p>
            </div>
            <Link href={`/api/project-briefs/${brief.id}/research-brief`} target="_blank" className="text-sm text-sky-300 hover:text-sky-200">
              Research Brief
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            {WORKFLOW_STEPS.map((step, index) => (
              <PipelineStep key={step} label={step} state={pipelineStepState(index, activePipelineIndex(brief, vm))} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.08fr_1.6fr_1.08fr]">
          <aside className="space-y-5">
            <Section title="Projektsteckbrief" eyebrow="Ausgangslage">
              <DefinitionList
                items={[
                  ['Idee', brief.rawIdea],
                  ['Problem', brief.problemStatement],
                  ['Zielgruppe', brief.targetAudience],
                  ['Zielzustand', brief.desiredOutcome],
                ]}
              />
              {brief.constraints.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Constraints</p>
                  <div className="flex flex-wrap gap-1.5">
                    {brief.constraints.map((constraint, index) => (
                      <span key={`${constraint}-${index}`} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300">
                        {constraint}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            <Section title="Knowledge & Context" eyebrow="Local-first">
              <div className="space-y-3 text-sm">
                <SignalRow label="Privacy Mode" value={brief.privacyMode} />
                <SignalRow label="Research Mode" value={brief.researchMode} />
                <SignalRow label="Executor" value={brief.researchBriefDraft.preferredExecutor} />
                <SignalRow label="Writeback" value={brief.status === 'accepted' ? 'bereit' : 'nach Freigabe'} />
              </div>
            </Section>

            {brief.lastResearchRun && <FindingsPanel run={brief.lastResearchRun} />}
          </aside>

          <section className="space-y-5">
            <Section
              title="Requirements"
              eyebrow={`${vm.acceptedReqs.length} akzeptiert, ${vm.proposedReqs.length} offen`}
            >
              {brief.requirements.length === 0 ? (
                <EmptyState title="Noch keine Requirements" detail="Starte Research oder generiere Requirements, damit aus der Idee ein belastbarer Umsetzungsplan wird." />
              ) : (
                <div className="space-y-5">
                  {byPriority.map(group => (
                    <div key={group.priority}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{PRIORITY_LABELS[group.priority]}</p>
                        <span className="text-xs text-slate-600">{group.items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {group.items.map(req => (
                          <RequirementCard
                            key={req.id}
                            req={req}
                            allFindings={brief.lastResearchRun?.findings ?? []}
                            onStatusChange={patchRequirement}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </section>

          <aside className="space-y-5">
            <Section title="Use Cases" eyebrow={`${brief.useCases.length} Szenarien`}>
              {brief.useCases.length === 0 ? (
                <EmptyState title="Noch keine Use Cases" detail="Use Cases entstehen aus Research und akzeptierten Requirements." />
              ) : (
                <div className="space-y-3">
                  {brief.useCases.map(useCase => <UseCaseCard key={useCase.id} uc={useCase} />)}
                </div>
              )}
            </Section>

            <Section title="Risiken" eyebrow={`${brief.risks.length} Eintraege`}>
              {brief.risks.length === 0 ? (
                <EmptyState title="Keine Risiken" detail="Aktuell sind keine Risiken erfasst." />
              ) : (
                <div className="space-y-3">
                  {brief.risks.map(risk => <RiskCard key={risk.id} risk={risk} />)}
                </div>
              )}
            </Section>

            {brief.delegationIds && brief.delegationIds.length > 0 && (
              <Section title="Delegationen" eyebrow={`${brief.delegationIds.length} Runs`}>
                <div className="space-y-2">
                  {brief.delegationIds.map((delegationId, index) => (
                    <Link
                      key={delegationId}
                      href={`/delegations/${delegationId}`}
                      className="flex items-center justify-between border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300 hover:border-slate-600"
                    >
                      <span>Delegation {index + 1}</span>
                      <span className="text-slate-500">oeffnen</span>
                    </Link>
                  ))}
                </div>
              </Section>
            )}
          </aside>
        </div>

        {showApproveConfirm && (
          <ConfirmDialog
            title="Brief freigeben?"
            detail={`${vm.acceptedReqs.length} Requirements sind akzeptiert. Nach der Freigabe kann daraus eine kontrollierte Delegation entstehen.`}
            primaryLabel={approving ? 'Wird freigegeben' : 'Jetzt freigeben'}
            onPrimary={handleApprove}
            onCancel={() => setShowApproveConfirm(false)}
            disabled={approving}
          />
        )}

        {showArchiveConfirm && (
          <ConfirmDialog
            title="Brief archivieren?"
            detail="Der Brief wird nicht geloescht und kann spaeter wiederhergestellt werden."
            primaryLabel="Archivieren"
            onPrimary={handleArchive}
            onCancel={() => setShowArchiveConfirm(false)}
          />
        )}
      </main>
    </div>
  )
}

export function buildBlueprintViewModel(brief: ProjectBrief): BlueprintViewModel {
  const acceptedReqs = brief.requirements.filter(req => req.status === 'accepted')
  const proposedReqs = brief.requirements.filter(req => req.status === 'proposed')
  const openRisks = brief.risks.filter(risk => risk.impact === 'high' || risk.isOpenAssumption)
  const openAssumptions = brief.risks.filter(risk => risk.isOpenAssumption)
  const acceptedUseCases = brief.useCases.filter(useCase => useCase.status === 'accepted')
  const hasResearch = Boolean(brief.lastResearchRun)
  const statusScore = brief.status === 'accepted' ? 25 : brief.status === 'in_review' ? 15 : 5
  const requirementScore = brief.requirements.length === 0 ? 0 : Math.round((acceptedReqs.length / brief.requirements.length) * 35)
  const useCaseScore = acceptedUseCases.length > 0 ? 15 : brief.useCases.length > 0 ? 8 : 0
  const researchScore = hasResearch ? 15 : 0
  const riskPenalty = Math.min(20, openRisks.length * 5)
  const readinessScore = Math.max(0, Math.min(100, statusScore + requirementScore + useCaseScore + researchScore + 10 - riskPenalty))
  const readinessTone: ReadinessTone = readinessScore >= 70 ? 'good' : readinessScore >= 40 ? 'warning' : 'blocked'

  if (brief.status === 'accepted') {
    return {
      acceptedReqs,
      proposedReqs,
      openRisks,
      openAssumptions,
      acceptedUseCases,
      readinessScore,
      readinessTone,
      nextAction: 'Delegation vorbereiten',
      nextActionDetail: 'Der Brief ist freigegeben. Erzeuge als naechstes einen Task Contract und pruefe Context Package, Risiko, Datenschutz und Kosten.',
      deliveryStage: 'bereit fuer Delegation',
      contextMode: contextModeLabel(brief.privacyMode),
    }
  }

  if (acceptedReqs.length === 0) {
    return {
      acceptedReqs,
      proposedReqs,
      openRisks,
      openAssumptions,
      acceptedUseCases,
      readinessScore,
      readinessTone,
      nextAction: 'Requirements pruefen und akzeptieren',
      nextActionDetail: 'Mindestens ein Must-have Requirement muss akzeptiert sein, bevor ForgePilot kontrolliert delegieren kann.',
      deliveryStage: 'Anforderungen offen',
      contextMode: contextModeLabel(brief.privacyMode),
    }
  }

  if (!hasResearch && brief.researchMode !== 'quick') {
    return {
      acceptedReqs,
      proposedReqs,
      openRisks,
      openAssumptions,
      acceptedUseCases,
      readinessScore,
      readinessTone,
      nextAction: 'Research starten',
      nextActionDetail: 'Der Brief hat akzeptierte Requirements, aber noch keinen Research Run. Fuehre Research aus, um Annahmen und Risiken zu belegen.',
      deliveryStage: 'Validierung offen',
      contextMode: contextModeLabel(brief.privacyMode),
    }
  }

  return {
    acceptedReqs,
    proposedReqs,
    openRisks,
    openAssumptions,
    acceptedUseCases,
    readinessScore,
    readinessTone,
    nextAction: 'Brief freigeben',
    nextActionDetail: 'Die wichtigsten Grundlagen sind vorhanden. Pruefe offene Risiken und gib den Brief frei, wenn Ziel, Scope und Anforderungen stimmen.',
    deliveryStage: 'Review bereit',
    contextMode: contextModeLabel(brief.privacyMode),
  }
}

function activePipelineIndex(brief: ProjectBrief, vm: BlueprintViewModel): number {
  if (brief.status === 'accepted' && brief.delegationIds && brief.delegationIds.length > 0) return 5
  if (brief.status === 'accepted') return 4
  if (vm.acceptedReqs.length > 0 && vm.openRisks.length === 0) return 3
  if (vm.acceptedReqs.length > 0) return 2
  if (brief.requirements.length > 0) return 1
  return 0
}

function pipelineStepState(index: number, activeIndex: number): 'done' | 'active' | 'pending' {
  if (index < activeIndex) return 'done'
  if (index === activeIndex) return 'active'
  return 'pending'
}

function contextModeLabel(mode: ProjectBrief['privacyMode']): string {
  if (mode === 'local') return 'local-only'
  if (mode === 'hybrid') return 'hybrid'
  return 'cloud-approved'
}

function ActionButton({
  children,
  disabled,
  onClick,
  tone,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
  tone: 'primary' | 'secondary' | 'success' | 'ghost'
}) {
  const styles = {
    primary: 'border-sky-500 bg-sky-500 text-slate-950 hover:bg-sky-400',
    secondary: 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800',
    success: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500',
    ghost: 'border-transparent bg-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[36px] rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[tone]}`}
    >
      {children}
    </button>
  )
}

function StatusMessages({
  generationNotes,
  researchNotes,
  researchError,
  linearTicketUrl,
  linearTicketError,
  delegationError,
  onDismissResearch,
  onDismissResearchError,
  onDismissLinearTicket,
  onDismissLinearError,
  onDismissDelegationError,
}: {
  generationNotes: string
  researchNotes: string
  researchError: string
  linearTicketUrl: string
  linearTicketError: string
  delegationError: string
  onDismissResearch: () => void
  onDismissResearchError: () => void
  onDismissLinearTicket: () => void
  onDismissLinearError: () => void
  onDismissDelegationError: () => void
}) {
  return (
    <div className="mb-5 space-y-2">
      {generationNotes && <Notice tone="info" text={`KI-Annahmen: ${generationNotes}`} />}
      {researchNotes && <Notice tone="info" text={researchNotes} onDismiss={onDismissResearch} />}
      {researchError && <Notice tone="error" text={researchError} onDismiss={onDismissResearchError} />}
      {linearTicketUrl && (
        <Notice tone="info" text="Linear Ticket erstellt." onDismiss={onDismissLinearTicket}>
          <a href={linearTicketUrl} target="_blank" rel="noopener noreferrer" className="ml-2 underline hover:text-sky-100">
            Ticket ansehen
          </a>
        </Notice>
      )}
      {linearTicketError && <Notice tone="error" text={linearTicketError} onDismiss={onDismissLinearError} />}
      {delegationError && <Notice tone="error" text={delegationError} onDismiss={onDismissDelegationError} />}
    </div>
  )
}

function Notice({ tone, text, children, onDismiss }: { tone: 'info' | 'error'; text: string; children?: React.ReactNode; onDismiss?: () => void }) {
  const style = tone === 'error'
    ? 'border-red-800 bg-red-950/40 text-red-200'
    : 'border-sky-800 bg-sky-950/30 text-sky-200'
  return (
    <div className={`flex items-center gap-2 border px-3 py-2 text-sm ${style}`}>
      <span>{text}</span>
      {children}
      {onDismiss && (
        <button onClick={onDismiss} className="ml-auto text-slate-400 hover:text-white" aria-label="Hinweis schliessen">
          x
        </button>
      )}
    </div>
  )
}

function MetricPanel({ label, value, detail, tone, progress }: { label: string; value: string; detail: string; tone: ReadinessTone; progress?: number }) {
  const dot = tone === 'good' ? 'bg-emerald-400' : tone === 'warning' ? 'bg-amber-400' : 'bg-red-400'
  const bar = tone === 'good' ? 'bg-emerald-500' : tone === 'warning' ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`h-2 w-2 rounded-full ${dot}`} />
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1 w-full rounded-full bg-slate-800">
          <div className={`h-1 rounded-full transition-all ${bar}`} style={{ width: `${Math.max(4, progress)}%` }} />
        </div>
      )}
    </div>
  )
}

function PipelineStep({ label, state }: { label: string; state: 'done' | 'active' | 'pending' }) {
  const styles = {
    done: 'border-emerald-800/50 bg-emerald-950/20 text-emerald-100',
    active: 'border-sky-700/60 bg-sky-950/20 text-sky-100',
    pending: 'border-slate-800 bg-slate-950 text-slate-500',
  }
  const indicators = {
    done: <span className="mt-1 block text-[11px] text-emerald-400">&#x2713; erledigt</span>,
    active: <span className="mt-1 block text-[11px] text-sky-300">&#x25CF; aktiv</span>,
    pending: <span className="mt-1 block text-[11px]">offen</span>,
  }
  return (
    <div className={`min-h-[54px] border px-3 py-2 ${styles[state]}`}>
      <p className="text-xs font-medium">{label}</p>
      {indicators[state]}
    </div>
  )
}

function Section({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section className="border border-slate-800 bg-slate-900/70">
      <div className="border-b border-slate-800 px-4 py-3">
        {eyebrow && <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{eyebrow}</p>}
        <h2 className="mt-1 text-base font-semibold text-white">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function DefinitionList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="space-y-4">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="mt-1 text-sm leading-6 text-slate-200">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function SignalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-200">{value}</span>
    </div>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="border border-dashed border-slate-800 bg-slate-950/50 p-4 text-sm">
      <p className="font-medium text-slate-300">{title}</p>
      <p className="mt-1 leading-6 text-slate-500">{detail}</p>
    </div>
  )
}

const CONFIDENCE_STYLES: Record<FindingConfidence, string> = {
  high: 'border-emerald-700/50 bg-emerald-950/30 text-emerald-200',
  medium: 'border-amber-700/50 bg-amber-950/30 text-amber-200',
  low: 'border-red-700/50 bg-red-950/30 text-red-200',
  uncertain: 'border-slate-700 bg-slate-900 text-slate-400',
}

function FindingsPanel({ run }: { run: ResearchRun }) {
  const [expanded, setExpanded] = useState(false)
  const summaryOutput = run.outputs.find(output => output.type === 'findings_summary')

  return (
    <Section title="Research Findings" eyebrow={`Konfidenz ${run.confidenceScore ?? 0}%`}>
      {summaryOutput && <p className="mb-3 line-clamp-4 text-sm leading-6 text-slate-400">{summaryOutput.content}</p>}
      <button onClick={() => setExpanded(value => !value)} className="text-sm text-sky-300 hover:text-sky-200">
        {expanded ? 'Findings ausblenden' : `${run.findings.length} Findings anzeigen`}
      </button>
      {expanded && (
        <div className="mt-3 space-y-2">
          {run.findings.map(finding => <FindingCard key={finding.id} finding={finding} />)}
        </div>
      )}
      {run.openUncertainties.length > 0 && (
        <div className="mt-4 border-t border-slate-800 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-300">Offene Annahmen</p>
          <ul className="mt-2 space-y-1">
            {run.openUncertainties.map((uncertainty, index) => (
              <li key={`${uncertainty}-${index}`} className="text-sm leading-6 text-slate-500">{uncertainty}</li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <div className="border border-slate-800 bg-slate-950 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`rounded border px-2 py-0.5 text-xs font-medium ${CONFIDENCE_STYLES[finding.confidence]}`}>
          {finding.confidence}
        </span>
        {finding.isOpenAssumption && <span className="rounded border border-amber-800 bg-amber-950/30 px-2 py-0.5 text-xs text-amber-200">Annahme</span>}
      </div>
      <p className="text-sm font-medium leading-5 text-white">{finding.claim}</p>
      {finding.summary && <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-500">{finding.summary}</p>}
    </div>
  )
}

function RequirementCard({
  req,
  allFindings,
  onStatusChange,
}: {
  req: Requirement
  allFindings: Finding[]
  onStatusChange: (id: string, status: Requirement['status']) => void
}) {
  const [evidenceExpanded, setEvidenceExpanded] = useState(false)
  const isAccepted = req.status === 'accepted'
  const isRejected = req.status === 'rejected'
  const linkedFindings = allFindings.filter(finding => req.findingIds?.includes(finding.id))

  return (
    <article className={`border p-3 ${isRejected ? 'border-slate-800 opacity-50' : isAccepted ? 'border-emerald-800/60 bg-emerald-950/10' : 'border-slate-800 bg-slate-950'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className={`rounded border px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[req.priority]}`}>
              {PRIORITY_LABELS[req.priority]}
            </span>
            <span className="rounded border border-slate-800 px-2 py-0.5 text-xs text-slate-500">{req.type}</span>
            <span className="rounded border border-slate-800 px-2 py-0.5 text-xs text-slate-500">{req.source}</span>
            {isAccepted && <span className="rounded border border-emerald-800 bg-emerald-950/20 px-2 py-0.5 text-xs text-emerald-200">akzeptiert</span>}
          </div>
          <h3 className="text-sm font-semibold leading-5 text-white">{req.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">{req.description}</p>
        </div>
      </div>

      {!isAccepted && !isRejected && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => onStatusChange(req.id, 'accepted')} className="rounded border border-emerald-800 bg-emerald-950/20 px-2 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-900/30">
            Annehmen
          </button>
          <button onClick={() => onStatusChange(req.id, 'rejected')} className="rounded border border-slate-800 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-900 hover:text-slate-300">
            Ablehnen
          </button>
        </div>
      )}
      {isAccepted && (
        <button onClick={() => onStatusChange(req.id, 'proposed')} className="mt-3 text-xs text-slate-500 hover:text-slate-300">
          Zurueck auf offen
        </button>
      )}

      {linkedFindings.length > 0 && (
        <div className="mt-3 border-t border-slate-800 pt-3">
          <button onClick={() => setEvidenceExpanded(value => !value)} className="text-xs text-sky-300 hover:text-sky-200">
            {evidenceExpanded ? 'Belege ausblenden' : `${linkedFindings.length} Belege anzeigen`}
          </button>
          {evidenceExpanded && (
            <div className="mt-2 space-y-2">
              {linkedFindings.map(finding => (
                <div key={finding.id} className="border border-slate-800 bg-slate-900 p-2 text-xs leading-5 text-slate-300">
                  {finding.claim}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function UseCaseCard({ uc }: { uc: UseCase }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <article className="border border-slate-800 bg-slate-950 p-3">
      <button onClick={() => setExpanded(value => !value)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">{uc.title}</h3>
            <p className="mt-1 text-xs text-slate-500">Akteur: {uc.actor}</p>
          </div>
          <span className="text-xs text-slate-500">{expanded ? 'weniger' : 'mehr'}</span>
        </div>
      </button>
      {expanded && (
        <div className="mt-3 border-t border-slate-800 pt-3">
          <p className="mb-2 text-xs text-slate-500">Trigger: {uc.trigger}</p>
          <ol className="space-y-1 text-sm leading-6 text-slate-300">
            {uc.mainFlow.map((step, index) => <li key={`${step}-${index}`}>{index + 1}. {step}</li>)}
          </ol>
        </div>
      )}
    </article>
  )
}

function RiskCard({ risk }: { risk: Risk }) {
  const tone = risk.impact === 'high' ? 'border-red-800/70 text-red-200' : risk.impact === 'medium' ? 'border-amber-800/70 text-amber-200' : 'border-slate-800 text-slate-300'
  return (
    <article className={`border bg-slate-950 p-3 ${tone}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{risk.title}</h3>
        <span className="shrink-0 text-xs">{risk.impact}</span>
      </div>
      <p className="text-sm leading-6 text-slate-400">{risk.description}</p>
      {risk.mitigationIdea && <p className="mt-2 text-xs leading-5 text-slate-500">Massnahme: {risk.mitigationIdea}</p>}
      {risk.isOpenAssumption && <span className="mt-2 inline-block rounded border border-amber-800 bg-amber-950/20 px-2 py-0.5 text-xs text-amber-200">offene Annahme</span>}
    </article>
  )
}

function ConfirmDialog({
  title,
  detail,
  primaryLabel,
  onPrimary,
  onCancel,
  disabled,
}: {
  title: string
  detail: string
  primaryLabel: string
  onPrimary: () => void
  onCancel: () => void
  disabled?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md border border-slate-700 bg-slate-950 p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={onPrimary} disabled={disabled} className="min-h-[38px] flex-1 rounded-md border border-sky-500 bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50">
            {primaryLabel}
          </button>
          <button onClick={onCancel} className="min-h-[38px] rounded-md border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
