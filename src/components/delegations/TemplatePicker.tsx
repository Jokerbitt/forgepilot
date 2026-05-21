'use client'
import { DELEGATION_TEMPLATES, type DelegationTemplate } from '@/lib/delegation-templates'
import { cx } from '@/components/ui/primitives'

interface Props {
  onSelect: (template: DelegationTemplate) => void
  selectedId?: string
}

export function TemplatePicker({ onSelect, selectedId }: Props) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-slate-400">Vorlage wählen (optional)</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {DELEGATION_TEMPLATES.map(template => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            className={cx(
              'flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors',
              selectedId === template.id
                ? 'border-violet-500/50 bg-violet-500/10 text-violet-200'
                : 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-white/[0.15] hover:bg-white/[0.06]'
            )}
          >
            <span className="text-lg leading-none">{template.icon}</span>
            <span className="text-xs font-medium leading-snug">{template.name}</span>
          </button>
        ))}
      </div>
      {selectedId && (
        <p className="mt-2 text-xs text-slate-500">
          {DELEGATION_TEMPLATES.find(t => t.id === selectedId)?.description}
        </p>
      )}
    </div>
  )
}
