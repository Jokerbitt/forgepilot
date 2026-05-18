import { computeAutopilotScore } from '@/lib/nba-engine/autopilot-score'
import type { TaskContract } from '@/lib/models/delegation'
import { cx } from '@/components/ui/primitives'

interface Props {
  contract: TaskContract
  showReasons?: boolean
}

const LEVEL_COLOR = {
  green: 'text-emerald-400 border-emerald-800/50 bg-emerald-900/20',
  amber: 'text-amber-400 border-amber-800/50 bg-amber-900/20',
  red:   'text-red-400 border-red-800/50 bg-red-900/20',
}

const BAR_COLOR = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-400',
  red:   'bg-red-500',
}

export function AutopilotReadinessBadge({ contract, showReasons = false }: Props) {
  const result = computeAutopilotScore(contract)

  return (
    <div className={cx('rounded-lg border px-3 py-2.5', LEVEL_COLOR[result.level])}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Autopilot Readiness</p>
          <p className="mt-0.5 text-sm font-bold">{result.label}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">{result.score}</p>
          <p className="text-xs opacity-60">/ 100</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/20">
        <div
          className={cx('h-full rounded-full transition-all', BAR_COLOR[result.level])}
          style={{ width: `${result.score}%` }}
        />
      </div>

      {/* Deduction reasons */}
      {showReasons && result.reasons.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {result.reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs opacity-80">
              <span className="mt-0.5 shrink-0">—</span>
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Compact inline badge for use in tables/lists */
export function AutopilotReadinessPill({ contract }: { contract: TaskContract }) {
  const result = computeAutopilotScore(contract)
  const pillColor = {
    green: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    amber: 'bg-amber-900/30 text-amber-400 border-amber-800/40',
    red:   'bg-red-900/30 text-red-400 border-red-800/40',
  }
  return (
    <span
      className={cx('rounded border px-1.5 py-0.5 text-xs font-bold tabular-nums', pillColor[result.level])}
      title={result.label}
    >
      {result.score}%
    </span>
  )
}
