'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface BlockFile { dest: string; note?: string }
interface Block {
  id: string
  name: string
  category: string
  stack: string
  summary: string
  whenToUse: string
  dependencies: string[]
  fileCount: number
  files: BlockFile[]
  setupSteps: string[]
}
interface Catalog {
  total: number
  totalFiles: number
  byCategory: Record<string, number>
  blocks: Block[]
}

const CATEGORY_COLORS: Record<string, string> = {
  auth: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  database: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'ui-layout': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  billing: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  testing: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  'api-crud': 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  deployment: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
}

export default function BuildingBlocksPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/building-blocks')
      .then(r => r.json())
      .then((d: Catalog) => setCatalog(d))
      .catch(() => undefined)
  }, [])

  return (
    <main className="min-h-screen bg-[#07070c] text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">← Command Center</Link>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-400">Don't reinvent the wheel</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">SaaS Building Blocks</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Wiederverwendbare, getestete Bausteine, die Agenten beim App-Bau kopieren und anpassen —
            statt jedes Mal Auth, Datenbank, Billing und UI neu zu erfinden. Der Agent bekommt nur den
            schlanken Katalog (~1,6k Tokens) und liest die echten Dateien bei Bedarf.
          </p>
        </div>

        {!catalog ? (
          <div className="mt-8 text-sm text-slate-500">Lade Katalog…</div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                <p className="text-2xl font-bold">{catalog.total}</p>
                <p className="text-xs text-slate-500">Bausteine</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                <p className="text-2xl font-bold">{catalog.totalFiles}</p>
                <p className="text-xs text-slate-500">Scaffold-Dateien</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                <p className="text-2xl font-bold">{Object.keys(catalog.byCategory).length}</p>
                <p className="text-xs text-slate-500">Kategorien</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {catalog.blocks.map(block => {
                const open = expanded === block.id
                return (
                  <div key={block.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025]">
                    <button
                      onClick={() => setExpanded(open ? null : block.id)}
                      className="flex w-full items-start gap-3 p-4 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_COLORS[block.category] ?? 'border-white/20 text-slate-300'}`}>
                            {block.category}
                          </span>
                          <h3 className="text-sm font-semibold">{block.name}</h3>
                          <span className="text-[10px] text-slate-600">{block.fileCount} Dateien</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{block.summary}</p>
                      </div>
                      <span className="text-slate-600">{open ? '−' : '+'}</span>
                    </button>

                    {open && (
                      <div className="border-t border-white/[0.06] px-4 py-3 text-xs">
                        <p className="text-slate-300"><span className="font-semibold text-slate-400">Wann nutzen:</span> {block.whenToUse}</p>
                        {block.dependencies.length > 0 && (
                          <p className="mt-2 text-slate-400">
                            <span className="font-semibold">Deps:</span>{' '}
                            <code className="text-violet-300">{block.dependencies.join(', ')}</code>
                          </p>
                        )}
                        <div className="mt-3">
                          <p className="font-semibold text-slate-400">Dateien:</p>
                          <ul className="mt-1 space-y-1">
                            {block.files.map(f => (
                              <li key={f.dest} className="text-slate-500">
                                <code className="text-emerald-300">{f.dest}</code>
                                {f.note ? <span className="text-slate-600"> — {f.note}</span> : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {block.setupSteps.length > 0 && (
                          <div className="mt-3">
                            <p className="font-semibold text-slate-400">Nach dem Kopieren:</p>
                            <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-slate-500">
                              {block.setupSteps.map((s, i) => <li key={i}>{s}</li>)}
                            </ol>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
