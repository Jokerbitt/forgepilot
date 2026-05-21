'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProjectBrief, Requirement, UseCase, Risk } from '@/lib/models/project-brief'

type StudioStep = 'input' | 'loading' | 'edit' | 'done'

interface GeneratedStructure {
  requirements: Requirement[]
  useCases: UseCase[]
  risks: Risk[]
  assumptions: string[]
  implementationDirection: string
  brief: ProjectBrief
  source: 'ai' | 'fallback'
}

interface EditableStructure {
  requirements: string[]
  useCases: string[]
  risks: Array<{ title: string; mitigation: string }>
  assumptions: string[]
  implementationDirection: string
}

function toEditable(generated: GeneratedStructure): EditableStructure {
  return {
    requirements: generated.requirements.map(r => `[${r.priority}] ${r.title}: ${r.description}`),
    useCases: generated.useCases.map(uc => `${uc.title} — ${uc.actor}: ${uc.mainFlow.join(' → ')}`),
    risks: generated.risks.map(r => ({
      title: r.title,
      mitigation: r.mitigationIdea ?? '',
    })),
    assumptions: generated.assumptions,
    implementationDirection: generated.implementationDirection,
  }
}

async function createBrief(title: string, description: string): Promise<ProjectBrief> {
  const payload = {
    title,
    rawIdea: description,
    problemStatement: description.slice(0, 200),
    targetAudience: 'Team',
    desiredOutcome: description.slice(0, 200),
    constraints: [],
    scope: 'standard',
    researchMode: 'standard',
    privacyMode: 'local',
  }
  const res = await fetch('/api/project-briefs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Fehler beim Erstellen des ProjectBrief')
  return res.json() as Promise<ProjectBrief>
}

async function generateStructure(id: string): Promise<GeneratedStructure> {
  const res = await fetch(`/api/project-briefs/${id}/generate-structure`, {
    method: 'POST',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'Fehler beim Generieren der Struktur')
  }
  return res.json() as Promise<GeneratedStructure>
}

