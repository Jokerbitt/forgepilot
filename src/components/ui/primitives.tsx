import type { ReactNode } from 'react'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'privacy' | 'cost'

const toneClasses: Record<Tone, string> = {
  neutral: 'border-white/[0.08] bg-white/[0.04] text-slate-300',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  danger: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
  info: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
  privacy: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
  cost: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300',
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export function buttonClassName(
  variant: 'primary' | 'secondary' | 'ghost' | 'destructive' = 'secondary',
  className?: string
): string {
  const variants = {
    primary: 'border-violet-500/80 bg-gradient-to-b from-violet-500 to-violet-600 text-white shadow-sm shadow-violet-500/20 hover:from-violet-400 hover:to-violet-500',
    secondary: 'border-white/[0.1] bg-white/[0.06] text-slate-100 hover:bg-white/[0.1] hover:border-white/[0.15] hover:text-white',
    ghost: 'border-transparent bg-transparent text-slate-400 hover:bg-white/[0.06] hover:text-white',
    destructive: 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200',
  }

  return cx(
    'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-[#0a0a0f] disabled:cursor-not-allowed disabled:opacity-40',
    variants[variant],
    className
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold', toneClasses[tone], className)}>
      {children}
    </span>
  )
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cx('rounded-xl border border-white/[0.07] bg-white/[0.03] shadow-sm shadow-black/20', className)}>
      {children}
    </section>
  )
}

export function Metric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  detail?: string
  tone?: Tone
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.05]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
        <StatusDot tone={tone} />
      </div>
      <p className="mt-2.5 text-2xl font-bold tracking-tight text-white">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  )
}

export function StatusDot({ tone = 'neutral', pulse }: { tone?: Tone; pulse?: boolean }) {
  const dotClasses: Record<Tone, string> = {
    neutral: 'bg-slate-500',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-violet-400',
    privacy: 'bg-violet-400',
    cost: 'bg-cyan-400',
  }

  if (pulse && tone === 'success') {
    return (
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
      </span>
    )
  }

  return <span className={cx('h-2.5 w-2.5 rounded-full', dotClasses[tone])} aria-hidden="true" />
}

export function Toolbar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex flex-col gap-3 border-b border-white/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      {children}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-500" aria-hidden="true">
        {icon ?? <span className="h-5 w-5 rounded-sm bg-slate-700" />}
      </div>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function RiskIndicator({
  level,
  label,
}: {
  level: 'low' | 'medium' | 'high' | 'critical'
  label?: string
}) {
  const toneByLevel = {
    low: 'success',
    medium: 'warning',
    high: 'danger',
    critical: 'danger',
  } satisfies Record<typeof level, Tone>

  return <Badge tone={toneByLevel[level]}>{label ?? level}</Badge>
}

export function DecisionCallout({
  label,
  title,
  description,
  action,
  tone = 'info',
}: {
  label: string
  title: string
  description: string
  action?: ReactNode
  tone?: Tone
}) {
  return (
    <div className={cx('rounded-lg border p-4', toneClasses[tone])}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <h2 className="mt-1 text-base font-semibold text-white">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
