'use client'

interface Props {
  createdAt: string
  startedAt?: string
  completedAt?: string
  status: string
}

function fmtMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${(ms / 3_600_000).toFixed(1)}h`
}

export function DurationBar({ createdAt, startedAt, completedAt, status }: Props) {
  const isTerminal = status === 'completed' || status === 'failed' || status === 'cancelled'
  const isRunning = status === 'running'

  if (!isTerminal && !isRunning) return null
  if (!startedAt) return null

  const created = new Date(createdAt).getTime()
  const started = new Date(startedAt).getTime()
  const ended = completedAt ? new Date(completedAt).getTime() : Date.now()

  const queueMs = Math.max(0, started - created)
  const execMs = Math.max(0, ended - started)
  const totalMs = queueMs + execMs
  if (totalMs === 0) return null

  const queuePct = Math.round((queueMs / totalMs) * 100)
  const execPct = 100 - queuePct

  const execColor =
    status === 'completed' ? 'bg-emerald-500' :
    status === 'failed'    ? 'bg-red-500' :
    'bg-violet-500 animate-pulse'

  return (
    <div className="mt-4 pt-4 border-t border-gray-800">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">Zeitverlauf</span>
        <span className="text-[10px] text-gray-600 font-mono">{fmtMs(totalMs)} gesamt</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-800 w-full">
        {queuePct > 0 && (
          <div
            className="bg-gray-600 h-full transition-all"
            style={{ width: `${queuePct}%` }}
            title={`Wartezeit: ${fmtMs(queueMs)}`}
          />
        )}
        <div
          className={`${execColor} h-full transition-all`}
          style={{ width: `${execPct}%` }}
          title={`Ausführung: ${fmtMs(execMs)}`}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-600">
          {queuePct > 0 ? `⏳ Warten ${fmtMs(queueMs)}` : ''}
        </span>
        <span className="text-[10px] text-gray-600">
          ⚡ Ausführung {fmtMs(execMs)}
        </span>
      </div>
    </div>
  )
}
