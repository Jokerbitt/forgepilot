import Link from 'next/link'
import { ConnectorHealthBar } from '@/components/command-center/ConnectorHealthBar'
import { ApiKeysBanner } from '@/components/shared/ApiKeysBanner'
import { NoAIProviderBanner } from '@/components/shared/NoAIProviderBanner'
import { CommandCenterOverview, CommandCenterPrinciples } from '@/components/command-center/CommandCenterOverview'
import { OnboardingBanner } from '@/components/command-center/OnboardingBanner'
import { OnboardingBanner as OnboardingWizardBanner } from '@/components/onboarding/OnboardingBanner'
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist'
import { buttonClassName } from '@/components/ui/primitives'
import { CriticalPathWidget } from '@/components/critical-path'
import { MissionControlPanel } from '@/components/mission-control'
import { ExecuteLoopEvidenceWidget } from '@/components/execute-loop'
import { AgentModeBanner } from '@/components/ui/AgentModeBanner'
import { QuickDelegateWidget } from '@/components/command-center/QuickDelegateWidget'

export default function Home() {
  return (
    <main className="min-h-screen text-white">
      <ConnectorHealthBar />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Command Center</p>
            <h1 className="page-title">Was ist der nächste Schritt?</h1>
            <p className="page-description">
              Reduziert auf Entscheidung, Ausfuehrung und Review. Alles Weitere bleibt bewusst zweitrangig.
            </p>
          </div>
          <div className="flex shrink-0 flex-row flex-wrap gap-2">
            <Link href="/live" className={buttonClassName('secondary')}>
              Live View
            </Link>
            <Link href="/idea" className={buttonClassName('secondary')}>
              Neue Idee
            </Link>
            <Link href="/pilot" className={buttonClassName('secondary')}>
              Pilot starten
            </Link>
            <Link href="/delegations?new=1" className={buttonClassName('primary')}>
              Neue Delegation
            </Link>
          </div>
        </header>

        <OnboardingChecklist />

        <MissionControlPanel />

        <section className="mb-6">
          <ExecuteLoopEvidenceWidget />
        </section>

        <div className="mb-5">
          <CommandCenterPrinciples />
        </div>
        <CommandCenterOverview />

        <section className="mt-6">
          <CriticalPathWidget />
        </section>

        <section className="mt-6">
          <QuickDelegateWidget />
        </section>

        <section className="mt-6 space-y-4" aria-label="Setup-Hinweise">
          <AgentModeBanner />
          <NoAIProviderBanner />
          <ApiKeysBanner />
          <OnboardingWizardBanner />
          <OnboardingBanner />
        </section>
      </div>
    </main>
  )
}
