import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { getPlanningAuditStats, listPlanningAuditRecords, recordPlanningAudit } from './planning-audit-store'

function auditFile(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forgepilot-planning-audit-')), 'planning-audit-log.json')
}

describe('planning audit store', () => {
  it('persists planning audit records newest-first', () => {
    const file = auditFile()
    const first = recordPlanningAudit({
      audit: {
        action: 'grok-planning',
        mode: 'preview',
        payloadHash: 'a'.repeat(64),
        itemCount: 1,
        createdCount: 0,
        skippedCount: 0,
        createdAt: '2026-05-21T10:00:00.000Z',
      },
      summary: {
        payloadHash: 'a'.repeat(64),
        milestones: 1,
        items: 1,
        targetCounts: { linear: 1, github: 1 },
        priorityCounts: { P0: 1, P1: 0, P2: 0 },
        ownerCounts: { codex: 1, claude: 0, grok: 0, human: 0 },
      },
      applyResult: { mode: 'preview', created: [], skipped: [] },
      warnings: ['Preview only'],
    }, file)

    const second = recordPlanningAudit({
      audit: {
        action: 'grok-planning',
        mode: 'create-all',
        payloadHash: 'b'.repeat(64),
        itemCount: 2,
        createdCount: 1,
        skippedCount: 1,
        createdAt: '2026-05-21T11:00:00.000Z',
      },
      summary: {
        payloadHash: 'b'.repeat(64),
        milestones: 1,
        items: 2,
        targetCounts: { linear: 1, github: 1 },
        priorityCounts: { P0: 1, P1: 1, P2: 0 },
        ownerCounts: { codex: 1, claude: 1, grok: 0, human: 0 },
      },
      applyResult: {
        mode: 'create-all',
        created: [{ target: 'github', title: '[P0] Task', identifier: '#42', url: 'https://github.test/42' }],
        skipped: [{ target: 'linear', title: '[P1] Task', reason: 'Already exists: JOK-1' }],
      },
      warnings: ['Some requested targets were skipped because connector configuration is missing.'],
    }, file)

    const records = listPlanningAuditRecords(10, file)

    expect(records.map(record => record.id)).toEqual([second.id, first.id])
    expect(records[0]).toMatchObject({
      outcome: 'partial',
      payloadHash: 'b'.repeat(64),
      itemCount: 2,
      createdCount: 1,
      skippedCount: 1,
    })
    expect(records[1]).toMatchObject({ outcome: 'preview', warnings: ['Preview only'] })

    expect(getPlanningAuditStats(file)).toMatchObject({
      total: 2,
      byMode: { preview: 1, 'create-all': 1 },
      byOutcome: { preview: 1, partial: 1 },
    })
  })

  it('recovers from corrupt audit files', () => {
    const file = auditFile()
    fs.writeFileSync(file, '{not json', 'utf-8')

    expect(listPlanningAuditRecords(10, file)).toEqual([])
  })
})
