'use client'

import type { DelegationStatus } from '@/lib/models/delegation'

interface Step {
  label: string
  key: string
}

const PIPELINE_STEPS: Step[] = [
  { label: 'Brief',      key: 'brief' },
  { label: 'Delegation', key: 'delegation' },
  { label: 'Ausführung', key: 'execution' },
  { label: 'Review',     key: 'review' },
  { label: 'PR',         key: 'pr' },
]

/**
 * Map delegation status to which pipeline step is currently active (0-indexed).
 * Step 0 = Brief (always done if we have a delegation)
 * Step 1 = Delegation (pending / approved)
 * Step 2 = Ausführung (running / failed)
 * Step 3 = Review (completed)
 * Step 4 = PR (completed + prUrl)
 */
function getActiveStep(status: DelegationStatus, hasPr: boolean): number {
  switch (status) {
    case 'pending':
    case 'approved':
      return 1
    case 'running':
      return 2
    case 'failed':
      return 2
    case 'completed':
      return hasPr ? 4 : 3
    case 'cancelled':
      return 1
    default:
      return 1
  }
}

interface DelegationPipelineBreadcrumbProps {
  status: DelegationStatus
  hasPr?: boolean
}

export function DelegationPipelineBreadcrumb({ status, hasPr = false }: DelegationPipelineBreadcrumbProps) {
  const activeStep = getActiveStep(status, hasPr)

  return (
    <div className="flex items-center gap-1 flex-wrap" aria-label="Pipeline-Fortschritt">
      {PIPELINE_STEPS.map((step, i) => {
        const isDone = i < activeStep
        const isActive = i === activeStep
        const isFailed = status === 'failed' && i === 2
        const isFuture = i > activeStep && !isDone

        let stepClass = ''
        let dotClass = ''

        if (isFailed) {
          stepClass = 'text-red-400 font-semibold'
          dotClass = 'bg-red-500'
        } else if (isDone) {
          stepClass = 'text-emerald-400 font-medium'
          dotClass = 'bg-emerald-500'
        } else if (isActive) {
          stepClass = 'text-white font-semibold'
          dotClass = status === 'running' ? 'bg-violet-400 animate-pulse' : 'bg-blue-400'
        } else {
          stepClass = 'text-gray-600'
          dotClass = 'bg-gray-700'
        }

        return (
          <div key={step.key} className="flex items-center gap-1">
            {/* Step indicator */}
            <div className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
              <span className={`text-xs ${stepClass}`}>
                {step.label}
              </span>
              {isActive && !isFailed && (
                <span className={`text-[10px] ${
                  status === 'running' ? 'text-violet-400' :
                  status === 'pending' ? 'text-yellow-500' :
                  status === 'approved' ? 'text-blue-400' :
                  'text-gray-500'
                }`}>
                  {status === 'running' ? '▶' :
                   status === 'pending' ? '⏳' :
                   status === 'approved' ? '✓' :
                   status === 'completed' ? '✓' :
                   status === 'cancelled' ? '✕' :
                   ''}
                </span>
              )}
              {isFailed && (
                <span className="text-[10px] text-red-500">✗</span>
              )}
            </div>

            {/* Connector arrow — not after last step */}
            {i < PIPELINE_STEPS.length - 1 && (
              <span className={`text-xs ${isDone && i < activeStep - 1 || (isDone) ? 'text-emerald-700' : isFuture ? 'text-gray-800' : 'text-gray-600'}`}>
                →
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
