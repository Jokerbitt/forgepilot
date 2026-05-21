'use client'

import { usePathname } from 'next/navigation'
import { AppNav } from './AppNav'
import { PendingApprovalsBar } from './PendingApprovalsBar'

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/login' || pathname.startsWith('/login/')

  if (isLogin) {
    return <>{children}</>
  }

  return (
    <>
      <AppNav />
      <div className="min-[600px]:pl-56 lg:pl-64">
        <PendingApprovalsBar />
        {children}
      </div>
    </>
  )
}
