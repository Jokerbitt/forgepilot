import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parsePrUrl, fetchPRStatus } from './pr-status'

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(() => ({ GITHUB_TOKEN: 'ghp_testtoken' })),
}))

describe('parsePrUrl', () => {
  it('parses a valid GitHub PR URL', () => {
    const result = parsePrUrl('https://github.com/Jokerbitt/forgepilot/pull/229')
    expect(result).toEqual({ owner: 'Jokerbitt', repo: 'forgepilot', prNumber: 229 })
  })

  it('returns null for invalid URL', () => {
    expect(parsePrUrl('https://example.com/not-a-pr')).toBeNull()
    expect(parsePrUrl('')).toBeNull()
  })

  it('parses PR URL with query params', () => {
    const result = parsePrUrl('https://github.com/owner/repo/pull/42?tab=files')
    expect(result).toEqual({ owner: 'owner', repo: 'repo', prNumber: 42 })
  })
})

describe('fetchPRStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns error result for invalid URL', async () => {
    const result = await fetchPRStatus('not-a-url')
    expect(result.error).toBe('Invalid PR URL')
    expect(result.ciState).toBe('unknown')
  })

  it('fetches PR metadata and check runs', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          number: 42, title: 'My PR', state: 'open', merged_at: null,
          head: { sha: 'abc123' }, updated_at: '2026-05-20T12:00:00Z',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          check_runs: [
            { name: 'CI', status: 'completed', conclusion: 'success', html_url: 'https://github.com/checks/1' },
            { name: 'Lint', status: 'completed', conclusion: 'success', html_url: 'https://github.com/checks/2' },
          ],
        }),
      } as Response)

    const result = await fetchPRStatus('https://github.com/owner/repo/pull/42')
    expect(result.prNumber).toBe(42)
    expect(result.title).toBe('My PR')
    expect(result.state).toBe('open')
    expect(result.ciState).toBe('success')
    expect(result.ciChecks).toHaveLength(2)
  })

  it('returns merged state when merged_at is set', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          number: 1, title: 'Merged PR', state: 'closed', merged_at: '2026-05-19T10:00:00Z',
          head: { sha: 'xyz789' }, updated_at: '2026-05-19T10:00:00Z',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ check_runs: [] }),
      } as Response)

    const result = await fetchPRStatus('https://github.com/owner/repo/pull/1')
    expect(result.state).toBe('merged')
  })

  it('returns failure ciState when any check fails', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          number: 5, title: 'Failing PR', state: 'open', merged_at: null,
          head: { sha: 'fail1' }, updated_at: '2026-05-20T12:00:00Z',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          check_runs: [
            { name: 'CI', status: 'completed', conclusion: 'failure', html_url: 'https://github.com/checks/1' },
            { name: 'Lint', status: 'completed', conclusion: 'success', html_url: 'https://github.com/checks/2' },
          ],
        }),
      } as Response)

    const result = await fetchPRStatus('https://github.com/owner/repo/pull/5')
    expect(result.ciState).toBe('failure')
  })

  it('returns pending ciState when checks are in_progress', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          number: 10, title: 'Running PR', state: 'open', merged_at: null,
          head: { sha: 'run1' }, updated_at: '2026-05-20T12:00:00Z',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          check_runs: [
            { name: 'CI', status: 'in_progress', conclusion: null, html_url: 'https://github.com/checks/1' },
          ],
        }),
      } as Response)

    const result = await fetchPRStatus('https://github.com/owner/repo/pull/10')
    expect(result.ciState).toBe('pending')
  })

  it('handles GitHub API error gracefully', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response)

    const result = await fetchPRStatus('https://github.com/owner/repo/pull/999')
    expect(result.error).toContain('404')
    expect(result.ciState).toBe('unknown')
  })
})
