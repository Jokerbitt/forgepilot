import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-keys/rotation-tracker', () => ({
  readApiKeysMeta: vi.fn(),
  getRotationStatuses: vi.fn(),
  hasStaleKeys: vi.fn(),
  ROTATION_THRESHOLD_DAYS: 90,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/api-keys/rotation-status', () => {
  it('returns rotation status for all keys', async () => {
    const { readApiKeysMeta, getRotationStatuses, hasStaleKeys } = await import('@/lib/api-keys/rotation-tracker')
    vi.mocked(readApiKeysMeta).mockReturnValue({ ANTHROPIC_API_KEY: { rotatedAt: '2024-01-01', daysUntilExpiry: 60 } } as ReturnType<typeof readApiKeysMeta>)
    vi.mocked(getRotationStatuses).mockReturnValue([{ key: 'ANTHROPIC_API_KEY', stale: false, daysUntilExpiry: 60 }] as ReturnType<typeof getRotationStatuses>)
    vi.mocked(hasStaleKeys).mockReturnValue(false)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { thresholdDays: number; hasStaleKeys: boolean; keys: unknown[] }

    expect(res.status).toBe(200)
    expect(body.thresholdDays).toBe(90)
    expect(body.hasStaleKeys).toBe(false)
    expect(body.keys).toHaveLength(1)
  })
})