async function finalizeStructure(
  id: string,
  editable: EditableStructure,
): Promise<ProjectBrief> {
  const res = await fetch(`/api/project-briefs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'in_review',
      assumptions: editable.assumptions,
      implementationDirection: editable.implementationDirection,
    }),
  })
  if (!res.ok) throw new Error('Fehler beim Finalisieren des Brief')
  return res.json() as Promise<ProjectBrief>
}

export function BriefStudioFlow() {
  const router = useRouter()
  const [step, setStep] = useState<StudioStep>('input')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [generated, setGenerated] = useState<GeneratedStructure | null>(null)
  const [editable, setEditable] = useState<EditableStructure | null>(null)
  const [finalBrief, setFinalBrief] = useState<ProjectBrief | null>(null)
  const [finalizing, setFinalizing] = useState(false)

  const handleGenerate = async () => {
    if (title.trim().length < 3) {
      setInputError('Bitte gib einen Projektnamen ein (mindestens 3 Zeichen).')
      return
    }
    if (description.trim().length < 20) {
      setInputError('Beschreibe die Idee etwas ausführlicher (mindestens 20 Zeichen).')
      return
    }
    setInputError(null)
    setGenerationError(null)
    setStep('loading')

    try {
      const brief = await createBrief(title.trim(), description.trim())
      const structure = await generateStructure(brief.id)
      setGenerated(structure)
      setEditable(toEditable(structure))
      setStep('edit')
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setStep('input')
    }
  }

  const handleFinalize = async () => {
    if (!generated || !editable) return
    setFinalizing(true)
    try {
      const brief = await finalizeStructure(generated.brief.id, editable)
      setFinalBrief(brief)
      setStep('done')
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Fehler beim Finalisieren')
    } finally {
      setFinalizing(false)
    }
  }

  const updateRequirement = (index: number, value: string) => {
    if (!editable) return
    const updated = [...editable.requirements]
    updated[index] = value
    setEditable({ ...editable, requirements: updated })
  }

  const updateUseCase = (index: number, value: string) => {
    if (!editable) return
    const updated = [...editable.useCases]
    updated[index] = value
    setEditable({ ...editable, useCases: updated })
  }

  const updateRisk = (index: number, field: 'title' | 'mitigation', value: string) => {
    if (!editable) return
    const updated = editable.risks.map((r, i) => i === index ? { ...r, [field]: value } : r)
    setEditable({ ...editable, risks: updated })
  }

  const updateAssumption = (index: number, value: string) => {
    if (!editable) return
    const updated = [...editable.assumptions]
    updated[index] = value
    setEditable({ ...editable, assumptions: updated })
  }

  const addItem = (field: 'requirements' | 'useCases' | 'assumptions') => {
    if (!editable) return
    setEditable({ ...editable, [field]: [...editable[field], ''] })
  }

  const addRisk = () => {
    if (!editable) return
    setEditable({ ...editable, risks: [...editable.risks, { title: '', mitigation: '' }] })
  }

  const removeItem = (field: 'requirements' | 'useCases' | 'assumptions', index: number) => {
    if (!editable) return
    setEditable({ ...editable, [field]: editable[field].filter((_, i) => i !== index) })
  }

  const removeRisk = (index: number) => {
    if (!editable) return
    setEditable({ ...editable, risks: editable.risks.filter((_, i) => i !== index) })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-5 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Project Brief Studio</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Von der Idee zum strukturierten Brief</h1>
        <p className="mt-2 text-sm text-gray-400">
          Beschreibe deine Idee — ForgePilot leitet daraus Requirements, Use Cases, Risiken, Annahmen und eine Implementierungsrichtung ab.
        </p>

        {/* Step indicator */}
        <div className="mt-4 flex items-center gap-2">
          {(['input', 'loading', 'edit', 'done'] as StudioStep[]).map((s, i) => {
            const labels: Record<StudioStep, string> = {
              input: '1. Idee',
              loading: '2. Generieren',
              edit: '3. Verfeinern',
              done: '4. Fertig',
            }
            const isActive = step === s
            const isDone =
              (s === 'input' && ['loading', 'edit', 'done'].includes(step)) ||
              (s === 'loading' && ['edit', 'done'].includes(step)) ||
              (s === 'edit' && step === 'done')
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className="h-px w-6 bg-gray-700" />}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isDone
                        ? 'bg-green-900/60 text-green-300'
                        : 'bg-gray-800 text-gray-500'
                  }`}
                >
                  {labels[s]}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Step 1: Input */}
      {step === 'input' && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-5 shadow-xl space-y-4">
          {generationError && (
            <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {generationError}
            </div>
          )}
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-300">Projektname</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="z.B. KI Rechercheassistent für Projektideen"
              className="input-field"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-300">Projektbeschreibung / Rohidee</span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={7}
              placeholder="Beschreibe die Idee so, wie sie gerade in deinem Kopf ist. Was ist das Problem? Wer hat es? Was soll besser werden?"
              className="input-field resize-none"
            />
          </label>
          {inputError && (
            <p className="text-xs text-red-400">{inputError}</p>
          )}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleGenerate}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              Struktur generieren →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Loading */}
      {step === 'loading' && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-10 shadow-xl flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-gray-400">KI leitet Struktur aus deiner Idee ab...</p>
          <p className="text-xs text-gray-600">Requirements · Use Cases · Risiken · Annahmen · Implementierungsrichtung</p>
        </div>
      )}

      {/* Step 3: Edit */}
      {step === 'edit' && editable && generated && (
        <div className="space-y-4">
          {generated.source === 'fallback' && (
            <div className="rounded-lg border border-yellow-900 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-300">
              Kein AI-Anbieter konfiguriert — Platzhalter-Struktur generiert. Bearbeite die Inhalte nach Bedarf.
            </div>
          )}

          {/* Requirements */}
          <Section
            title="Requirements"
            badge={`${editable.requirements.length}`}
            badgeColor="blue"
          >
            <div className="space-y-2">
              {editable.requirements.map((req, i) => (
                <EditRow
                  key={i}
                  value={req}
                  onChange={v => updateRequirement(i, v)}
                  onRemove={() => removeItem('requirements', i)}
                  placeholder="[must] Titel: Beschreibung..."
                />
              ))}
            </div>
            <AddButton onClick={() => addItem('requirements')} label="Requirement hinzufügen" />
          </Section>

          {/* Use Cases */}
          <Section
            title="Use Cases"
            badge={`${editable.useCases.length}`}
            badgeColor="purple"
          >
            <div className="space-y-2">
              {editable.useCases.map((uc, i) => (
                <EditRow
                  key={i}
                  value={uc}
                  onChange={v => updateUseCase(i, v)}
                  onRemove={() => removeItem('useCases', i)}
                  placeholder="Titel — Actor: Schritt 1 → Schritt 2 → Schritt 3"
                />
              ))}
            </div>
            <AddButton onClick={() => addItem('useCases')} label="Use Case hinzufügen" />
          </Section>

          {/* Risks */}
          <Section
            title="Risiken & Mitigations"
            badge={`${editable.risks.length}`}
            badgeColor="red"
          >
            <div className="space-y-3">
              {editable.risks.map((risk, i) => (
                <div key={i} className="rounded-lg border border-gray-800 bg-gray-950 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <input
                      value={risk.title}
                      onChange={e => updateRisk(i, 'title', e.target.value)}
                      placeholder="Risikotitel"
                      className="input-field flex-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeRisk(i)}
                      className="mt-1 text-gray-600 hover:text-red-400 transition-colors text-xs"
                      aria-label="Risiko entfernen"
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    value={risk.mitigation}
                    onChange={e => updateRisk(i, 'mitigation', e.target.value)}
                    placeholder="Mitigation / Gegenmaßnahme"
                    className="input-field w-full text-sm text-gray-400"
                  />
                </div>
              ))}
            </div>
            <AddButton onClick={addRisk} label="Risiko hinzufügen" />
          </Section>

          {/* Assumptions */}
          <Section
            title="Annahmen"
            badge={`${editable.assumptions.length}`}
            badgeColor="yellow"
          >
            <div className="space-y-2">
              {editable.assumptions.map((assumption, i) => (
                <EditRow
                  key={i}
                  value={assumption}
                  onChange={v => updateAssumption(i, v)}
                  onRemove={() => removeItem('assumptions', i)}
                  placeholder="Annahme, die vor der Umsetzung validiert werden muss..."
                />
              ))}
            </div>
            <AddButton onClick={() => addItem('assumptions')} label="Annahme hinzufügen" />
          </Section>

          {/* Implementation Direction */}
          <Section title="Implementierungsrichtung" badgeColor="green">
            <textarea
              value={editable.implementationDirection}
              onChange={e => setEditable({ ...editable, implementationDirection: e.target.value })}
              rows={5}
              placeholder="Technische und strategische Richtung für die Umsetzung..."
              className="input-field resize-none w-full"
            />
          </Section>

          {generationError && (
            <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {generationError}
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => setStep('input')}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 hover:border-gray-500 transition-colors"
            >
              ← Zurück
            </button>
            <button
              type="button"
              onClick={handleFinalize}
              disabled={finalizing}
              className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:cursor-wait disabled:opacity-60 transition-colors"
            >
              {finalizing ? 'Speichere...' : 'Brief finalisieren →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && finalBrief && editable && (
        <div className="rounded-xl border border-green-800 bg-green-950/30 p-6 shadow-xl space-y-6">
          <div>
            <div className="text-lg font-bold text-green-300">Brief erfolgreich erstellt!</div>
            <div className="mt-1 text-sm text-gray-400">{finalBrief.title}</div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Requirements" value={editable.requirements.length} color="blue" />
            <StatCard label="Use Cases" value={editable.useCases.length} color="purple" />
            <StatCard label="Risiken" value={editable.risks.length} color="red" />
            <StatCard label="Annahmen" value={editable.assumptions.length} color="yellow" />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push(`/project-briefs/${finalBrief.id}`)}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors text-center"
            >
              Brief anzeigen →
            </button>
            <button
              type="button"
              onClick={() => router.push(`/delegations/new?briefId=${finalBrief.id}`)}
              className="flex-1 rounded-lg border border-purple-700 bg-purple-900/30 px-4 py-3 text-sm font-semibold text-purple-200 hover:border-purple-500 transition-colors text-center"
            >
              Delegation erstellen
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('input')
                setTitle('')
                setDescription('')
                setGenerated(null)
                setEditable(null)
                setFinalBrief(null)
              }}
              className="flex-1 rounded-lg border border-gray-700 px-4 py-3 text-sm font-semibold text-gray-300 hover:border-gray-500 transition-colors text-center"
            >
              Neuer Brief
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  badge,
  badgeColor,
  children,
}: {
  title: string
  badge?: string
  badgeColor: 'blue' | 'purple' | 'red' | 'yellow' | 'green'
  children: React.ReactNode
}) {
  const colorMap: Record<typeof badgeColor, string> = {
    blue: 'bg-blue-900/40 text-blue-300 border-blue-800',
    purple: 'bg-purple-900/40 text-purple-300 border-purple-800',
    red: 'bg-red-900/40 text-red-300 border-red-800',
    yellow: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
    green: 'bg-green-900/40 text-green-300 border-green-800',
  }
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-5 shadow-xl space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {badge !== undefined && (
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${colorMap[badgeColor]}`}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function EditRow({
  value,
  onChange,
  onRemove,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onRemove: () => void
  placeholder?: string
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field flex-1 text-sm"
      />
      <button
        type="button"
        onClick={onRemove}
        className="mt-1 text-gray-600 hover:text-red-400 transition-colors text-xs"
        aria-label="Entfernen"
      >
        ✕
      </button>
    </div>
  )
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 rounded-md border border-dashed border-gray-700 px-3 py-1.5 text-xs text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-colors w-full"
    >
      + {label}
    </button>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'blue' | 'purple' | 'red' | 'yellow' }) {
  const colorMap: Record<typeof color, string> = {
    blue: 'border-blue-900 bg-blue-950/30 text-blue-300',
    purple: 'border-purple-900 bg-purple-950/30 text-purple-300',
    red: 'border-red-900 bg-red-950/30 text-red-300',
    yellow: 'border-yellow-900 bg-yellow-950/30 text-yellow-300',
  }
  return (
    <div className={`rounded-lg border p-3 text-center ${colorMap[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  )
}
