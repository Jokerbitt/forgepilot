/**
 * AIErrorMessage — actionable yellow warning card for AI provider errors.
 *
 * Shown whenever an AI generation call fails with a 'no_ai_provider' error.
 */

import Link from 'next/link'

interface Props {
  error: string
  settingsUrl?: string
}

export function AIErrorMessage({ error, settingsUrl = '/settings' }: Props) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-yellow-900/50 bg-yellow-950/30 px-4 py-3"
    >
      <span className="mt-0.5 shrink-0 text-yellow-400" aria-hidden="true">
        ⚠️
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-yellow-200">{error}</p>
      </div>
      <Link
        href={settingsUrl}
        className="shrink-0 rounded-md border border-yellow-900/50 bg-yellow-900/30 px-3 py-1.5 text-xs font-semibold text-yellow-300 transition-colors hover:border-yellow-700 hover:text-yellow-100"
      >
        Einstellungen →
      </Link>
    </div>
  )
}
