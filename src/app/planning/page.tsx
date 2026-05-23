'use client'

import { useEffect, useState } from 'react'
import type { PlanningAuditRecord, PlanningAuditStats } from '@/lib/planning/planning-audit-store'

interface AuditResponse {
  ok: boolean
  records: PlanningAuditRecord[]
  stats: PlanningAuditStats
}

interface PromptResponse {
  prompt: string
  modes: string[]
  confirmationHeader: string
  confirmationValue: string
}

function outcomeBadge(outcome: PlanningAuditRecord['outcome']): string {
  if (outcome === 'success') return 'bg-green-900/50 text-green-400'
  if (outcome === 'partial') return 'bg-yellow-900/50 text-yellow-400'
  return 'bg-gray-800 text-gray-400'
}

function modeBadge(mode: string): string {
  if (mode === 'create-all') return 'bg-blue-900/50 text-blue-400'
  if (mode === 'create-linear') return 'bg-purple-900/50 text-purple-400'
  if (mode === 'create-github') return 'bg-gray-700 text-gray-300'
  return 'bg-gray-800 text-gray-500'
}

export default function PlanningPage() {
  const [records, setRecords] = useState<PlanningAuditRecord[]>([])
  const [stats, setStats] = useState<PlanningAuditStats | null>(null)
  const [prompt, setPrompt] = useState<string | null>(null)
  const [promptCopied, setPromptCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [auditRes, promptRes] = await Promise.all([
          fetch('/api/planning/grok/audit'),
          fetch('/api/planning/grok'),
        ])
        const audit = await auditRes.json() as AuditResponse
        const promptData = await promptRes.json() as PromptResponse
        if (audit.ok) {
          setRecords(audit.records)
          setStats(audit.stats)
        }
        setPrompt(promptData.prompt)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load planning data')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  function copyPrompt() {
    if (!prompt) return
    void navigator.clipboard.writeText(prompt).then(() => {
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Planning Audit</h1>
          <p className="text-gray-400 text-sm mt-1">
            Grok planning gateway — action plan sessions, audit trail, and issue creation log
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-xs text-gray-500 mt-1">Total Sessions</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-400">{stats.last24h}</div>
              <div className="text-xs text-gray-500 mt-1">Last 24h</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">
                {stats.byOutcome['success'] ?? 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">Successful</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-400">
                {stats.byMode['preview'] ?? 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">Previews</div>
            </div>
          </div>
        )}

        {/* Grok Prompt */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div>
              <h2 className="text-sm font-semibold text-white">Grok Planning Prompt</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Copy this into Grok with your planning context. Paste the JSON response here.
              </p>
            </div>
            <button
              onClick={copyPrompt}
              disabled={!prompt}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors"
            >
              {promptCopied ? 'Copied!' : 'Copy Prompt'}
            </button>
          </div>
          {prompt ? (
            <pre className="px-5 py-4 text-xs text-gray-300 font-mono whitespace-pre-wrap overflow-auto max-h-48 leading-relaxed">
              {prompt}
            </pre>
          ) : (
            <div className="px-5 py-8 text-center text-gray-600 text-sm">
              {loading ? 'Loading prompt…' : 'Prompt unavailable'}
            </div>
          )}
        </div>

        {/* Session Log */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">
            Planning Sessions {records.length > 0 && <span className="text-gray-500 font-normal ml-1">({records.length})</span>}
          </h2>

          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-sm text-red-400 mb-4">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-center py-12 text-gray-600 text-sm">Loading sessions…</div>
          )}

          {!loading && records.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <p className="text-gray-500 text-sm">No planning sessions yet.</p>
              <p className="text-gray-600 text-xs mt-1">
                Use the prompt above with Grok, then POST the response to{' '}
                <code className="text-gray-400">/api/planning/grok?mode=preview</code>
              </p>
            </div>
          )}

          {records.length > 0 && (
            <div className="space-y-2">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpanded(expanded === record.id ? null : record.id)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono shrink-0 ${modeBadge(record.mode)}`}>
                        {record.mode}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-mono shrink-0 ${outcomeBadge(record.outcome)}`}>
                        {record.outcome}
                      </span>
                      <span className="text-gray-300 text-sm truncate">
                        {record.summary.milestones} milestone{record.summary.milestones !== 1 ? 's' : ''},{' '}
                        {record.summary.items} issue{record.summary.items !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      <span className="text-xs text-gray-500">
                        {new Date(record.recordedAt).toLocaleString('de-DE', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      <span className="text-gray-600 text-xs">
                        {expanded === record.id ? '▲' : '▼'}
                      </span>
                    </div>
                  </button>

                  {expanded === record.id && (
                    <div className="border-t border-gray-800 px-5 py-4 space-y-4">
                      {/* Counts */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-green-400">{record.createdCount}</div>
                          <div className="text-xs text-gray-500">Created</div>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-yellow-400">{record.skippedCount}</div>
                          <div className="text-xs text-gray-500">Skipped</div>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-gray-300">{record.itemCount}</div>
                          <div className="text-xs text-gray-500">Total Items</div>
                        </div>
                      </div>

                      {/* Created links */}
                      {record.created.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-2">Created Issues</p>
                          <ul className="space-y-1">
                            {record.created.map((item, i) => (
                              <li key={i} className="flex items-center gap-2 text-xs text-gray-300">
                                <span className="text-gray-600 font-mono">{item.target}</span>
                                {item.url ? (
                                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                                    className="text-blue-400 hover:underline truncate">
                                    {item.title}
                                  </a>
                                ) : (
                                  <span className="truncate">{item.title}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Warnings */}
                      {record.warnings.length > 0 && (
                        <div className="bg-yellow-900/10 border border-yellow-800/30 rounded-lg p-3">
                          <p className="text-xs font-medium text-yellow-400 mb-1">Warnings</p>
                          <ul className="space-y-0.5">
                            {record.warnings.map((w, i) => (
                              <li key={i} className="text-xs text-yellow-300/70">{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Priority breakdown */}
                      {Object.keys(record.summary.priorityCounts).length > 0 && (
                        <div className="flex gap-3">
                          {Object.entries(record.summary.priorityCounts)
                            .filter(([, count]) => count > 0)
                            .map(([prio, count]) => (
                              <span key={prio} className="text-xs text-gray-400">
                                <span className="font-mono text-white">{prio}</span> ×{count}
                              </span>
                            ))}
                        </div>
                      )}

                      {/* Audit ID */}
                      <p className="text-xs text-gray-700 font-mono">{record.id}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
