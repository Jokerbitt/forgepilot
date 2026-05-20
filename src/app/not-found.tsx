/**
 * 404 Not Found — M96
 * Shown when a page or dynamic route doesn't exist.
 */

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl font-bold text-slate-700">404</div>
        <div>
          <h1 className="text-xl font-semibold text-white mb-2">Seite nicht gefunden</h1>
          <p className="text-sm text-slate-400">
            Diese Seite existiert nicht oder wurde verschoben.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          ← Command Center
        </Link>
      </div>
    </div>
  )
}
