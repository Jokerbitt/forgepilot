import { redirect } from 'next/navigation'

// /active merged into /live (live streaming view)
export default function ActivePage() {
  redirect('/live')
}
