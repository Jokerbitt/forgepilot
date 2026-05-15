'use client'

import { useEffect, useState } from 'react'

interface HealthResponse {
  healthy: boolean
  total: number
  connectors: Record<string, { status: 'healthy' | 'unhealthy', error?: string }>
}

export function ConnectorHealthBar() {
  const [health, setHealth] = useState<HealthResponse | null>(null)

  useEffect(() => {
    fetch('/api/connectors/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(console.error)
  }, [])

  if (!health) return <div className="h-1 w-full bg-gray-900 animate-pulse" />

  return (
    <div className="flex h-1 w-full bg-gray-900 overflow-hidden">
      {Object.entries(health.connectors).map(([name, info]) => (
        <div
          key={name}
          title={`${name}: ${info.status}`}
          className={`h-full flex-1 ${info.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`}
        />
      ))}
    </div>
  )
}
