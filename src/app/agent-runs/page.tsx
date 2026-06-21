import { redirect } from 'next/navigation'

// Consolidated into /live?tab=runs — all agent runs in one hub
export default function AgentRunsPage() {
  redirect('/live?tab=runs')
}
