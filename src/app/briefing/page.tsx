import Link from 'next/link'
import type { BriefingData, LinearIssue, GitHubPR } from '@/app/api/briefing/route'
import { RefreshButton } from '@/components/briefing/RefreshButton'

async function getBriefingData(): Promise<BriefingData> {
  const empty: BriefingData = {
    generatedAt: new Date().toISOString(),
    linear: { inProgress: [], dueToday: [], blocked: [] },
    github: { openPRs: [], myPRs: [] },
    health: { overall: 'warn', summary: 'Daten konnten nicht geladen werden' },
    delegations: { pendingApproval: 0, inProgress: 0, completedToday: 0 },
  }

  try {
    // Import directly to avoid network round-trip in server component
    const { GET } = await import('@/app/api/briefing/route')
    const response = await GET()
    return (await response.json()) as BriefingData
  } catch {
    return empty
  }
}

function priorityLabel(p: number): string {
  if (p === 1) return 'Urgent'
  if (p === 2) return 'High'
  if (p === 3) return 'Medium'
  return 'Low'
}

function priorityColor(p: number): string {
  if (p === 1) return 'bg-red-500/20 text-red-300'
  if (p === 2) return 'bg-orange-500/20 text-orange-300'
  if (p === 3) return 'bg-yellow-500/20 text-yellow-300'
  return 'bg-slate-500/20 text-slate-400'
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'vor weniger als 1h'
  if (hours < 24) return `vor ${hours}h`
  const days = Math.floor(hours / 24)
  return `vor ${days}d`
}

function healthBadge(overall: BriefingData['health']['overall']) {
  if (overall === 'ok') return { label: 'OK', className: 'bg-emerald-500/20 text-emerald-300' }
  if (overall === 'warn') return { label: 'Warnung', className: 'bg-yellow-500/20 text-yellow-300' }
  return { label: 'Fehler', className: 'bg-red-500/20 text-red-300' }
}

function LinearIssueRow({ issue }: { issue: LinearIssue }) {
  return (
    <a
      href={issue.url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-start justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]"
    >
      <span className="min-w-0 flex-1 text-sm text-slate-300 group-hover:text-white truncate">
        {issue.title}
      </span>
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityColor(issue.priority)}`}>
        {priorityLabel(issue.priority)}
      </span>
    </a>
  )
}

function PRRow({ pr }: { pr: GitHubPR }) {
  return (
    <a
      href={pr.url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-start justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-slate-300 group-hover:text-white">
          #{pr.number} {pr.title}
        </span>
        <span className="text-[11px] text-slate-500">{pr.author} · {timeAgo(pr.updatedAt)}</span>
      </span>
      {pr.draft && (
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-500/20 text-slate-400">
          Draft
        </span>
      )}
    </a>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-500">{title}</h2>
      {children}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="px-3 py-2 text-sm text-slate-600 italic">{message}</p>
  )
}

export default async function BriefingPage() {
  const data = await getBriefingData()

  const now = new Date(data.generatedAt)
  const dateLabel = now.toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeLabel = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

  const badge = healthBadge(data.health.overall)

  const linearHasAny =
    data.linear.inProgress.length > 0 ||
    data.linear.dueToday.length > 0 ||
    data.linear.blocked.length > 0

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 lg:px-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Guten Morgen</h1>
        <p className="mt-1 text-sm text-slate-500">{dateLabel}</p>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Card 1 — Linear */}
        <Card title="Linear — Heute">
          {!linearHasAny ? (
            <EmptyState message="Keine offenen Tickets" />
          ) : (
            <div className="space-y-3">
              {data.linear.inProgress.length > 0 && (
                <div>
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                    In Progress
                  </p>
                  {data.linear.inProgress.map(issue => (
                    <LinearIssueRow key={issue.id} issue={issue} />
                  ))}
                </div>
              )}
              {data.linear.dueToday.length > 0 && (
                <div>
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-red-500">
                    Fällig heute
                  </p>
                  {data.linear.dueToday.map(issue => (
                    <LinearIssueRow key={`due-${issue.id}`} issue={issue} />
                  ))}
                </div>
              )}
              {data.linear.blocked.length > 0 && (
                <div>
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-orange-500">
                    Blockiert
                  </p>
                  {data.linear.blocked.map(issue => (
                    <LinearIssueRow key={`blocked-${issue.id}`} issue={issue} />
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Card 2 — GitHub PRs */}
        <Card title="GitHub PRs">
          {data.github.openPRs.length === 0 ? (
            <EmptyState message="Keine offenen PRs" />
          ) : (
            <div className="space-y-0.5">
              {data.github.openPRs.map(pr => (
                <PRRow key={pr.number} pr={pr} />
              ))}
            </div>
          )}
        </Card>

        {/* Card 3 — Delegationen */}
        <Card title="Delegationen">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <p className="text-2xl font-bold text-violet-300">{data.delegations.pendingApproval}</p>
              <p className="mt-1 text-[11px] text-slate-500 leading-tight">Warten auf Freigabe</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <p className="text-2xl font-bold text-emerald-300">{data.delegations.inProgress}</p>
              <p className="mt-1 text-[11px] text-slate-500 leading-tight">Laufen</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <p className="text-2xl font-bold text-blue-300">{data.delegations.completedToday}</p>
              <p className="mt-1 text-[11px] text-slate-500 leading-tight">Heute fertig</p>
            </div>
          </div>
          <div className="mt-3 px-1">
            <Link
              href="/delegations"
              className="text-xs font-medium text-violet-400 transition-colors hover:text-violet-300"
            >
              Alle Delegationen →
            </Link>
          </div>
        </Card>

        {/* Card 4 — System Health */}
        <Card title="System Health">
          <div className="flex items-center gap-3 px-3 py-2">
            <span className={`rounded-lg px-3 py-1.5 text-sm font-bold ${badge.className}`}>
              {badge.label}
            </span>
            <p className="min-w-0 flex-1 text-sm text-slate-400">{data.health.summary}</p>
          </div>
          <div className="mt-3 px-3">
            <Link
              href="/dev/health"
              className="text-xs font-medium text-violet-400 transition-colors hover:text-violet-300"
            >
              Details ansehen →
            </Link>
          </div>
        </Card>
      </div>

      {/* Footer */}
      <div className="mt-8 flex items-center justify-between text-xs text-slate-600">
        <span>Aktualisiert um {timeLabel}</span>
        <RefreshButton />
      </div>
    </main>
  )
}
