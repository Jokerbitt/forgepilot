'use client'

import { useState } from 'react'
import { Badge, cx } from '@/components/ui/primitives'

interface BlockedByBadgeProps {
  itemId: string
  blockedBy?: string[]
  onRemoveBlocker?: (blockerId: string) => void
}

export function BlockedByBadge({ itemId, blockedBy = [], onRemoveBlocker }: BlockedByBadgeProps) {
  const [showBlockers, setShowBlockers] = useState(false)

  if (!blockedBy || blockedBy.length === 0) {
    return null
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowBlockers(!showBlockers)}
        className={cx(
          'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold border',
          'bg-red-900/30 text-red-400 border-red-800/40',
          'hover:bg-red-900/50 transition-colors cursor-pointer'
        )}
        title={`Blocked by ${blockedBy.length} item${blockedBy.length !== 1 ? 's' : ''}`}
      >
        <span>⛔</span>
        <span>Blocked by {blockedBy.length}</span>
      </button>

      {showBlockers && blockedBy.length > 0 && (
        <div className="absolute top-full mt-1 right-0 z-50 min-w-max rounded-lg border border-slate-700 bg-slate-900 shadow-lg p-2">
          <div className="text-xs text-slate-400 mb-2 px-2">
            Blocked by:
          </div>
          <div className="space-y-1">
            {blockedBy.map(blockerId => (
              <div
                key={blockerId}
                className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-slate-800/50"
              >
                <code className="text-xs text-sky-400 font-mono">{blockerId}</code>
                {onRemoveBlocker && (
                  <button
                    onClick={() => {
                      onRemoveBlocker(blockerId)
                      setShowBlockers(false)
                    }}
                    className="text-slate-500 hover:text-red-400 transition-colors text-xs"
                    title="Remove blocker"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
