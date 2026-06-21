import { redirect } from 'next/navigation'

// /notifications merged into /inbox (tab: Benachrichtigungen)
export default function NotificationsPage() {
  redirect('/inbox?tab=notifications')
}
