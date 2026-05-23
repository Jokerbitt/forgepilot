import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    readFileSync: vi.fn(() => '{}'),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
  aiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}))

describe('Cohere provider', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('is registered in the catalog with correct baseUrl', async () => {
    const { BUILT_IN_PROVIDER_CONFIGS } = await import('../catalog')
    const cohere = BUILT_IN_PROVIDER_CONFIGS.find(c => c.id === 'cohere')
    expect(cohere).toBeDefined()
    expect(cohere?.baseUrl).toBe('https://api.cohere.com/compatibility/v1')
    expect(cohere?.apiKeyRef).toBe('COHERE_API_KEY')
    expect(cohere?.type).toBe('openai-compatible')
  })

  it('is registered in the provider registry', async () => {
    const { getProviderInstance } = await import('../registry')
    const provider = getProviderInstance('cohere')
    expect(provider).toBeDefined()
  })

  it('is unavailable when COHERE_API_KEY is not set', async () => {
    delete process.env.COHERE_API_KEY
    const { getProviderInstance } = await import('../registry')
    const provider = getProviderInstance('cohere')
    expect(provider).toBeDefined()
    const available = await provider!.isAvailable()
    expect(available).toBe(false)
  })

  it('has at least one Command R model in the catalog', async () => {
    const { BUILT_IN_PROVIDER_CONFIGS } = await import('../catalog')
    const cohere = BUILT_IN_PROVIDER_CONFIGS.find(c => c.id === 'cohere')
    expect(cohere?.models.length).toBeGreaterThan(0)
    const hasCommandR = cohere?.models.some(m => m.id.toLowerCase().includes('command'))
    expect(hasCommandR).toBe(true)
  })

  it('has a free tier entry', async () => {
    const { BUILT_IN_PROVIDER_CONFIGS } = await import('../catalog')
    const cohere = BUILT_IN_PROVIDER_CONFIGS.find(c => c.id === 'cohere')
    expect(cohere?.freeTier).toBeDefined()
    expect(cohere?.freeTier?.signupUrl).toContain('cohere')
  })
})

describe('Fireworks AI provider', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('is registered in the catalog with correct baseUrl', async () => {
    const { BUILT_IN_PROVIDER_CONFIGS } = await import('../catalog')
    const fireworks = BUILT_IN_PROVIDER_CONFIGS.find(c => c.id === 'fireworks')
    expect(fireworks).toBeDefined()
    expect(fireworks?.baseUrl).toBe('https://api.fireworks.ai/inference/v1')
    expect(fireworks?.apiKeyRef).toBe('FIREWORKS_API_KEY')
    expect(fireworks?.type).toBe('openai-compatible')
  })

  it('is registered in the provider registry', async () => {
    const { getProviderInstance } = await import('../registry')
    const provider = getProviderInstance('fireworks')
    expect(provider).toBeDefined()
  })

  it('is unavailable when FIREWORKS_API_KEY is not set', async () => {
    delete process.env.FIREWORKS_API_KEY
    const { getProviderInstance } = await import('../registry')
    const provider = getProviderInstance('fireworks')
    expect(provider).toBeDefined()
    const available = await provider!.isAvailable()
    expect(available).toBe(false)
  })

  it('has Llama 3 models in the catalog', async () => {
    const { BUILT_IN_PROVIDER_CONFIGS } = await import('../catalog')
    const fireworks = BUILT_IN_PROVIDER_CONFIGS.find(c => c.id === 'fireworks')
    expect(fireworks?.models.length).toBeGreaterThan(0)
    const hasLlama = fireworks?.models.some(m => m.id.toLowerCase().includes('llama'))
    expect(hasLlama).toBe(true)
  })

  it('has a free tier entry', async () => {
    const { BUILT_IN_PROVIDER_CONFIGS } = await import('../catalog')
    const fireworks = BUILT_IN_PROVIDER_CONFIGS.find(c => c.id === 'fireworks')
    expect(fireworks?.freeTier).toBeDefined()
    expect(fireworks?.freeTier?.signupUrl).toContain('fireworks')
  })
})
