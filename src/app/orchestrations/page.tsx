import { redirect } from 'next/navigation'

// Consolidated into /live?tab=orchestrations — all orchestrations in one hub
export default function OrchestrationsPage() {
  redirect('/live?tab=orchestrations')
}
