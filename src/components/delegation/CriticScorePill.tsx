import type { CriticScore } from '@/lib/models/delegation'

/** Average score: (correctness + efficiency + (100 - drift)) / 3, rounded */
export function calcAvgScore(correctness: number, efficiency: number, drift: number): number {
  return Math.round((correctness + efficiency + (100 - drift)) / 3)
}

interface CriticScorePillProps {
  verdict: CriticScore['verdict']
  correctness: number
  efficiency: number
  drift: number
}

const VERDICT_CONFIG = {
  approved: {
    icon: '✓',
    textClass: 'text-green-400',
    borderClass: 'border-green-500/30',
    bgClass: 'bg-green-950/30',
    dotClass: 'bg-green-400',
  },
  'needs-revision': {
    icon: '~',
    textClass: 'text-yellow-400',
    borderClass: 'border-yellow-500/30',
    bgClass: 'bg-yellow-950/30',
    dotClass: 'bg-yellow-400',
  },
  rejected: {
    icon: '✗',
    textClass: 'text-red-400',
    borderClass: 'border-red-500/30',
    bgClass: 'bg-red-950/30',
    dotClass: 'bg-red-400',
  },
} as const

/**
 * Compact inline pill showing verdict + average score.
 * Average = (correctness + efficiency + (100 - drift)) / 3
 */
export function CriticScorePill({ verdict, correctness, efficiency, drift }: CriticScorePillProps) {
  const cfg = VERDICT_CONFIG[verdict]
  const avg = calcAvgScore(correctness, efficiency, drift)

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded border ${cfg.textClass} ${cfg.borderClass} ${cfg.bgClass}`}
      title={`Critic Score — Korrektheit: ${correctness}, Effizienz: ${efficiency}, Drift: ${drift}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`} />
      <span>{cfg.icon}</span>
      <span className="font-mono font-bold">{avg}</span>
    </span>
  )
}
