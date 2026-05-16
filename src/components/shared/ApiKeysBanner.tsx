import Link from 'next/link'
import { readStoredApiKeys } from '@/lib/connectors/config'

function getKeyStatus() {
  const keys = readStoredApiKeys()
  // Also check environment variables as fallback
  const hasGithub = !!(keys.GITHUB_TOKEN || process.env.GITHUB_TOKEN)
  const hasLinear = !!(keys.LINEAR_API_KEY || process.env.LINEAR_API_KEY)
  const hasAnthropic = !!(keys.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY)
  return { hasGithub, hasLinear, hasAnthropic }
}

export function ApiKeysBanner() {
  const { hasGithub, hasLinear, hasAnthropic } = getKeyStatus()

  const missing: string[] = []
  if (!hasGithub) missing.push('GitHub Token')
  if (!hasLinear) missing.push('Linear API Key')
  if (!hasAnthropic) missing.push('Anthropic API Key')

  if (missing.length === 0) return null

  return (
    <div className="mx-auto max-w-4xl px-6 pt-4">
      <div className="flex items-start gap-3 rounded-lg border border-yellow-900/50 bg-yellow-950/30 px-4 py-3">
        <span className="mt-0.5 text-yellow-400 flex-shrink-0">⚠️</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-yellow-200 font-medium">
            Keine API Keys konfiguriert
          </p>
          <p className="text-xs text-yellow-300/70 mt-0.5">
            Fehlend: {missing.join(', ')} — Work Items und NBA-Empfehlungen bleiben leer.
          </p>
        </div>
        <Link
          href="/settings"
          className="flex-shrink-0 text-xs font-bold text-yellow-400 hover:text-yellow-300 bg-yellow-900/40 hover:bg-yellow-900/60 border border-yellow-900/50 px-3 py-1.5 rounded-lg transition-colors"
        >
          Keys eintragen →
        </Link>
      </div>
    </div>
  )
}
