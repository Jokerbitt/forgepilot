import { ConnectorHealthBar } from '@/components/command-center/ConnectorHealthBar'
import { AutopilotRunner } from '@/components/command-center/AutopilotRunner'
import { ApiKeysBanner } from '@/components/shared/ApiKeysBanner'
import { CommandCenterOverview } from '@/components/command-center/CommandCenterOverview'
import { buttonClassName } from '@/components/ui/primitives'

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <ConnectorHealthBar />
      <AutopilotRunner />
      <ApiKeysBanner />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-slate-800 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Daily Operations</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Command Center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Eine fokussierte Tagessteuerung: naechster Schritt, echte Aufmerksamkeitspunkte und Systembereitschaft.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a href="/project-briefs" className={buttonClassName('secondary')}>
              Neue Idee
            </a>
            <a href="/delegations?new=1" className={buttonClassName('primary')}>
              Neue Delegation
            </a>
          </div>
        </header>

        <CommandCenterOverview />
      </div>
    </main>
  )
}
