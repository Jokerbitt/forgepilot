import type { Metadata } from 'next'
import './globals.css'

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
        {children}
      </body>
    </html>
  )
}
