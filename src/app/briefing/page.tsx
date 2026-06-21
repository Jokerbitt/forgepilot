import { redirect } from 'next/navigation'

// /briefing merged into /digest (tab: Briefing)
export default function BriefingPage() {
  redirect('/digest?tab=briefing')
}
