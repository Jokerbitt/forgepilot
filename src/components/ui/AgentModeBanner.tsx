'use client'

import { useEffect, useState } from 'react'

type ActiveMode = 'claude-cli' | 'claude-api' | 'simulation'

interface CliStatus {
  claudeCliAvailable: boolean
  claudeCliVersion: string | null
  claudeApiKeySet: boolean
  activeMode: ActiveMode
  setupUrl: string
}

const MODE_CONFIG: Record<ActiveMode, { label: string; description: string; color: string; icon: string }> = {
  'claude-cli': {
    label: 'Claude CLI',
    description: 'Full agentic mode — real code execution via Claude Code CLI.',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200',
    icon: '✓',
  },
  'claude-api': {
    label: 'Claude API (Tool-Use)',
    description: 'API-based agent — reads/writes files, runs safe commands, opens PRs via GitHub CLI.',
    color: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
    icon: '◈',
  },
  'simulation': {
    label: 'Simulation Mode',
    description: 'No CLI and no API key configured. Delegations will be simulated without real execution.',
    color: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200',
    icon: '⚠',
  },
}

export function AgentModeBanner() {
  const [status, setStatus] = useState<CliStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/system/cli-status')
      .then(r => r.json())
      .then((data: CliStatus) => setStatus(data))
      .catch(() => null)
  }, [])

  if (!status || dismissed) return null
  if (status.activeMode === 'claude-cli') return null

  const config = MODE_CONFIG[status.activeMode]

  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${config.color}`}>
      <span className="mt-0.5 text-base leading-none select-none">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <span className="font-semibold">{config.label}</span>
        {' — '}
        <span>{config.description}</span>
        {status.activeMode === 'simulation' && (
          <span>
            {' '}
            <a
              href={status.setupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              Install Claude CLI
            </a>
            {' or add an '}
            <a href="/settings" className="underline font-medium">API key in Settings</a>
            {' to enable real execution.'}
          </span>
        )}
        {status.activeMode === 'claude-api' && (
          <span>
            {' '}
            <a
              href={status.setupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              Install Claude CLI
            </a>
            {' for full native mode.'}
          </span>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
