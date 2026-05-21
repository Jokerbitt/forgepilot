'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { HealthReport, HealthCheck } from '@/app/api/dev/health/route'

type StatusBadgeProps = { status: HealthCheck['status'] }

function StatusIcon({ status }: StatusBadgeProps) {
  if (status === 'ok') return <span className="text-green-500 font-bold text-lg">✓</span>
  if (status === 'warn') return <span className="text-yellow-500 font-bold text-lg">⚠</span>
  return <span className="text-red-500 font-bold text-lg">✗</span>
}

function OverallBanner({ overall, mode }: { overall: HealthReport['overall']; mode: string }) {
  const styles: Record<HealthReport['overall'], string> = {
    ok: 'bg-green-50 border-green-300 text-green-800',
    warn: 'bg-yellow-50 border-yellow-300 text-yellow-800',
    error: 'bg-red-50 border-red-300 text-red-800',
  }
  const labels: Record<HealthReport['overall'], string> = {
    ok: 'All systems operational',
    warn: 'Some checks need attention',
    error: 'Critical issues detected',
  }
  return (
    <div className={`rounded-lg border px-5 py-4 ${styles[overall]}`}>
      <div className="flex items-center gap-3">
        <StatusIcon status={overall} />
        <div>
          <p className="font-semibold">{labels[overall]}</p>
          <p className="text-sm opacity-80">Execution Mode: {mode}</p>
        </div>
      </div>
    </div>
  )
}

const N8N_PAYLOAD_EXAMPLE = JSON.stringify(
  {
    title: 'Test Delegation',
    description: 'Smoke test via n8n',
    autoDelegate: true,
    autoExecute: true,
  },
  null,
  2,
)

export default function HealthPage() {
  const [report, setReport] = useState<HealthReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dev/health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as HealthReport
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchHealth()
  }, [fetchHealth])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(N8N_PAYLOAD_EXAMPLE)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-sm text-gray-500 mt-1">ForgePilot Execute-Loop readiness check</p>
        </div>
        <button
          onClick={() => void fetchHealth()}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {/* Overall status */}
      {loading && !report && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 text-gray-500 text-sm animate-pulse">
          Running checks…
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-5 py-4 text-red-800 text-sm">
          Failed to load health data: {error}
        </div>
      )}
      {report && <OverallBanner overall={report.overall} mode={report.executionMode} />}

      {/* Check list */}
      {report && (
        <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
          {report.checks.map(check => (
            <div key={check.name} className="flex items-start gap-4 px-5 py-3 bg-white">
              <div className="mt-0.5 w-5 shrink-0 flex justify-center">
                <StatusIcon status={check.status} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{check.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{check.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* n8n Webhook Payload */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">n8n Webhook Payload</h2>
          <button
            onClick={() => void handleCopy()}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Send this to{' '}
          <code className="bg-gray-100 rounded px-1 py-0.5 text-xs font-mono">
            POST /api/intake
          </code>{' '}
          for a quick smoke test.
        </p>
        <pre className="bg-gray-900 text-green-300 text-xs rounded-lg p-4 overflow-x-auto font-mono leading-relaxed">
          {N8N_PAYLOAD_EXAMPLE}
        </pre>
      </div>

      {/* Timestamp + links */}
      <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
        <span>
          {report
            ? `Last checked: ${new Date(report.checkedAt).toLocaleTimeString()}`
            : loading
              ? 'Checking…'
              : '—'}
        </span>
        <Link href="/" className="text-blue-500 hover:underline">
          ← Command Center
        </Link>
      </div>
    </div>
  )
}
