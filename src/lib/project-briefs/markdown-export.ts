/**
 * Project Brief → Markdown Export
 */

import type { ProjectBrief } from '@/lib/models/project-brief'

const STATUS_LABELS: Record<ProjectBrief['status'], string> = {
  draft: 'Entwurf', in_review: 'In Review', accepted: 'Freigegeben', archived: 'Archiviert',
}

const PRIORITY_LABELS: Record<string, string> = {
  must: 'Must Have', should: 'Should Have', could: 'Could Have', wont: "Won't Have",
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'Hoch', medium: 'Mittel', low: 'Niedrig', uncertain: 'Unsicher',
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

export function briefMarkdownFilename(brief: ProjectBrief): string {
  return `brief-${slugify(brief.title)}.md`
}

export function briefToMarkdown(brief: ProjectBrief): string {
  const lines: string[] = []
  lines.push(`# ${brief.title}`)
  lines.push('')
  lines.push(`**Status:** ${STATUS_LABELS[brief.status]}`)
  lines.push(`**Scope:** ${brief.scope}`)
  lines.push(`**Research Mode:** ${brief.researchMode}`)
  lines.push(`**Privacy Mode:** ${brief.privacyMode}`)
  lines.push(`**Erstellt:** ${new Date(brief.createdAt).toLocaleString('de-DE', { timeZone: 'UTC' })} UTC`)
  lines.push('')
  lines.push('## Idee / Ausgangslage')
  lines.push('')
  lines.push(brief.rawIdea)
  lines.push('')
  lines.push('## Problemstellung')
  lines.push('')
  lines.push(brief.problemStatement)
  lines.push('')
  lines.push('## Zielgruppe')
  lines.push('')
  lines.push(brief.targetAudience)
  lines.push('')
  lines.push('## Gew\u00fcnschtes Ergebnis')
  lines.push('')
  lines.push(brief.desiredOutcome)
  lines.push('')

  if (brief.constraints.length > 0) {
    lines.push('## Randbedingungen')
    lines.push('')
    for (const c of brief.constraints) lines.push(`- ${c}`)
    lines.push('')
  }

  if (brief.nonGoals.length > 0) {
    lines.push('## Non-Goals')
    lines.push('')
    for (const ng of brief.nonGoals) lines.push(`- ${ng}`)
    lines.push('')
  }

  const acceptedReqs = brief.requirements.filter(r => r.status === 'accepted')
  const proposedReqs = brief.requirements.filter(r => r.status === 'proposed')
  if (acceptedReqs.length > 0 || proposedReqs.length > 0) {
    lines.push('## Anforderungen')
    lines.push('')
    if (acceptedReqs.length > 0) {
      lines.push('### Akzeptiert')
      lines.push('')
      for (const req of acceptedReqs) {
        lines.push(`#### ${req.title}`)
        lines.push('')
        lines.push(`**Typ:** ${req.type} | **Priorit\u00e4t:** ${PRIORITY_LABELS[req.priority] ?? req.priority} | **Quelle:** ${req.source}`)
        lines.push('')
        lines.push(req.description)
        lines.push('')
      }
    }
    if (proposedReqs.length > 0) {
      lines.push('### Vorgeschlagen')
      lines.push('')
      for (const req of proposedReqs) {
        lines.push(`- **${req.title}** (${req.type}, ${PRIORITY_LABELS[req.priority] ?? req.priority})`)
      }
      lines.push('')
    }
  }

  if (brief.risks.length > 0) {
    lines.push('## Risiken')
    lines.push('')
    for (const risk of brief.risks) {
      lines.push(`### ${risk.title}`)
      lines.push('')
      lines.push(`**Wahrscheinlichkeit:** ${risk.probability} | **Impact:** ${risk.impact}`)
      lines.push('')
      lines.push(risk.description)
      if (risk.mitigationIdea) { lines.push(''); lines.push(`**Mitigationsidee:** ${risk.mitigationIdea}`) }
      lines.push('')
    }
  }

  const rbd = brief.researchBriefDraft
  if (rbd.researchQuestions.length > 0 || rbd.searchTerms.length > 0) {
    lines.push('## Research Brief (Entwurf)')
    lines.push('')
    if (rbd.researchQuestions.length > 0) {
      lines.push('### Forschungsfragen')
      lines.push('')
      for (const q of rbd.researchQuestions) lines.push(`- ${q}`)
      lines.push('')
    }
    if (rbd.searchTerms.length > 0) {
      lines.push('### Suchbegriffe')
      lines.push('')
      lines.push('```')
      lines.push(rbd.searchTerms.join(', '))
      lines.push('```')
      lines.push('')
    }
    if (rbd.preferredSourceTypes && rbd.preferredSourceTypes.length > 0) {
      lines.push('### Bevorzugte Quellen')
      lines.push('')
      for (const src of rbd.preferredSourceTypes) lines.push(`- ${src}`)
      lines.push('')
    }
  }

  const run = brief.lastResearchRun
  if (run) {
    lines.push('## Letzter Research-Run')
    lines.push('')
    lines.push(`**Status:** ${run.status}`)
    lines.push(`**Gestartet:** ${new Date(run.startedAt).toLocaleString('de-DE', { timeZone: 'UTC' })} UTC`)
    if (run.completedAt) lines.push(`**Abgeschlossen:** ${new Date(run.completedAt).toLocaleString('de-DE', { timeZone: 'UTC' })} UTC`)
    if (run.findings && run.findings.length > 0) {
      lines.push('')
      lines.push('### Findings')
      lines.push('')
      for (const f of run.findings) {
        lines.push(`#### ${f.claim}`)
        lines.push('')
        lines.push(`**Konfidenz:** ${CONFIDENCE_LABELS[f.confidence] ?? f.confidence} | **Impact:** ${f.recommendationImpact}`)
        lines.push('')
        lines.push(f.summary)
        lines.push('')
      }
    }
    lines.push('')
  }

  if (brief.notes) { lines.push('## Notizen'); lines.push(''); lines.push(brief.notes); lines.push('') }

  lines.push('---')
  lines.push('')
  lines.push(`*Generiert von ForgePilot \u00b7 Brief ID: \`${brief.id}\`*`)
  lines.push('')
  return lines.join('\n')
}
