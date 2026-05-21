import { ScopeBoard } from '@/components/agents/ScopeBoard'

export const dynamic = 'force-dynamic'

export default function ScopeDashboardPage() {
  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ScopeBoard />
      </div>
    </main>
  )
}
