'use client'

import Link from 'next/link'
import { classifyError, type ClassifiedError } from '@/lib/delegations/error-classifier'

interface Props {
  errorMessage: string
  /** Optional pre-classified error — if omitted, classifyError() is called internally */
  classified?: ClassifiedError
}

const severityStyles: Record<ClassifiedError['severity'], { border: string; bg: string; icon: string; iconColor: string }> = {
  blocking: {
    border: 'border-red-500/25',
    bg:     'bg-red-500/[0.05]',
    icon:   '✗',
    iconColor: 'text-red-400',
  },
  warning: {
    border: 'border-amber-500/25',
    bg:     'bg-amber-500/[0.05]',
    icon:   '!',
    iconColor: 'text-amber-400',
  },
  info: {
    border: 'border-sky-500/25',
    bg:     'bg-sky-500/[0.05]',
    icon:   'ℹ',
    iconColor: 'text-sky-400',
  },
}

export function DelegationErrorBanner({ errorMessage, classified: classifiedProp }: Props) {
  const classified = classifiedProp ?? classifyError(errorMessage)
  const style = severityStyles[classified.severity]

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} p-4`}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 text-sm font-bold ${style.iconColor}`}>
          {style.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{classified.title}</p>
          <p className="mt-0.5 text-xs text-slate-400">{classified.cause}</p>
        </div>
        <span className="shrink-0 rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
          {classified.class}
        </span>
      </div>

      {/* Next action */}
      <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Nächster Schritt</p>
        <p className="mt-1 text-xs text-slate-300">{classified.nextAction}</p>
        {classified.actionHref && (
          <Link
            href={classified.actionHref}
            className="mt-2 inline-block text-[11px] font-medium text-violet-400 hover:text-violet-300 transition-colors"
          >
            Jetzt beheben →
          </Link>
        )}
      </div>

      {/* Raw error — collapsed in a details element */}
      <details className="mt-3">
        <summary className="cursor-pointer text-[10px] font-medium text-slate-600 hover:text-slate-400 transition-colors select-none">
          Technische Details anzeigen
        </summary>
        <pre className="mt-2 max-h-24 overflow-auto rounded border border-white/[0.06] bg-black/30 px-3 py-2 text-[10px] leading-relaxed text-slate-500 whitespace-pre-wrap">
          {errorMessage}
        </pre>
      </details>
    </div>
  )
}
