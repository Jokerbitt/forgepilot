import { BriefStudioFlow } from '@/components/project-briefs/BriefStudioFlow'
import { IdeaIntakeWizard } from '@/components/project-briefs/IdeaIntakeWizard'

export default function NewProjectBriefPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-10">
        <BriefStudioFlow />

        <details className="group rounded-xl border border-gray-800 bg-gray-900/40">
          <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold text-gray-400 hover:text-gray-200 transition-colors list-none flex items-center justify-between">
            <span>Erweiterter Idea Intake Wizard</span>
            <span className="text-gray-600 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="border-t border-gray-800 p-5">
            <IdeaIntakeWizard />
          </div>
        </details>
      </div>
    </main>
  )
}
