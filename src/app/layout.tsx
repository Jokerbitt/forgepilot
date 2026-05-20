import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/shared/ToastProvider'
import { AppNav } from '@/components/shared/AppNav'
import { GlobalKeyboardHandler } from '@/components/shared/GlobalKeyboardHandler'
import { GlobalSearch } from '@/components/search/GlobalSearch'
import { themeScriptContent } from '@/lib/theme/theme-store'

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
    <html lang="de">
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <head>
        {/* Blocking theme script — prevents flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: themeScriptContent }} />
      </head>
      <body className="bg-[#07070c] text-white min-h-screen dark:bg-[#07070c] dark:text-white">
        <ToastProvider>
          <AppNav />
          <GlobalKeyboardHandler />
          <GlobalSearch />
          <div className="sm:pl-64">
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  )
}
