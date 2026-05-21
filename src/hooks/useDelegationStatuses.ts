import { useEffect, useState } from 'react'
import type { Delegation } from '@/lib/models/delegation'

export function useDelegationStatuses(briefId: string): Record<string, Delegation['status']> {
  const [statuses, setStatuses] = useState<Record<string, Delegation['status']>>({})

  useEffect(() => {
    if (!briefId) return
    fetch(`/api/delegations?briefId=${briefId}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: Delegation[] | null) => {
        if (!data) return
        const map: Record<string, Delegation['status']> = {}
        data.forEach(d => { map[d.id] = d.status })
        setStatuses(map)
      })
      .catch(() => {})
  }, [briefId])

  return statuses
}
