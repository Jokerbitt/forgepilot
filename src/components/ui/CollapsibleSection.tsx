'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cx } from '@/components/ui/primitives'

interface CollapsibleSectionProps {
  title: string
  /** Optional short label shown when collapsed (e.g. "3 Items") */
  collapsedHint?: string
  defaultOpen?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Simple expand/collapse wrapper for expert or secondary content.
 * Keeps the primary UX clean by hiding technical details by default.
 */
export function CollapsibleSection({
  title,
  collapsedHint,
  defaultOpen = false,
  className,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={cx('rounded-xl border border-white/[0.06] bg-white/[0.02]', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          }
          <span className="text-sm font-medium text-slate-300">{title}</span>
        </div>
        {!open && collapsedHint && (
          <span className="text-[11px] text-slate-600">{collapsedHint}</span>
        )}
      </button>
      {open && (
        <div className="border-t border-white/[0.05] px-4 pb-4 pt-3">
          {children}
        </div>
      )}
    </div>
  )
}
