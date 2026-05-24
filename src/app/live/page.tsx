import Link from 'next/link'
import { ConnectorHealthBar } from '@/components/command-center/ConnectorHealthBar'
import { CriticalPathWidget } from '@/components/critical-path'
import { ExecuteLoopEvidenceWidget } from '@/components/execute-loop'
import { MissionControlPanel } from '@/components/mission-control'
import { buttonClassName } from '@/components/ui/primitives'

export default function LivePage() {
  return (
    <main className="min-h-screen text-white">
      <ConnectorHealthBar />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Live View</p>
            <h1 className="page-title">Was passiert gerade?</h1>
            <p className="page-description">
              Kompakter Echtzeit-Blick auf Assistenten-Reife, laufende Delegationen, Blocker und den nächsten sinnvollen Schritt.
            </p>
          </div>
          <div className="flex shrink-0 flex-row flex-wrap gap-2">
            <Link href="/idea" className={buttonClassName('primary')}>
              Neue Idee testen
            </Link>
            <Link href="/projects" className={buttonClassName('secondary')}>
              Projekte öffnen
            </Link>
            <Link href="/" className={buttonClassName('ghost')}>
              Command Center
            </Link>
          </div>
        </header>

        <MissionControlPanel />

        <section className="mb-6">
          <ExecuteLoopEvidenceWidget />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <CriticalPathWidget />
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6 shadow-sm shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">So nutzt du die Ansicht</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Ein Blick, dann handeln</h2>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
              <li>
                <span className="font-semibold text-white">1. Real Value Loop prüfen:</span> Sind genug echte Läufe mit PR, Critic und Writeback bewiesen?
              </li>
              <li>
                <span className="font-semibold text-white">2. Nächste Aktion öffnen:</span> Mission Control zeigt dir den aktuell wichtigsten Schritt.
              </li>
              <li>
                <span className="font-semibold text-white">3. Blocker zuerst lösen:</span> Keine neuen Agenten starten, wenn ein fehlgeschlagener Lauf unklar ist.
              </li>
            </ol>
          </div>
        </section>
      </div>
    </main>
  )
}
