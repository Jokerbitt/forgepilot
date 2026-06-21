// DataTable.tsx — Generic, typed, sortable table with empty state and zebra rows.
// Destination: src/components/dashboard/DataTable.tsx
'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface Column<T> {
  /** Key into the row object; also used as the React key. */
  key: keyof T;
  header: ReactNode;
  /** Custom cell renderer. Falls back to String(row[key]). */
  render?: (row: T) => ReactNode;
  /** Enable click-to-sort on this column. Defaults to true. */
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  /** Stable row identity. Defaults to array index. */
  rowKey?: (row: T, index: number) => string | number;
  emptyState?: ReactNode;
  className?: string;
}

type SortDirection = 'asc' | 'desc';

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyState = 'No data to display.',
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const sortedRows = useMemo(() => {
    if (sortKey === null) return rows;
    const sorted = [...rows].sort((a, b) =>
      compareValues(a[sortKey], b[sortKey]),
    );
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: keyof T): void {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400',
          className,
        )}
      >
        {emptyState}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800',
        className,
      )}
    >
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr>
            {columns.map((column) => {
              const isSortable = column.sortable !== false;
              const isActive = sortKey === column.key;
              return (
                <th
                  key={String(column.key)}
                  scope="col"
                  aria-sort={
                    isActive
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400',
                    column.className,
                  )}
                >
                  {isSortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="inline-flex items-center gap-1 transition hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:hover:text-white"
                    >
                      {column.header}
                      <span aria-hidden="true" className="text-[0.65rem]">
                        {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
          {sortedRows.map((row, index) => (
            <tr
              key={rowKey ? rowKey(row, index) : index}
              className="even:bg-zinc-50/60 dark:even:bg-zinc-800/30"
            >
              {columns.map((column) => (
                <td
                  key={String(column.key)}
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300',
                    column.className,
                  )}
                >
                  {column.render
                    ? column.render(row)
                    : String(row[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
