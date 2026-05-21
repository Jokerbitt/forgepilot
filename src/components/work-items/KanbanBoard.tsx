'use client'

import { useState, useRef } from 'react'
import type { WorkItem, WorkItemStatus } from '@/lib/models/work-item'

// ─── Column configuration ────────────────────────────────────────────────────

type KanbanColumn = {
  id: string
  label: string
  statuses: WorkItemStatus[]
  accent: string
  headerBg: string
  badgeBg: string
}

const COLUMNS: KanbanColumn[] = [
  {
    id: 'todo',
    label: 'Todo',
    statuses: ['backlog', 'todo'],
    accent: 'border-slate-600',
    headerBg: 'bg-slate-800/60',
    badgeBg: 'bg-slate-700 text-slate-300',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    statuses: ['in-progress', 'in-review'],
    accent: 'border-amber-700/60',
    headerBg: 'bg-amber-900/20',
    badgeBg: 'bg-amber-900/40 text-amber-300',
  },
  {
    id: 'done',
    label: 'Done',
    statuses: ['done', 'cancelled'],
    accent: 'border-emerald-800/50',
    headerBg: 'bg-emerald-900/20',
    badgeBg: 'bg-emerald-900/30 text-emerald-400',
  },
]

const COLUMN_DROP_STATUS: Record<string, WorkItemStatus> = {
  todo: 'todo',
  in_progress: 'in-progress',
  done: 'done',
}

const PRIORITY_DOT: Record<number, string> = {
  0: 'bg-red-500',
  1: 'bg-amber-400',
  2: 'bg-sky-400',
  3: 'bg-slate-500',
  4: 'bg-slate-700',
}

const PRIORITY_LABEL: Record<number, string> = {
  0: 'Urgent', 1: 'Hoch', 2: 'Mittel', 3: 'Niedrig', 4: '—',
}

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  item: WorkItem
  onDragStart: (item: WorkItem) => void
}

function KanbanCard({ item, onDragStart }: CardProps) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(item)}
      className="group rounded-lg border border-white/[0.07] bg-gray-900 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-white/[0.14] transition-colors"
    >
      <p className="text-sm text-gray-100 leading-snug mb-2 line-clamp-3">
        {item.title}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={['w-2 h-2 rounded-full shrink-0', PRIORITY_DOT[item.priority]].join(' ')}
          title={PRIORITY_LABEL[item.priority]}
        />
        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
          {item.source}
        </span>
        {item.risk && item.risk !== 'A' && (
          <span
            className={[
              'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
              item.risk === 'C'
                ? 'bg-red-900/30 text-red-400 border-red-800/40'
                : 'bg-amber-900/30 text-amber-400 border-amber-800/40',
            ].join(' ')}
          >
            {item.risk}
          </span>
        )}
        {item.blocked && (
          <span className="text-[10px] font-semibold text-red-400" title="Blockiert">⛔</span>
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="ml-auto text-[10px] text-gray-600 hover:text-gray-400 transition-colors shrink-0"
          >
            ↗
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Column ──────────────────────────────────────────────────────────────────

interface ColumnProps {
  col: KanbanColumn
  items: WorkItem[]
  dragOverCol: string | null
  onDragOver: (colId: string) => void
  onDrop: (colId: string) => void
  onDragStart: (item: WorkItem) => void
}

function KanbanColumnView({ col, items, dragOverCol, onDragOver, onDrop, onDragStart }: ColumnProps) {
  const isDragOver = dragOverCol === col.id

  return (
    <div
      className={[
        'flex flex-col rounded-xl border-2 transition-colors min-h-[300px]',
        isDragOver ? 'border-blue-500/60 bg-blue-950/20' : col.accent + ' bg-gray-900/30',
      ].join(' ')}
      onDragOver={e => { e.preventDefault(); onDragOver(col.id) }}
      onDragLeave={() => onDragOver('')}
      onDrop={e => { e.preventDefault(); onDrop(col.id) }}
    >
      <div className={['px-4 py-3 rounded-t-xl border-b border-white/[0.06]', col.headerBg].join(' ')}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-200">{col.label}</span>
          <span className={['text-xs font-bold px-2 py-0.5 rounded-full', col.badgeBg].join(' ')}>
            {items.length}
          </span>
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {col.statuses.join(' · ')}
        </p>
      </div>
      <div className="flex-1 p-3 space-y-2">
        {items.length === 0 && (
          <div className={[
            'flex items-center justify-center rounded-lg border-2 border-dashed py-8 text-xs text-gray-600 transition-colors',
            isDragOver ? 'border-blue-500/40 text-blue-400' : 'border-gray-800',
          ].join(' ')}>
            {isDragOver ? 'Hier ablegen' : 'Keine Items'}
          </div>
        )}
        {items.map(item => (
          <KanbanCard key={item.id} item={item} onDragStart={onDragStart} />
        ))}
        {items.length > 0 && isDragOver && (
          <div className="h-12 rounded-lg border-2 border-dashed border-blue-500/40 bg-blue-950/10 flex items-center justify-center text-xs text-blue-400">
            Hier ablegen
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Board ───────────────────────────────────────────────────────────────────

interface KanbanBoardProps {
  items: WorkItem[]
  onStatusChange: (itemId: string, newStatus: WorkItemStatus) => void
}

export function KanbanBoard({ items, onStatusChange }: KanbanBoardProps) {
  const [dragItem, setDragItem] = useState<WorkItem | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string>('')
  const dragItemRef = useRef<WorkItem | null>(null)

  const getColumnItems = (col: KanbanColumn) =>
    items.filter(i => col.statuses.includes(i.status))

  const handleDragStart = (item: WorkItem) => {
    setDragItem(item)
    dragItemRef.current = item
  }

  const handleDrop = (colId: string) => {
    const item = dragItemRef.current
    if (!item) return
    const targetStatus = COLUMN_DROP_STATUS[colId]
    if (!targetStatus) return
    const targetCol = COLUMNS.find(c => c.id === colId)
    if (targetCol?.statuses.includes(item.status)) {
      setDragItem(null)
      setDragOverCol('')
      dragItemRef.current = null
      return
    }
    onStatusChange(item.id, targetStatus)
    setDragItem(null)
    setDragOverCol('')
    dragItemRef.current = null
  }

  return (
    <div>
      {dragItem && (
        <div className="mb-3 text-xs text-blue-400 text-center animate-pulse">
          &quot;{dragItem.title.slice(0, 50)}{dragItem.title.length > 50 ? '…' : ''}&quot; — in Spalte ablegen
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <KanbanColumnView
            key={col.id}
            col={col}
            items={getColumnItems(col)}
            dragOverCol={dragOverCol}
            onDragOver={setDragOverCol}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
          />
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4 text-[10px] text-gray-600">
        {([0, 1, 2, 3, 4] as const).map(p => (
          <span key={p} className="flex items-center gap-1">
            <span className={['w-2 h-2 rounded-full', PRIORITY_DOT[p]].join(' ')} />
            {PRIORITY_LABEL[p]}
          </span>
        ))}
        <span className="ml-auto">Drag &amp; Drop zum Verschieben</span>
      </div>
    </div>
  )
}
