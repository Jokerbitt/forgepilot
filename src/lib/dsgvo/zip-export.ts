/**
 * DSGVO ZIP Export — Art. 20 DSGVO (Right to Data Portability)
 *
 * Builds a downloadable ZIP archive containing all personal data
 * processed by ForgePilot for the requesting data subject.
 *
 * Archive structure:
 *   forgepilot-export/
 *     README.md              — Art. 20 DSGVO info + instructions
 *     processing-ledger.json — AI processing records (Art. 30)
 *     delegations.json       — delegation queue records
 *     project-briefs.json    — project brief records (if any)
 *     metadata.json          — export timestamp, version, record counts
 */

import fs from 'fs'
import path from 'path'
import JSZip from 'jszip'
import { getDataDir } from '@/lib/config/paths'

const EXPORT_VERSION = '1.0'

interface ExportMetadata {
  exportedAt: string
  version: string
  dataSubjectsCount: number
  recordCounts: {
    processingLedger: number
    delegations: number
    projectBriefs: number
  }
  legalBasis: string
  retentionNote: string
}

function readJsonFile<T>(filePath: string): T[] {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function buildReadme(metadata: ExportMetadata): string {
  return `# ForgePilot — Datenschutz-Export (Art. 20 DSGVO)

Dieses Archiv wurde gemäß Art. 20 DSGVO (Recht auf Datenübertragbarkeit) erstellt.

## Exportinformationen

| Feld | Wert |
|------|------|
| Exportiert am | ${metadata.exportedAt} |
| Exportversion | ${metadata.version} |
| Betroffene Personen | ${metadata.dataSubjectsCount} |

## Enthaltene Datensätze

| Datei | Anzahl Einträge | Beschreibung |
|-------|----------------|--------------|
| processing-ledger.json | ${metadata.recordCounts.processingLedger} | KI-Verarbeitungsprotokolle gem. Art. 30 DSGVO |
| delegations.json | ${metadata.recordCounts.delegations} | Delegations- und Aufgabenprotokolle |
| project-briefs.json | ${metadata.recordCounts.projectBriefs} | Projektbriefings und Anforderungen |

## Ihre Rechte

Gemäß DSGVO haben Sie folgende Rechte:

- **Art. 20** — Recht auf Datenübertragbarkeit (dieser Export)
- **Art. 17** — Recht auf Löschung (Erasure-Funktion in ForgePilot)
- **Art. 15** — Recht auf Auskunft
- **Art. 16** — Recht auf Berichtigung

## Rechtliche Grundlage

${metadata.legalBasis}

## Aufbewahrungshinweis

${metadata.retentionNote}

---
*ForgePilot AI Workflow OS — https://github.com/Jokerbitt/forgepilot*
`
}

/**
 * Builds a ZIP buffer containing all DSGVO-relevant data records.
 * Safe to call without Supabase — falls back to local JSON files.
 */
export async function buildDsgvoExportZip(): Promise<Buffer> {
  const dataDir = getDataDir()

  // Read available data files
  const processingLedger = readJsonFile<Record<string, unknown>>(
    path.join(dataDir, 'processing-ledger.json')
  )
  const delegations = readJsonFile<Record<string, unknown>>(
    path.join(dataDir, 'delegations.json')
  )
  const projectBriefs = readJsonFile<Record<string, unknown>>(
    path.join(dataDir, 'project-briefs.json')
  )

  // Count unique data subjects
  const subjectIds = new Set<string>()
  for (const record of processingLedger) {
    if (typeof record['dataSubjectId'] === 'string' && record['dataSubjectId']) {
      subjectIds.add(record['dataSubjectId'])
    }
  }

  const metadata: ExportMetadata = {
    exportedAt: new Date().toISOString(),
    version: EXPORT_VERSION,
    dataSubjectsCount: subjectIds.size,
    recordCounts: {
      processingLedger: processingLedger.length,
      delegations: delegations.length,
      projectBriefs: projectBriefs.length,
    },
    legalBasis:
      'Verarbeitung auf Basis berechtigter Interessen (Art. 6 Abs. 1 lit. f DSGVO) ' +
      'sowie Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).',
    retentionNote:
      'Verarbeitungsprotokolle werden 5 Jahre aufbewahrt (Art. 30 DSGVO). ' +
      'Übrige Daten werden auf Anfrage gelöscht.',
  }

  const zip = new JSZip()
  const folder = zip.folder('forgepilot-export')
  if (!folder) throw new Error('Failed to create ZIP folder')

  folder.file('README.md', buildReadme(metadata))
  folder.file('metadata.json', JSON.stringify(metadata, null, 2))
  folder.file('processing-ledger.json', JSON.stringify(processingLedger, null, 2))
  folder.file('delegations.json', JSON.stringify(delegations, null, 2))
  folder.file('project-briefs.json', JSON.stringify(projectBriefs, null, 2))

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return buffer
}
