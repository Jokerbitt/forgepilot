'use client'

import type { Delegation } from '@/lib/models/delegation'

interface Props {
  delegation: Delegation
  onApprove?: () => void
  onStart?: () => void
  onRetry?: () => void
  onRetryEscalate?: () => void
  onCreatePR?: () => void
  creatingPR?: boolean
}

interface Action {
  label: string
  onClick?: () => void
  href?: string
  variant: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}

interface Guidance {
  icon: string
  title: string
  body: string
  actions: Action[]
  colorClass: string
  borderClass: string
}

export function getGuidance(d: Delegation, props: Omit<Props, 'delegation'>): Guidance | null {
  const hasPr = !!d.summaryReport?.prUrl
  const hasCritic = !!d.criticScore

  switch (d.status) {
    case 'pending':
      if (d.contract.requiresApproval) {
        if (d.contract.riskClass === 'C') {
          return {
            icon: '🔒',
            title: 'Manuelle Freigabe erforderlich (Risk C)',
            body: 'Diese Delegation hat Risk Class C und muss von Sven manuell freigegeben werden.',
            actions: [],
            colorClass: 'text-red-300',
            borderClass: 'border-red-900/50 bg-red-950/20',
          }
        }
        return {
          icon: '⏳',
          title: 'Delegation wartet auf Freigabe',
          body: 'Prüfe Ziel, Scope und Budget — dann freigeben um die Ausführung zu starten.',
          actions: [
            { label: '✔ Freigeben', onClick: props.onApprove, variant: 'primary' },
          ],
          colorClass: 'text-blue-300',
          borderClass: 'border-blue-900/50 bg-blue-950/20',
        }
      }
      return {
        icon: '🟡',
        title: 'Bereit zum Starten',
        body: 'Delegation ist erstellt. Keine Freigabe erforderlich — direkt starten.',
        actions: [
          { label: '▶ Starten', onClick: props.onStart, variant: 'primary' },
        ],
        colorClass: 'text-yellow-300',
        borderClass: 'border-yellow-900/50 bg-yellow-950/20',
      }

    case 'approved':
      return {
        icon: '✅',
        title: 'Freigegeben — starte die Ausführung',
        body: 'Delegation ist genehmigt. Klicke Starten um den Agenten zu beauftragen.',
        actions: [
          { label: '▶ Starten', onClick: props.onStart, variant: 'primary' },
        ],
        colorClass: 'text-green-300',
        borderClass: 'border-green-900/50 bg-green-950/20',
      }

    case 'running':
      return {
        icon: '⚡',
        title: 'Agent ist aktiv',
        body: 'Die Delegation wird ausgeführt. Live-Log unten zeigt den Fortschritt.',
        actions: [],
        colorClass: 'text-violet-300',
        borderClass: 'border-violet-900/50 bg-violet-950/20',
      }

    case 'completed':
      if (!hasPr && !hasCritic) {
        return {
          icon: '🎯',
          title: 'Fertig — nächste Schritte',
          body: '1. Ergebnis prüfen  2. Critic-Bewertung starten  3. GitHub PR erstellen',
          actions: [
            {
              label: '⎇ PR erstellen',
              onClick: props.onCreatePR,
              variant: 'primary',
              disabled: props.creatingPR,
            },
          ],
          colorClass: 'text-emerald-300',
          borderClass: 'border-emerald-900/50 bg-emerald-950/20',
        }
      }
      if (hasPr && !hasCritic) {
        return {
          icon: '🎯',
          title: 'PR erstellt — Critic-Review ausstehend',
          body: 'Scrolle zu "Grok Critic Review" um das Ergebnis bewerten zu lassen.',
          actions: [
            {
              label: '⎇ PR auf GitHub',
              href: d.summaryReport?.prUrl,
              variant: 'secondary',
            },
          ],
          colorClass: 'text-emerald-300',
          borderClass: 'border-emerald-900/50 bg-emerald-950/20',
        }
      }
      if (hasPr && hasCritic) {
        const verdict = d.criticScore?.verdict
        if (verdict === 'approved') {
          return {
            icon: '🏆',
            title: 'Vollständig abgeschlossen',
            body: 'Critic hat approved. PR ist bereit zum Mergen.',
            actions: [
              {
                label: '⎇ PR mergen',
                href: d.summaryReport?.prUrl,
                variant: 'primary',
              },
            ],
            colorClass: 'text-emerald-300',
            borderClass: 'border-emerald-900/40 bg-emerald-950/10',
          }
        }
        if (verdict === 'needs-revision') {
          return {
            icon: '⚠',
            title: 'Critic: Revision erforderlich',
            body: 'Das Ergebnis wurde bewertet und benötigt Anpassungen. Änderungen vornehmen und dann neu ausführen.',
            actions: [
              { label: '🔄 Neu ausführen', onClick: props.onRetry, variant: 'secondary' },
              {
                label: '⎇ PR prüfen',
                href: d.summaryReport?.prUrl,
                variant: 'secondary',
              },
            ],
            colorClass: 'text-yellow-300',
            borderClass: 'border-yellow-900/50 bg-yellow-950/20',
          }
        }
      }
      return null

    case 'failed': {
      const lastError = d.logs?.filter(l => l.type === 'error').slice(-1)[0]?.message
      const isNoProvider = lastError?.includes('NoAIProvider') || lastError?.includes('no AI provider')
      const isTimeout = lastError?.includes('timeout') || lastError?.includes('ETIMEDOUT')
      const isBudget = lastError?.includes('budget') || lastError?.includes('cost')

      let body = 'Delegation ist fehlgeschlagen. Wähle eine Aktion:'
      if (isNoProvider) body = 'Kein AI-Provider konfiguriert. Ollama starten oder API-Key in /settings hinterlegen.'
      if (isTimeout) body = 'Timeout beim Ausführen. Retry mit mehr Zeit oder eskaliere auf Cloud-Modell.'
      if (isBudget) body = 'Budget überschritten. Budget erhöhen oder auf günstigeres Modell wechseln.'

      return {
        icon: '❌',
        title: 'Ausführung fehlgeschlagen',
        body,
        actions: [
          { label: '🔄 Wiederholen', onClick: props.onRetry, variant: 'secondary' },
          ...(isNoProvider ? [{ label: '⚙ Provider einrichten', href: '/settings', variant: 'primary' as const }] : []),
          ...(!isNoProvider ? [{ label: '☁ Mit bestem Modell', onClick: props.onRetryEscalate, variant: 'primary' as const }] : []),
        ],
        colorClass: 'text-red-300',
        borderClass: 'border-red-900/50 bg-red-950/20',
      }
    }

    case 'cancelled':
      return {
        icon: '⛔',
        title: 'Abgebrochen',
        body: 'Delegation wurde abgebrochen. Retry um neu zu starten.',
        actions: [
          { label: '🔄 Wiederholen', onClick: props.onRetry, variant: 'secondary' },
        ],
        colorClass: 'text-gray-400',
        borderClass: 'border-gray-800 bg-gray-950/30',
      }

    default:
      return null
  }
}

