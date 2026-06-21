import { redirect } from 'next/navigation'

// Consolidated into /live?tab=monitor — all agent monitoring in one hub
export default function MonitorPage() {
  redirect('/live?tab=monitor')
}
