// StatCard.tsx — KPI stat card with label, value, optional delta and icon.
// Destination: src/components/dashboard/StatCard.tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface StatCardProps {
  label: string;
  value: string | number;
  /** Signed percentage/number change, e.g. 12.5 or -3. Positive renders green, negative red. */
  delta?: number;
  /** Optional unit suffix appended to the delta, defaults to '%'. */
  deltaUnit?: string;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  deltaUnit = '%',
  icon,
  className,
}: StatCardProps) {
  const hasDelta = typeof delta === 'number' && !Number.isNaN(delta);
  const isPositive = hasDelta && delta >= 0;

  return (
    <div
      className={cn(
        'rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        {icon ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {icon}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          {value}
        </p>
        {hasDelta ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold',
              isPositive
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
            )}
          >
            <span aria-hidden="true">{isPositive ? '↑' : '↓'}</span>
            {isPositive ? '+' : ''}
            {delta}
            {deltaUnit}
          </span>
        ) : null}
      </div>
    </div>
  );
}
