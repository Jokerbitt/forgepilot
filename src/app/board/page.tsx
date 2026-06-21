import { redirect } from 'next/navigation'

// /board merged into /delegations (view-toggle available there)
export default function BoardPage() {
  redirect('/delegations')
}
