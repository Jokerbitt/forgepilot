'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { cx } from '@/components/ui/primitives'
import type { AgentProfile, AgentSkill, SkillCategory } from '@/lib/agents/agent-skills'

// ─── Category meta ───────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<SkillCategory, string> = {
  'api-route':       'API Routes',
  'ui-component':    'UI Components',
  'data-model':      'Data Models',
  'test':            'Tests',
  'refactor':        'Refactoring',
  'infrastructure':  'Infrastructure',
  'documentation':   'Documentation',
}

const CATEGORY_COLOR: Record<SkillCategory, string> = {
  'api-route':       'bg-violet-900/30 text-violet-400 border-violet-800/40',
  'ui-component':    'bg-sky-900/30 text-sky-400 border-sky-800/40',
  'data-model':      'bg-amber-900/30 text-amber-400 border-amber-800/40',
  'test':            'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
  'refactor':        'bg-orange-900/30 text-orange-400 border-orange-800/40',
  'infrastructure':  'bg-rose-900/30 text-rose-400 border-rose-800/40',
  'documentation':   'bg-slate-700/60 text-slate-300 border-slate-700',
}

const AGENT_COLOR: Record<string, string> = {
  'claude-code':  'bg-violet-900/40 text-violet-300 border-violet-700/60',
  'codex':        'bg-sky-900/40 text-sky-300 border-sky-700/60',
  'antigravity':  'bg-pink-900/40 text-pink-300 border-pink-700/60',
  'hermes':       'bg-emerald-900/40 text-emerald-300 border-emerald-700/60',
  'openclaw':     'bg-amber-900/40 text-amber-300 border-amber-700/60',
  'general':      'bg-slate-700/60 text-slate-300 border-slate-600',
}

function confidenceBar(pct: number) {
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-slate-800">
        <div className={cx('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500">{pct}%</span>
    </div>
  )
}

// ─── Skill Card ───────────────────────────────────────────────────────────────

function SkillCard({ skill }: { skill: AgentSkill }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-colors hover:border-slate-700 hover:bg-slate-900">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-semibold text-white text-sm">{skill.name}</p>
        <span className={cx('shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium', CATEGORY_COLOR[skill.category])}>
          {CATEGORY_LABEL[skill.category]}
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-400 leading-relaxed">{skill.description}</p>
      <div className="mb-3">{confidenceBar(skill.confidence)}</div>
      <div className="flex flex-wrap gap-1">
        {skill.filePatterns.slice(0, 3).map(p => (
          <code key={p} className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400 font-mono">
            {p}
          </code>
        ))}
        {skill.filePatterns.length > 3 && (
          <span className="text-xs text-slate-600">+{skill.filePatterns.length - 3}</span>
        )}
      </div>
    </div>
  )
}

// ─── Agent Section ────────────────────────────────────────────────────────────

function AgentSection({ profile }: { profile: AgentProfile }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
      <button
        className="mb-4 flex w-full items-center justify-between"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <span className={cx('rounded-lg border px-2.5 py-1 text-xs font-bold font-mono', AGENT_COLOR[profile.type])}>
            {profile.type}
          </span>
          <span className="text-base font-semibold text-white">{profile.displayName}</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
            {profile.skills.length} skills
          </span>
        </div>
        <span className="text-slate-500 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <>
          {/* Strengths / Weaknesses */}
          <div className="mb-4 flex flex-wrap gap-4 text-xs">
            <div>
              <span className="text-slate-500 uppercase tracking-wide text-[10px]">Strengths</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {profile.strengths.map(s => (
                  <span key={s} className="rounded border border-emerald-800/40 bg-emerald-900/20 px-2 py-0.5 text-emerald-400">
                    {CATEGORY_LABEL[s]}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wide text-[10px]">Weaknesses</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {profile.weaknesses.map(w => (
                  <span key={w} className="rounded border border-red-800/40 bg-red-900/20 px-2 py-0.5 text-red-400">
                    {CATEGORY_LABEL[w]}
                  </span>
                ))}
              </div>
            </div>
            <div className="ml-auto">
              <span className="text-slate-500 uppercase tracking-wide text-[10px]">Max concurrent files</span>
              <p className="mt-1 font-mono text-white">{profile.maxConcurrentFiles}</p>
            </div>
          </div>

          {/* Skills grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profile.skills.map(skill => (
              <SkillCard key={skill.id} skill={skill} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AgentSkillLibraryPage() {
  const [profiles, setProfiles] = useState<Record<string, AgentProfile> | null>(null)
  const [filter, setFilter] = useState<SkillCategory | ''>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/agents/skills')
      .then(r => r.json())
      .then((d: { profiles: Record<string, AgentProfile> }) => setProfiles(d.profiles))
      .catch(() => setProfiles({}))
      .finally(() => setLoading(false))
  }, [])

  const categories: SkillCategory[] = [
    'api-route', 'ui-component', 'data-model', 'test', 'refactor', 'infrastructure', 'documentation',
  ]

  const filteredProfiles: AgentProfile[] = profiles
    ? Object.values(profiles)
        .map(profile => ({
          ...profile,
          skills: filter ? profile.skills.filter(s => s.category === filter) : profile.skills,
        }))
        .filter(p => p.skills.length > 0)
    : []

  return (
    <main className="min-h-screen bg-slate-950 pb-16">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
            <Link href="/agents" className="hover:text-slate-300">Agents</Link>
            <span>/</span>
            <span>Skill Library</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Agent Skill Library</h1>
          <p className="mt-1 text-sm text-slate-400">
            All registered agent types, their capabilities, and confidence scores.
          </p>
        </div>

        {/* Category filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('')}
            className={cx(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              filter === '' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            All skills
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat === filter ? '' : cat)}
              className={cx(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                filter === cat
                  ? CATEGORY_COLOR[cat]
                  : 'border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
              )}
            >
              {CATEGORY_LABEL[cat]}
            </button>
          ))}
        </div>

        {/* Agent sections */}
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading skill library…</div>
        ) : (
          <div className="flex flex-col gap-5">
            {filteredProfiles.map(profile => (
              <AgentSection key={profile.type} profile={profile} />
            ))}
            {filteredProfiles.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 py-12 text-center text-sm text-slate-500">
                No skills found for selected category.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
