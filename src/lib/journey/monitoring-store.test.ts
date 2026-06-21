import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { readMonitoringHistory, getSnapshot, recordSnapshot, type MonitoringSnapshot } from './monitoring-store'

let dir: string
const file = () => path.join(dir, 'app-monitoring.json')

const snap = (appUrl: string, over: Partial<MonitoringSnapshot> = {}): MonitoringSnapshot => ({
  appUrl,
  status: 'healthy',
  okCount: 1,
  total: 1,
  avgLatencyMs: 100,
  consecutiveFailures: 0,
  checkedAt: '2026-06-21T10:00:00.000Z',
  ...over,
})

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-mon-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('monitoring-store', () => {
  it('returns an empty map and undefined snapshot before anything is written', () => {
    expect(readMonitoringHistory(file())).toEqual({})
    expect(getSnapshot('http://x', file())).toBeUndefined()
  })

  it('records and reads back a snapshot keyed by app URL', () => {
    recordSnapshot(snap('http://app.local'), file())
    expect(getSnapshot('http://app.local', file())).toMatchObject({ appUrl: 'http://app.local', status: 'healthy' })
  })

  it('overwrites the snapshot for the same URL and keeps others', () => {
    recordSnapshot(snap('http://a'), file())
    recordSnapshot(snap('http://b', { status: 'down', consecutiveFailures: 2 }), file())
    recordSnapshot(snap('http://a', { status: 'degraded' }), file())

    const history = readMonitoringHistory(file())
    expect(Object.keys(history)).toHaveLength(2)
    expect(history['http://a'].status).toBe('degraded')
    expect(history['http://b'].consecutiveFailures).toBe(2)
  })

  it('creates the config directory if it does not exist yet', () => {
    const nested = path.join(dir, 'deep', 'config', 'app-monitoring.json')
    recordSnapshot(snap('http://x'), nested)
    expect(fs.existsSync(nested)).toBe(true)
    expect(getSnapshot('http://x', nested)).toBeDefined()
  })
})
