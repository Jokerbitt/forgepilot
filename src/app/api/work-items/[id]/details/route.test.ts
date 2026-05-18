import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Prevent readStoredApiKeys from reading real config/api-keys.json
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => { throw new Error('mocked') }),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    renameSync: vi.fn(),
  },
}))

import { GET } from './route'

const savedKey: { value: string | undefined } = { value: undefined }
const savedFetch: { value: typeof fetch | undefined } = { value: undefined }

function installFetchMock(handler: typeof fetch) {
  savedFetch.value = globalThis.fetch
  globalThis.fetch = handler as typeof fetch
}

function restoreFetch() {
  if (savedFetch.value) {
    globalThis.fetch = savedFetch.value
    savedFetch.value = undefined
  }
}

describe('GET /api/work-items/[id]/details', () => {
  beforeEach(() => {
    savedKey.value = process.env.LINEAR_API_KEY
    delete process.env.LINEAR_API_KEY
  })

  afterEach(() => {
    if (savedKey.value !== undefined) process.env.LINEAR_API_KEY = savedKey.value
    else delete process.env.LINEAR_API_KEY
    restoreFetch()
  })

  it('returns 404 when LINEAR_API_KEY is missing', async () => {
    const fetcher = vi.fn()
    installFetchMock(fetcher as unknown as typeof fetch)

    const res = await GET(new Request('http://localhost/x'), { params: { id: 'ENG-42' } })

    expect(res.status).toBe(404)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('returns 404 for a non-Linear identifier without calling Linear', async () => {
    process.env.LINEAR_API_KEY = 'lin_test'
    const fetcher = vi.fn()
    installFetchMock(fetcher as unknown as typeof fetch)

    const res = await GET(new Request('http://localhost/x'), { params: { id: 'not-a-linear-id' } })

    expect(res.status).toBe(404)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('returns title, description, labels and url on success', async () => {
    process.env.LINEAR_API_KEY = 'lin_test'
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            issue: {
              id: 'uuid-1',
              identifier: 'ENG-42',
              title: 'Add login flow',
              description: 'Detailed description.',
              url: 'https://linear.app/example/issue/ENG-42',
              labels: { nodes: [{ name: 'backend' }, { name: 'auth' }] },
            },
          },
        }),
        { status: 200 },
      ),
    )
    installFetchMock(fetcher as unknown as typeof fetch)

    const res = await GET(new Request('http://localhost/x'), { params: { id: 'ENG-42' } })

    expect(res.status).toBe(200)
    const body = await res.json() as {
      title: string
      description: string
      labels: string[]
      url: string
    }
    expect(body.title).toBe('Add login flow')
    expect(body.description).toBe('Detailed description.')
    expect(body.labels).toEqual(['backend', 'auth'])
    expect(body.url).toContain('linear.app')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('returns 404 when Linear reports the issue cannot be found', async () => {
    process.env.LINEAR_API_KEY = 'lin_test'
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({ errors: [{ message: 'Entity not found' }] }),
        { status: 200 },
      ),
    )
    installFetchMock(fetcher as unknown as typeof fetch)

    const res = await GET(new Request('http://localhost/x'), { params: { id: 'ENG-999' } })

    expect(res.status).toBe(404)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('returns 404 when the upstream fetch throws', async () => {
    process.env.LINEAR_API_KEY = 'lin_test'
    const fetcher = vi.fn(async () => { throw new Error('network down') })
    installFetchMock(fetcher as unknown as typeof fetch)

    const res = await GET(new Request('http://localhost/x'), { params: { id: 'ENG-42' } })

    expect(res.status).toBe(404)
  })
})
