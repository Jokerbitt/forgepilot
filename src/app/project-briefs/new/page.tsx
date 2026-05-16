import { IdeaIntakeWizard } from '@/components/project-briefs/IdeaIntakeWizard'

export default function NewProjectBriefPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <IdeaIntakeWizard />
      </div>
    </main>
  )
}
