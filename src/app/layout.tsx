import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/shared/ToastProvider'
import { AppNav } from '@/components/shared/AppNav'
import { GlobalKeyboardHandler } from '@/components/shared/GlobalKeyboardHandler'

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
      <body className="bg-[#07070c] text-white min-h-screen">
        <ToastProvider>
          <AppNav />
          <GlobalKeyboardHandler />
          <div className="lg:pl-64">
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  )
}
