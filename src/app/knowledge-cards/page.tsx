export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { readKnowledgeCards } from '@/lib/knowledge/knowledge-card'
import type { KnowledgeCard } from '@/lib/knowledge/knowledge-card'
import { Badge, EmptyState, Metric, Panel, buttonClassName } from '@/components/ui/primitives'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

export default function KnowledgeCardsPage() {
  const cards = readKnowledgeCards().reverse() // newest first

  const oldest = cards.length > 0 ? cards[cards.length - 1] : null
  const newest = cards.length > 0 ? cards[0] : null

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">

        {/* Header */}
        <header className="mb-6 border-b border-slate-800 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Knowledge Base
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Delegation Lessons
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Lektionen aus Delegation-Runs — automatisch nach jeder erfolgreichen Ausführung geschrieben.
              </p>
            </div>
            <Link href="/knowledge" className={buttonClassName('secondary', 'shrink-0')}>
              Knowledge Center
            </Link>
          </div>
        </header>

        {/* Stats Row */}
        <section className="mb-8 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Lektionen"
            value={cards.length}
            detail="aus Delegation-Runs"
            tone="info"
          />
          <Metric
            label="Älteste"
            value={oldest ? formatDateShort(oldest.createdAt) : '—'}
            detail="erste Lektion"
            tone="neutral"
          />
          <Metric
            label="Neueste"
            value={newest ? formatDateShort(newest.createdAt) : '—'}
            detail="letzte Lektion"
            tone="neutral"
          />
        </section>

        {/* Cards list or empty state */}
        {cards.length === 0 ? (
          <EmptyState
            title="Noch keine Knowledge Cards"
            description="Führe eine Delegation aus, um Lektionen zu sammeln. Nach jeder erfolgreichen Ausführung wird automatisch eine Knowledge Card geschrieben."
            action={
              <Link href="/delegations" className={buttonClassName('primary')}>
                Zu den Delegations
              </Link>
            }
          />
        ) : (
          <Panel>
            <div className="divide-y divide-slate-800">
              {cards.map(card => (
                <KnowledgeCardRow key={card.id} card={card} />
              ))}
            </div>
          </Panel>
        )}

        {/* Back link */}
        <div className="mt-8">
          <Link href="/" className="text-sm text-slate-500 transition-colors hover:text-slate-300">
            ← Zurück zum Command Center
          </Link>
        </div>
      </main>
    </div>
  )
}

function KnowledgeCardRow({ card }: { card: KnowledgeCard }) {
  return (
    <article className="px-5 py-5">
      {/* Title + tags row */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-sm font-semibold leading-snug text-white">
          {card.title}
        </h2>
        <time
          dateTime={card.createdAt}
          className="shrink-0 text-xs text-slate-500"
          title={formatDate(card.createdAt)}
        >
          {formatDate(card.createdAt)}
        </time>
      </div>

      {/* Tag chips */}
      {card.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {card.tags.map(tag => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Content */}
      <pre className="whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs leading-relaxed text-slate-300">
        {card.content}
      </pre>

      {/* PR link + source meta */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span>
          Delegation{' '}
          <span className="font-mono text-slate-400">{card.sourceId.slice(-8)}</span>
        </span>
        {card.briefId && (
          <span>
            Brief{' '}
            <Link
              href={`/project-briefs/${card.briefId}`}
              className="font-mono text-violet-400 transition-colors hover:text-violet-300"
            >
              {card.briefId.slice(-8)}
            </Link>
          </span>
        )}
        {card.prUrl && (
          <a
            href={card.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 transition-colors hover:text-sky-300"
          >
            PR öffnen →
          </a>
        )}
      </div>
    </article>
  )
}
