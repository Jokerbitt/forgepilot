import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

const store = { data: '{}' }

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => store.data),
    writeFileSync: vi.fn((_file: string, data: string) => {
      store.data = data
    }),
    renameSync: vi.fn(),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  },
}))

describe('/api/api-keys', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    store.data = '{}'
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('reports env-provided keys as configured', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-1234'
    process.env.GITHUB_TOKEN = 'ghp_test_1234'

    const response = await GET()
    const data = await response.json()

    expect(data._set.ANTHROPIC_API_KEY).toBe(true)
    expect(data._set.GITHUB_TOKEN).toBe(true)
    expect(data._source.ANTHROPIC_API_KEY).toBe('env')
    expect(data.ANTHROPIC_API_KEY).toContain('1234')
  })

  it('stored keys take precedence over env keys', async () => {
    store.data = JSON.stringify({ LINEAR_API_KEY: 'stored-linear-9999' })
    process.env.LINEAR_API_KEY = 'env-linear-1234'

    const response = await GET()
    const data = await response.json()

    expect(data._source.LINEAR_API_KEY).toBe('stored')
    expect(data.LINEAR_API_KEY).toContain('9999')
  })

  it('keeps env fallback after clearing a stored key', async () => {
    store.data = JSON.stringify({ GITHUB_TOKEN: 'stored-token-9999' })
    process.env.GITHUB_TOKEN = 'env-token-1234'

    const response = await POST(new Request('http://localhost/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ GITHUB_TOKEN: '' }),
    }))
    const data = await response.json()

    expect(data._set.GITHUB_TOKEN).toBe(true)
  })

  it('stores critic routing config without exposing secret values', async () => {
    const response = await POST(new Request('http://localhost/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({
        XAI_API_KEY: 'xai-secret-9999',
        FORGEPILOT_CRITIC_MODE: 'local-first',
        FORGEPILOT_CRITIC_PROVIDERS: 'grok:grok-3-mini,ollama:qwen2.5-coder:14b',
      }),
    }))
    const postData = await response.json()
    expect(postData._set.XAI_API_KEY).toBe(true)
    expect(postData._set.FORGEPILOT_CRITIC_MODE).toBe(true)

    const getResponse = await GET()
    const data = await getResponse.json()

    expect(data.XAI_API_KEY).toContain('9999')
    expect(data.XAI_API_KEY).not.toContain('xai-secret')
    expect(data.FORGEPILOT_CRITIC_MODE).toBe('local-first')
    expect(data.FORGEPILOT_CRITIC_PROVIDERS).toBe('grok:grok-3-mini,ollama:qwen2.5-coder:14b')
  })
})
