import { describe, it, expect, beforeEach } from 'vitest'

// ─── Helpers mirroring OnboardingBanner logic ─────────────────────────────────

const STORAGE_KEY = 'fp_onboarding_dismissed'

interface EmptyCheckData {
  delegations: unknown[]
  briefs: unknown[]
  research: unknown[]
}

function isDismissed(storage: Map<string, string>): boolean {
  return storage.get(STORAGE_KEY) === 'true'
}

function shouldShowBanner(data: EmptyCheckData, storage: Map<string, string>): boolean {
  if (isDismissed(storage)) return false
  return data.delegations.length === 0 && data.briefs.length === 0 && data.research.length === 0
}

function dismissBanner(storage: Map<string, string>): void {
  storage.set(STORAGE_KEY, 'true')
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OnboardingBanner logic', () => {
  let storage: Map<string, string>

  beforeEach(() => {
    storage = new Map()
  })

  it('shows banner when all data is empty and not dismissed', () => {
    const emptyData: EmptyCheckData = {
      delegations: [],
      briefs: [],
      research: [],
    }

    expect(shouldShowBanner(emptyData, storage)).toBe(true)
  })

  it('hides banner after dismiss click and persists in storage', () => {
    const emptyData: EmptyCheckData = {
      delegations: [],
      briefs: [],
      research: [],
    }

    // Initially visible
    expect(shouldShowBanner(emptyData, storage)).toBe(true)

    // User dismisses
    dismissBanner(storage)

    // Now hidden
    expect(shouldShowBanner(emptyData, storage)).toBe(false)
    expect(isDismissed(storage)).toBe(true)
    expect(storage.get(STORAGE_KEY)).toBe('true')
  })

  it('does not show banner when delegations exist', () => {
    const dataWithDelegations: EmptyCheckData = {
      delegations: [{ id: 'del-1' }],
      briefs: [],
      research: [],
    }

    expect(shouldShowBanner(dataWithDelegations, storage)).toBe(false)
  })

  it('does not show banner when briefs exist', () => {
    const dataWithBriefs: EmptyCheckData = {
      delegations: [],
      briefs: [{ id: 'brief-1' }],
      research: [],
    }

    expect(shouldShowBanner(dataWithBriefs, storage)).toBe(false)
  })

  it('does not show banner when research docs exist', () => {
    const dataWithResearch: EmptyCheckData = {
      delegations: [],
      briefs: [],
      research: [{ id: 'research-1' }],
    }

    expect(shouldShowBanner(dataWithResearch, storage)).toBe(false)
  })

  it('uses correct storage key fp_onboarding_dismissed', () => {
    const emptyData: EmptyCheckData = { delegations: [], briefs: [], research: [] }

    dismissBanner(storage)

    // Verify exact key used
    expect(storage.has('fp_onboarding_dismissed')).toBe(true)
    expect(shouldShowBanner(emptyData, storage)).toBe(false)
  })
})
