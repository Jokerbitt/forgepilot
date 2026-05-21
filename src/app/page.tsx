import { ConnectorHealthBar } from '@/components/command-center/ConnectorHealthBar'
import { ApiKeysBanner } from '@/components/shared/ApiKeysBanner'
import { CommandCenterOverview } from '@/components/command-center/CommandCenterOverview'
import { OnboardingBanner } from '@/components/command-center/OnboardingBanner'
import { OnboardingBanner as OnboardingWizardBanner } from '@/components/onboarding/OnboardingBanner'

export default function Home() {
  return (
    <main className="min-h-screen text-white">
      <ConnectorHealthBar />
      <ApiKeysBanner />
      <OnboardingWizardBanner />
      <OnboardingBanner />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Command Center</p>
            <h1 className="page-title">Was ist der nächste Schritt?</h1>
          </div>
        </header>

        <CommandCenterOverview />
      </div>
    </main>
  )
}
