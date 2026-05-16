'use client'

import { useEffect, useState } from 'react'

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
      .catch(console.error)
  }, [])

  if (!health || !health.connectors) return <div className="h-1 w-full bg-gray-900 animate-pulse" />

  return (
    <div className="flex h-1 w-full bg-gray-900 overflow-hidden">
      {health.connectors.map((conn, idx) => (
        <div
          key={idx}
          title={`${conn.manifest.name}: ${conn.health.status}`}
          className={`h-full flex-1 ${conn.health.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`}
        />
      ))}
    </div>
  )
}
