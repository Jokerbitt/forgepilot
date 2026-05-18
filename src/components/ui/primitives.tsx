import type { ReactNode } from 'react'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'privacy' | 'cost'

const toneClasses: Record<Tone, string> = {
  neutral: 'border-slate-700 bg-slate-900/80 text-slate-300',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  danger: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  privacy: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  cost: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export function buttonClassName(
  variant: 'primary' | 'secondary' | 'ghost' | 'destructive' = 'secondary',
  className?: string
): string {
  const variants = {
    primary: 'border-sky-500 bg-sky-500 text-slate-950 hover:bg-sky-400 hover:border-sky-400',
    secondary: 'border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500 hover:bg-slate-800',
    ghost: 'border-transparent bg-transparent text-slate-300 hover:bg-slate-900 hover:text-white',
    destructive: 'border-rose-500/50 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20',
  }

  return cx(
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3.5 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400/70 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50',
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
    <section className={cx('rounded-lg border border-slate-800 bg-slate-950/70 shadow-sm shadow-black/10', className)}>
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
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <StatusDot tone={tone} />
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  )
}

export function StatusDot({ tone = 'neutral' }: { tone?: Tone }) {
  const dotClasses: Record<Tone, string> = {
    neutral: 'bg-slate-500',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-sky-400',
    privacy: 'bg-violet-400',
    cost: 'bg-cyan-400',
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
    <div className={cx('flex flex-col gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      {children}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950/60 px-6 py-12 text-center">
      <div className="mb-4 h-10 w-10 rounded-md border border-slate-700 bg-slate-900" aria-hidden="true" />
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
