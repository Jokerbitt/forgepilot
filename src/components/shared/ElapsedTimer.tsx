'use client'

import { useEffect, useState } from 'react'

interface ElapsedTimerProps {
  startedAt: string
  className?: string
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function ElapsedTimer({ startedAt, className = '' }: ElapsedTimerProps) {
  const [elapsed, setElapsed] = useState(() => Date.now() - new Date(startedAt).getTime())

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - new Date(startedAt).getTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  return <span className={className}>{formatDuration(elapsed)}</span>
}

export function formatCompletedDuration(startedAt: string, completedAt: string): string {
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes === 0) return `<1 min`
  if (minutes === 1) return `1 min`
  return `${minutes} min`
}
