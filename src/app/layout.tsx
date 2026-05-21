import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/shared/ToastProvider'
import { GlobalKeyboardHandler } from '@/components/shared/GlobalKeyboardHandler'
import { GlobalSearch } from '@/components/search/GlobalSearch'
import { themeScriptContent } from '@/lib/theme/theme-store'
import { AppChrome } from '@/components/shared/AppChrome'
import { CommandPalette } from '@/components/command-palette'

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
          <GlobalKeyboardHandler />
          <GlobalSearch />
          <CommandPalette />
          <AppChrome>
            {children}
          </AppChrome>
        </ToastProvider>
      </body>
    </html>
  )
}
