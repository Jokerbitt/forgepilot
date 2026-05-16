import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/shared/ToastProvider'
import { AppNav } from '@/components/shared/AppNav'

export const metadata: Metadata = {
  title: 'ForgePilot',
  description: 'AI Workflow OS — From Idea to Execution',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" className="dark">
      <body className="bg-gray-950 text-white min-h-screen">
        <ToastProvider>
          <AppNav />
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
