'use client'

import { useEffect, useMemo, useState } from 'react'
import type { BriefScope, IdeaIntakeInput, ProjectBrief, ResearchMode, ResearchPrivacyMode } from '@/lib/models/project-brief'

type WizardStep = 0 | 1 | 2 | 3

const STEP_LABELS = ['Idee', 'Nutzen', 'Rahmen', 'Review']

const initialInput: IdeaIntakeInput = {
  title: '',
  rawIdea: '',
  problemStatement: '',
  targetAudience: '',
  desiredOutcome: '',
  constraints: [],
  scope: 'standard',
  researchMode: 'standard',
  privacyMode: 'local',
}

export function IdeaIntakeWizard() {
  const [step, setStep] = useState<WizardStep>(0)
  const [input, setInput] = useState<IdeaIntakeInput>(initialInput)
  const [constraintsText, setConstraintsText] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [briefs, setBriefs] = useState<ProjectBrief[]>([])
  const [loading, setLoading] = useState(false)
  const [createdBrief, setCreatedBrief] = useState<ProjectBrief | null>(null)

  useEffect(() => {
    fetch('/api/project-briefs')
      .then(res => res.ok ? res.json() : [])
      .then((data: ProjectBrief[]) => {
        if (Array.isArray(data)) setBriefs(data)
      })
      .catch(() => setBriefs([]))
  }, [])

  const completionScore = useMemo(() => {
    const fields = [
      input.title.trim(),
      input.rawIdea.trim(),
      input.problemStatement.trim(),
      input.targetAudience.trim(),
      input.desiredOutcome.trim(),
    ]
    const filled = fields.filter(Boolean).length + (constraintsText.trim() ? 1 : 0)
    return Math.round((filled / 6) * 100)
  }, [input, constraintsText])

  const updateField = <K extends keyof IdeaIntakeInput>(field: K, value: IdeaIntakeInput[K]) => {
    setInput(prev => ({ ...prev, [field]: value }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const validateStep = (targetStep = step): boolean => {
    const nextErrors: Record<string, string> = {}

    if (targetStep >= 0) {
      if (input.title.trim().length < 3) nextErrors.title = 'Bitte gib einen klaren Projektnamen ein.'
      if (input.rawIdea.trim().length < 20) nextErrors.rawIdea = 'Beschreibe die Idee etwas ausfuehrlicher.'
    }
    if (targetStep >= 1) {
      if (input.problemStatement.trim().length < 10) nextErrors.problemStatement = 'Welches Problem soll geloest werden?'
      if (input.targetAudience.trim().length < 3) nextErrors.targetAudience = 'Fuer wen ist das gedacht?'
      if (input.desiredOutcome.trim().length < 10) nextErrors.desiredOutcome = 'Beschreibe den gewuenschten Zielzustand.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const goNext = () => {
    if (!validateStep(step)) return
    setStep(prev => Math.min(prev + 1, 3) as WizardStep)
  }

  const handleSubmit = async () => {
    const constraints = constraintsText
      .split(/\r?\n|,/)
      .map(item => item.trim())
      .filter(Boolean)

    const payload: IdeaIntakeInput = { ...input, constraints }
    setInput(payload)

    if (!validateStep(3)) return

    setLoading(true)
    setCreatedBrief(null)
    try {
      const res = await fetch('/api/project-briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors(data.errors ?? { form: 'ProjectBrief konnte nicht erstellt werden.' })
        return
      }
      setCreatedBrief(data as ProjectBrief)
      setBriefs(prev => [data as ProjectBrief, ...prev])
      setInput(initialInput)
      setConstraintsText('')
      setStep(0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-5 shadow-xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Project Brief Studio</p>
            <h1 className="mt-1 text-2xl font-bold text-white">Idea Intake Wizard</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Aus einer losen Idee wird ein strukturierter ProjectBrief-Draft mit Research-Brief-Vorschlag.
            </p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 text-right">
            <div className="text-2xl font-bold text-white">{completionScore}%</div>
            <div className="text-xs text-gray-500">Ausgefuellt</div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-4 gap-2">
          {STEP_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index as WizardStep)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                step === index
                  ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                  : 'border-gray-800 bg-gray-950 text-gray-500 hover:border-gray-700 hover:text-gray-300'
              }`}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>

        {errors.form && (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {errors.form}
          </div>
        )}

        {step === 0 && (
          <div className="space-y-4">
            <Field label="Projektname" error={errors.title}>
              <input
                value={input.title}
                onChange={e => updateField('title', e.target.value)}
                placeholder="z.B. KI Rechercheassistent fuer Projektideen"
                className="input-field"
              />
            </Field>
            <Field label="Rohidee" error={errors.rawIdea}>
              <textarea
                value={input.rawIdea}
                onChange={e => updateField('rawIdea', e.target.value)}
                rows={7}
                placeholder="Beschreibe die Idee so, wie sie gerade in deinem Kopf ist..."
                className="input-field resize-none"
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Problem" error={errors.problemStatement}>
              <textarea
                value={input.problemStatement}
                onChange={e => updateField('problemStatement', e.target.value)}
                rows={4}
                placeholder="Welches konkrete Problem soll geloest werden?"
                className="input-field resize-none"
              />
            </Field>
            <Field label="Zielgruppe" error={errors.targetAudience}>
              <input
                value={input.targetAudience}
                onChange={e => updateField('targetAudience', e.target.value)}
                placeholder="z.B. Solo-Developer, kleine Teams, interne Innovationsgruppe"
                className="input-field"
              />
            </Field>
            <Field label="Gewuenschter Zielzustand" error={errors.desiredOutcome}>
              <textarea
                value={input.desiredOutcome}
                onChange={e => updateField('desiredOutcome', e.target.value)}
                rows={4}
                placeholder="Was soll nach erfolgreicher Umsetzung besser, schneller oder guenstiger sein?"
                className="input-field resize-none"
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label="Constraints">
              <textarea
                value={constraintsText}
                onChange={e => setConstraintsText(e.target.value)}
                rows={5}
                placeholder={'Ein Constraint pro Zeile, z.B.\\nlocal-first nutzbar\\nNAS als SSOT\\nkeine Web-Recherche im lokalen Modus'}
                className="input-field resize-none"
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField
                label="Scope"
                value={input.scope}
                onChange={value => updateField('scope', value as BriefScope)}
                options={[
                  ['minimal', 'Minimal'],
                  ['standard', 'Standard'],
                  ['full', 'Full'],
                ]}
              />
              <SelectField
                label="Recherche"
                value={input.researchMode}
                onChange={value => updateField('researchMode', value as ResearchMode)}
                options={[
                  ['quick', 'Quick'],
                  ['standard', 'Standard'],
                  ['deep', 'Deep'],
                ]}
              />
              <SelectField
                label="Privacy"
                value={input.privacyMode}
                onChange={value => updateField('privacyMode', value as ResearchPrivacyMode)}
                options={[
                  ['local', 'Local'],
                  ['hybrid', 'Hybrid'],
                  ['cloud', 'Cloud'],
                ]}
              />
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
              <span className="font-semibold text-gray-300">Privacy-Regel:</span> Local bedeutet NAS, Obsidian, lokale Dateien und lokale Modelle. Web-Recherche braucht Hybrid oder Cloud.
            </div>
          </div>
        )}

        {step === 3 && (
          <ReviewPanel input={{ ...input, constraints: constraintsText.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean) }} />
        )}

        <div className="mt-6 flex items-center justify-between border-t border-gray-800 pt-5">
          <button
            type="button"
            onClick={() => setStep(prev => Math.max(prev - 1, 0) as WizardStep)}
            disabled={step === 0}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Zurueck
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Weiter
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? 'Speichere...' : 'ProjectBrief speichern'}
            </button>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        {createdBrief && (
          <div className="rounded-xl border border-green-800 bg-green-950/30 p-4">
            <div className="text-sm font-semibold text-green-300">ProjectBrief erstellt</div>
            <div className="mt-1 text-sm text-gray-300">{createdBrief.title}</div>
          </div>
        )}

        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-white">Gespeicherte Briefs</h2>
            <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">{briefs.length}</span>
          </div>
          <div className="space-y-3">
            {briefs.length === 0 ? (
              <p className="text-sm text-gray-500">Noch keine ProjectBriefs gespeichert.</p>
            ) : briefs.slice(0, 6).map(brief => (
              <div key={brief.id} className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                <div className="text-sm font-semibold text-gray-200">{brief.title}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <Badge>{brief.status}</Badge>
                  <Badge>{brief.scope}</Badge>
                  <Badge>{brief.privacyMode}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 p-4">
          <h2 className="font-semibold text-blue-200">Naechster Schritt</h2>
          <p className="mt-2 text-sm text-gray-400">
            Nach dem Speichern kann daraus im naechsten Schritt ein Research Brief mit Findings und Quellen entstehen.
          </p>
        </div>
      </aside>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-gray-300">{label}</span>
      {children}
      {error && <span className="mt-2 block text-xs text-red-400">{error}</span>}
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<[string, string]>
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-gray-300">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="input-field">
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>{labelText}</option>
        ))}
      </select>
    </label>
  )
}

function ReviewPanel({ input }: { input: IdeaIntakeInput }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
        <h2 className="text-lg font-semibold text-white">{input.title || 'Unbenannte Idee'}</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-400">{input.rawIdea}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard title="Problem" value={input.problemStatement} />
        <SummaryCard title="Zielgruppe" value={input.targetAudience} />
        <SummaryCard title="Zielzustand" value={input.desiredOutcome} />
        <SummaryCard title="Research Brief" value={`${input.researchMode} / ${input.privacyMode} / Agent first`} />
      </div>
      {input.constraints.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
          <div className="text-sm font-semibold text-gray-300">Constraints</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-400">
            {input.constraints.map(item => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</div>
      <div className="mt-2 text-sm text-gray-300">{value || 'Noch offen'}</div>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-gray-700 bg-gray-900 px-2 py-0.5 text-gray-400">{children}</span>
  )
}
