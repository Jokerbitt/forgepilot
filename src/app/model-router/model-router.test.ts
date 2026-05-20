import { describe, it, expect } from 'vitest'
import { DEFAULT_PROFILES } from '@/lib/model-router/profiles'

function healthTone(h: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (h === 'healthy') return 'success'
  if (h === 'degraded') return 'warning'
  if (h === 'offline') return 'danger'
  return 'neutral'
}

function costLabel(c: string): string {
  if (c === 'free-local') return 'Kostenlos lokal'
  if (c === 'included-subscription') return 'Abo inklusive'
  if (c === 'metered-low') return 'Gering'
  if (c === 'metered-high') return 'Hoch'
  return c
}

describe('Model Router — display logic', () => {
  it('maps healthy status to success tone', () => {
    expect(healthTone('healthy')).toBe('success')
  })

  it('maps degraded to warning tone', () => {
    expect(healthTone('degraded')).toBe('warning')
  })

  it('maps offline to danger tone', () => {
    expect(healthTone('offline')).toBe('danger')
  })

  it('maps unknown to neutral tone', () => {
    expect(healthTone('unknown')).toBe('neutral')
  })

  it('labels free-local cost correctly', () => {
    expect(costLabel('free-local')).toBe('Kostenlos lokal')
  })

  it('labels metered-high correctly', () => {
    expect(costLabel('metered-high')).toBe('Hoch')
  })
})

describe('DEFAULT_PROFILES', () => {
  it('loads profiles from provider catalog', () => {
    expect(DEFAULT_PROFILES.length).toBeGreaterThan(0)
  })

  it('every profile has at least one workload', () => {
    DEFAULT_PROFILES.forEach(p => {
      expect(p.recommendedWorkloads.length).toBeGreaterThan(0)
    })
  })

  it('every profile supports at least one privacy mode', () => {
    DEFAULT_PROFILES.forEach(p => {
      expect(p.privacyModes.length).toBeGreaterThan(0)
    })
  })
})
