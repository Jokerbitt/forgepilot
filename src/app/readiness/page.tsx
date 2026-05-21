import { runSaaSAudit } from '@/lib/readiness/saas-audit'
import type { ReadinessGap, GapSeverity, GapStatus } from '@/lib/readiness/saas-audit'
import Link from 'next/link'

const SEVERITY_ORDER: GapSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

const SEVERITY_BADGE: Record<GapSeverity, string> = {
  CRITICAL: 'bg-red-500/15 text-red-400 border border-red-500/30',
  HIGH:     'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  MEDIUM:   'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  LOW:      'bg-slate-500/15 text-slate-400 border border-slate-500/30',
}

const STATUS_BADGE: Record<GapStatus, string> = {
  done:    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  partial: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  missing: 'bg-red-500/15 text-red-400 border border-red-500/30',
}

const STATUS_LABEL: Record<GapStatus, string> = {
  done:    'Done',
  partial: 'Partial',
  missing: 'Missing',
}

function ScoreBadge({ score }: { score: number }) {
  const colorClass =
    score >= 85
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : score >= 60
      ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
      : 'bg-red-500/15 text-red-300 border-red-500/30'

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border px-6 py-3 text-4xl font-bold tabular-nums ${colorClass}`}
    >
      {score}
      <span className="text-xl font-normal opacity-60">/ 100</span>
    </div>
  )
}

function ReadyIndicator({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3">
      <span className="text-lg">{ready ? '✅' : '❌'}</span>
      <span className="text-sm font-medium text-slate-300">{label}</span>
    </div>
  )
}

function GapRow({ gap }: { gap: ReadinessGap }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-white">{gap.title}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${SEVERITY_BADGE[gap.severity]}`}>
            {gap.severity}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE[gap.status]}`}>
            {STATUS_LABEL[gap.status]}
          </span>
        </div>
        <p className="text-xs text-slate-500">{gap.description}</p>
      </div>
      <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end">
        <span className="whitespace-nowrap text-xs text-slate-500">
          {gap.effortDays > 0 ? `~${gap.effortDays}d effort` : 'No effort'}
        </span>
        {gap.docsLink && (
          <Link
            href={gap.docsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-violet-400 hover:text-violet-300 hover:underline"
          >
            Docs →
          </Link>
        )}
      </div>
    </div>
  )
}

export default function ReadinessPage() {
  const report = runSaaSAudit(process.env)

  const sortedGaps = [...report.gaps].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  )

  const nextSteps = sortedGaps
    .filter(g => g.status !== 'done')
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-[#07070c] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">SaaS-Readiness Report</h1>
          <p className="mt-1 text-sm text-slate-500">
            Generated at {new Date(report.generatedAt).toLocaleString('de-DE')}
          </p>
        </div>

        {/* Score + indicators */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Overall Score</span>
              <ScoreBadge score={report.score} />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <ReadyIndicator label="Solo-Use Ready" ready={report.readyForSolo} />
              <ReadyIndicator label="SaaS-Ready" ready={report.readyForSaaS} />
            </div>
          </div>
        </div>

        {/* Gap list */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
            All Gaps ({sortedGaps.length})
          </h2>
          {sortedGaps.map(gap => (
            <GapRow key={gap.id} gap={gap} />
          ))}
        </div>

        {/* Nächste Schritte */}
        {nextSteps.length > 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-violet-400">
              Nächste Schritte
            </h2>
            <ol className="space-y-3">
              {nextSteps.map((gap, i) => (
                <li key={gap.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{gap.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${SEVERITY_BADGE[gap.severity]}`}>
                        {gap.severity}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{gap.description}</p>
                    {gap.docsLink && (
                      <Link
                        href={gap.docsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-violet-400 hover:text-violet-300 hover:underline"
                      >
                        Docs →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

      </div>
    </div>
  )
}
