import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getRiskCApprovers,
  isAuthorizedRiskCApprover,
  validateRiskCApproval,
} from './risk-c-approval'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getRiskCApprovers', () => {
  it('returns an empty list when unset (fail-closed: nobody authorized)', () => {
    vi.stubEnv('FORGEPILOT_RISK_C_APPROVERS', '')
    expect(getRiskCApprovers()).toEqual([])
  })

  it('parses, trims and lowercases a comma-separated list', () => {
    vi.stubEnv('FORGEPILOT_RISK_C_APPROVERS', ' Sven , admin-01 ,, ')
    expect(getRiskCApprovers()).toEqual(['sven', 'admin-01'])
  })
})

describe('isAuthorizedRiskCApprover', () => {
  it('matches case-insensitively', () => {
    vi.stubEnv('FORGEPILOT_RISK_C_APPROVERS', 'sven')
    expect(isAuthorizedRiskCApprover('SVEN')).toBe(true)
    expect(isAuthorizedRiskCApprover('sven')).toBe(true)
  })

  it('rejects unknown actors and empty input', () => {
    vi.stubEnv('FORGEPILOT_RISK_C_APPROVERS', 'sven')
    expect(isAuthorizedRiskCApprover('mallory')).toBe(false)
    expect(isAuthorizedRiskCApprover('')).toBe(false)
  })

  it('authorizes nobody when the allowlist is empty', () => {
    vi.stubEnv('FORGEPILOT_RISK_C_APPROVERS', '')
    expect(isAuthorizedRiskCApprover('sven')).toBe(false)
  })
})

describe('validateRiskCApproval', () => {
  it('accepts an allowlisted human actor with a reason', () => {
    vi.stubEnv('FORGEPILOT_RISK_C_APPROVERS', 'sven')
    expect(validateRiskCApproval('sven', 'reviewed schema migration manually')).toEqual({ ok: true })
  })

  it('requires a non-empty reason (400)', () => {
    vi.stubEnv('FORGEPILOT_RISK_C_APPROVERS', 'sven')
    const result = validateRiskCApproval('sven', '   ')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
      expect(result.error).toContain('Begründung')
    }
  })

  it('rejects an automated actor even with a reason (403, ADR-003 D2)', () => {
    vi.stubEnv('FORGEPILOT_RISK_C_APPROVERS', 'sven,autonomous-mode')
    const result = validateRiskCApproval('autonomous-mode', 'auto')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.error).toContain('menschliche')
    }
  })

  it('rejects a human actor who is not on the allowlist (403, ADR-004 E1)', () => {
    vi.stubEnv('FORGEPILOT_RISK_C_APPROVERS', 'sven')
    const result = validateRiskCApproval('mallory', 'looks fine to me')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.error).toContain('nicht für Risk-C-Freigaben autorisiert')
    }
  })

  it('fails closed when no allowlist is configured', () => {
    vi.stubEnv('FORGEPILOT_RISK_C_APPROVERS', '')
    const result = validateRiskCApproval('sven', 'reason')
    expect(result.ok).toBe(false)
  })
})
