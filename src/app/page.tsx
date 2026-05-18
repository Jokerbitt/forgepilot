import { ConnectorHealthBar } from '@/components/command-center/ConnectorHealthBar'
import { AutopilotRunner } from '@/components/command-center/AutopilotRunner'
import { ApiKeysBanner } from '@/components/shared/ApiKeysBanner'
import { CommandCenterOverview } from '@/components/command-center/CommandCenterOverview'
import { buttonClassName } from '@/components/ui/primitives'

export default function Home() {
  return (
    <main className="min-h-screen text-white">
      <ConnectorHealthBar />
      <AutopilotRunner />
      <ApiKeysBanner />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Daily Operations</p>
            <h1 className="page-title">Command Center</h1>
            <p className="page-description">
              Fokussierte Tagessteuerung — nächster Schritt, Aufmerksamkeitspunkte, Systembereitschaft.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
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