export function DelegationNextActionPanel({ delegation, ...props }: Props) {
  const guidance = getGuidance(delegation, props)
  if (!guidance) return null

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${guidance.borderClass}`}>
      <span className="text-lg shrink-0 mt-0.5">{guidance.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${guidance.colorClass}`}>{guidance.title}</p>
        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{guidance.body}</p>
        {guidance.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            {guidance.actions.map((action, i) =>
              action.href ? (
                <a
                  key={i}
                  href={action.href}
                  target={action.href.startsWith('/') ? undefined : '_blank'}
                  rel={action.href.startsWith('/') ? undefined : 'noopener noreferrer'}
                  className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                    action.variant === 'primary'
                      ? 'bg-blue-900/50 text-blue-300 border-blue-800 hover:bg-blue-900'
                      : 'text-gray-400 border-gray-700 hover:text-gray-200 hover:border-gray-600'
                  }`}
                >
                  {action.label}
                </a>
              ) : (
                <button
                  key={i}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors disabled:opacity-40 ${
                    action.variant === 'primary'
                      ? 'bg-blue-900/50 text-blue-300 border-blue-800 hover:bg-blue-900'
                      : action.variant === 'danger'
                      ? 'bg-red-900/50 text-red-300 border-red-800 hover:bg-red-900'
                      : 'text-gray-400 border-gray-700 hover:text-gray-200 hover:border-gray-600'
                  }`}
                >
                  {action.label}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
