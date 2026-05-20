'use client'

/**
 * /settings/deployment — M130
 *
 * Vercel deployment readiness page:
 * - Connection status (env vars present = likely connected)
 * - Env-var checklist (required vs optional)
 * - One-click deploy button (opens Vercel Deploy page)
 * - vercel.json preview snippet
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  ChevronLeft,
  Circle,
  ExternalLink,
  Info,
  XCircle,
} from 'lucide-react'
import { Panel } from '@/components/ui/primitives'

interface EnvStatus {
  key: string
  label: string
  required: boolean
  present: boolean
  hint?: string
}

const ENV_VARS: Omit<EnvStatus, 'present'>[] = [
  // Required
  { key: 'ANTHROPIC_API_KEY',      label: 'Anthropic API Key',      required: true,  hint: 'AI generation backbone' },
  { key: 'OPENAI_API_KEY',         label: 'OpenAI API Key',         required: false, hint: 'Optional — for GPT-4o / embeddings' },
  { key: 'GROQ_API_KEY',           label: 'Groq API Key',           required: false, hint: 'Optional free-tier fast inference' },
  { key: 'LINEAR_API_KEY',         label: 'Linear API Key',         required: true,  hint: 'Ticket intake via n8n' },
  { key: 'LINEAR_WEBHOOK_SECRET',  label: 'Linear Webhook Secret',  required: false, hint: 'Validates incoming Linear webhooks' },
  { key: 'SENTRY_DSN',             label: 'Sentry DSN',             required: false, hint: 'Error monitoring in production' },
  { key: 'SENTRY_AUTH_TOKEN',      label: 'Sentry Auth Token',      required: false, hint: 'Source map upload at build time' },
  { key: 'TELEGRAM_BOT_TOKEN',     label: 'Telegram Bot Token',     required: false, hint: 'Sentry → Telegram alerts' },
  { key: 'TELEGRAM_CHAT_ID',       label: 'Telegram Chat ID',       required: false, hint: 'Sentry → Telegram alerts' },
  { key: 'CRON_SECRET',            label: 'Cron Secret',            required: false, hint: 'Protects /api/cron/* endpoints' },
  { key: 'SUPABASE_URL',           label: 'Supabase URL',           required: false, hint: 'Optional — pgvector + realtime' },
  { key: 'SUPABASE_ANON_KEY',      label: 'Supabase Anon Key',      required: false, hint: 'Optional — Supabase client auth' },
  { key: 'N8N_WEBHOOK_URL',        label: 'n8n Webhook URL',        required: false, hint: 'n8n automation endpoint' },
]

const VERCEL_JSON_SNIPPET = `{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "crons": [
    { "path": "/api/cron/retention", "schedule": "0 2 * * *" }
  ]
}`

export default function DeploymentSettingsPage() {
  const [envStatus, setEnvStatus] = useState<EnvStatus[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    fetch('/api/settings/env')
      .then(r => r.json())
      .then((data: Record<string, boolean>) => {
        setEnvStatus(
          ENV_VARS.map(v => ({ ...v, present: !!data[v.key] }))
        )
      })
      .catch(() => {
        // Fall back to all unknown
        setEnvStatus(ENV_VARS.map(v => ({ ...v, present: false })))
      })
      .finally(() => setLoading(false))
  }, [])

  const requiredMissing  = envStatus.filter(v => v.required && !v.present)
  const requiredPresent  = envStatus.filter(v => v.required && v.present)
  const optionalPresent  = envStatus.filter(v => !v.required && v.present)
  const deployReady      = requiredMissing.length === 0

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-gray-500 hover:text-gray-300 transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-white">Deployment</h1>
            <p className="text-xs text-gray-500 mt-0.5">Vercel deployment readiness &amp; env-var checklist</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">

        {/* Deploy readiness banner */}
        <Panel className={`flex items-start gap-4 ${deployReady ? 'border-green-700/50 bg-green-900/10' : 'border-yellow-700/50 bg-yellow-900/10'}`}>
          {deployReady
            ? <CheckCircle2 className="h-6 w-6 text-green-400 mt-0.5 shrink-0" />
            : <Info className="h-6 w-6 text-yellow-400 mt-0.5 shrink-0" />
          }
          <div>
            <p className={`font-semibold ${deployReady ? 'text-green-300' : 'text-yellow-300'}`}>
              {deployReady
                ? 'Ready to deploy — all required env vars are set'
                : `${requiredMissing.length} required env var${requiredMissing.length === 1 ? '' : 's'} missing`}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {deployReady
                ? 'Push to main or create a Vercel project to deploy.'
                : `Missing: ${requiredMissing.map(v => v.key).join(', ')}`}
            </p>
          </div>
        </Panel>

        {/* One-click deploy */}
        <Panel>
          <h2 className="text-sm font-semibold text-white mb-3">One-Click Deploy</h2>
          <p className="text-xs text-gray-400 mb-4">
            Deploy ForgePilot to Vercel with one click. You{"'"}ll be prompted to connect your GitHub repository
            and set environment variables in the Vercel dashboard.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://vercel.com/new/clone?repository-url=https://github.com/Jokerbitt/forgepilot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-100 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-black" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 19.5h20L12 2z" />
              </svg>
              Deploy to Vercel
            </a>
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Vercel Dashboard
            </a>
          </div>
        </Panel>

        {/* Env var checklist */}
        <Panel>
          <h2 className="text-sm font-semibold text-white mb-1">Environment Variables</h2>
          <p className="text-xs text-gray-500 mb-4">
            Status is determined by whether the variable is set in this running instance.
            Set these in Vercel → Project → Settings → Environment Variables for production.
          </p>

          {loading ? (
            <p className="text-xs text-gray-500 animate-pulse">Checking environment…</p>
          ) : (
            <div className="space-y-1.5">
              {/* Required */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Required</p>
              {envStatus.filter(v => v.required).map(v => (
                <EnvRow key={v.key} env={v} />
              ))}

              {/* Optional */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-2">Optional</p>
              {envStatus.filter(v => !v.required).map(v => (
                <EnvRow key={v.key} env={v} />
              ))}
            </div>
          )}

          {/* Summary stats */}
          {!loading && (
            <div className="mt-4 pt-4 border-t border-gray-800 flex gap-6 text-xs text-gray-500">
              <span><span className="text-green-400 font-semibold">{requiredPresent.length}</span> / {envStatus.filter(v => v.required).length} required set</span>
              <span><span className="text-blue-400 font-semibold">{optionalPresent.length}</span> / {envStatus.filter(v => !v.required).length} optional set</span>
            </div>
          )}
        </Panel>

        {/* vercel.json preview */}
        <Panel>
          <h2 className="text-sm font-semibold text-white mb-1">vercel.json</h2>
          <p className="text-xs text-gray-500 mb-3">
            Drop this into your project root to configure cron jobs and build settings.
          </p>
          <pre className="rounded-md bg-gray-950 border border-gray-800 p-4 text-xs font-mono text-gray-300 overflow-x-auto">
            {VERCEL_JSON_SNIPPET}
          </pre>
        </Panel>

        {/* Back link */}
        <div className="pt-2">
          <Link href="/settings" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            ← Back to Settings
          </Link>
        </div>
      </div>
    </div>
  )
}

function EnvRow({ env }: { env: EnvStatus }) {
  return (
    <div className="flex items-start gap-3 rounded-lg px-3 py-2 bg-gray-900/50 border border-gray-800/50">
      {env.present
        ? <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
        : env.required
          ? <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          : <Circle className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
      }
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-medium text-gray-200">{env.key}</span>
          {env.required && (
            <span className="text-xs text-red-400/70">required</span>
          )}
        </div>
        {env.hint && (
          <span className="text-xs text-gray-500">{env.hint}</span>
        )}
      </div>
      <span className={`text-xs font-medium mt-0.5 shrink-0 ${env.present ? 'text-green-500' : 'text-gray-600'}`}>
        {env.present ? 'set' : 'not set'}
      </span>
    </div>
  )
}
