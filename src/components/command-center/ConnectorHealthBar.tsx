'use client'

import { useEffect, useState } from 'react'
import { captureError } from '@/lib/logger/browser'

interface HealthResponse {
  connectors: Array<{
    manifest: { name: string }
    health: { status: 'ok' | 'unconfigured' | 'error', errorMessage?: string }
  }>
}

export function ConnectorHealthBar() {
  const [health, setHealth] = useState<HealthResponse | null>(null)

  useEffect(() => {
    fetch('/api/connectors/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(err => captureError(err, 'ConnectorHealthBar:fetch'))
  }, [])

  if (!health || !health.connectors) return <div className="h-1 w-full bg-gray-900 animate-pulse" />

  const statusColor = (status: string) => {
    if (status === 'ok') return 'bg-green-500'
    if (status === 'unconfigured') return 'bg-yellow-600'
    return 'bg-red-500'
  }

  return (
    <div className="flex h-1 w-full bg-gray-900 overflow-hidden">
      {health.connectors.map((conn, idx) => (
        <div
          key={idx}
          title={`${conn.manifest.name}: ${conn.health.status}${conn.health.errorMessage ? ` — ${conn.health.errorMessage}` : ''}`}
          className={`h-full flex-1 ${statusColor(conn.health.status)}`}
        />
      ))}
    </div>
  )
}
