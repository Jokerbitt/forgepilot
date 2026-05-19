'use client'

import { useState, useEffect } from 'react'

interface VersionBadgeProps {
  delegationId: string
  compact?: boolean
}

export function VersionBadge({ delegationId, compact = false }: VersionBadgeProps) {
  const [versionCount, setVersionCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/delegations/versions?delegationId=${delegationId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.count) {
          setVersionCount(data.count)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [delegationId])

  if (loading || versionCount === 0) {
    return null
  }

  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded bg-purple-950/50 border border-purple-900/50 text-purple-400 hover:text-purple-200 hover:bg-purple-900/40 transition-colors"
      title={`Contract version ${versionCount}`}
    >
      v{versionCount}
    </span>
  )
}
