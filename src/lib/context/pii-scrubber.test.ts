import { describe, it, expect } from 'vitest'
import { scrubPII, scrubPIIBatch } from './pii-scrubber'

describe('scrubPII', () => {
  it('returns original text unchanged when no PII found', () => {
    const input = 'This is a safe text with no personal information.'
    const result = scrubPII(input)
    expect(result.scrubbed).toBe(input)
    expect(result.findings).toHaveLength(0)
    expect(result.wasModified).toBe(false)
    expect(result.totalRedacted).toBe(0)
  })

  it('detects and redacts email addresses', () => {
    const result = scrubPII('Contact me at alice@example.com for details.')
    expect(result.wasModified).toBe(true)
    expect(result.scrubbed).not.toContain('alice@example.com')
    expect(result.scrubbed).toContain('[EMAIL_REDACTED]')
    expect(result.findings.some(f => f.type === 'email')).toBe(true)
  })

  it('counts multiple emails in one text', () => {
    const result = scrubPII('From: bob@test.org, To: carol@company.de')
    expect(result.wasModified).toBe(true)
    const emailFinding = result.findings.find(f => f.type === 'email')
    expect(emailFinding?.count).toBeGreaterThanOrEqual(2)
  })

  it('detects and redacts German phone numbers', () => {
    const result = scrubPII('Ruf mich an: +49 151 12345678')
    expect(result.wasModified).toBe(true)
    expect(result.scrubbed).not.toContain('+49 151 12345678')
    expect(result.findings.some(f => f.type === 'phone')).toBe(true)
  })

  it('detects and redacts IBAN numbers', () => {
    const result = scrubPII('Bank account: DE89370400440532013000')
    expect(result.wasModified).toBe(true)
    expect(result.scrubbed).not.toContain('DE89370400440532013000')
    expect(result.findings.some(f => f.type === 'iban')).toBe(true)
  })

  it('detects and redacts JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const result = scrubPII(`Token: ${jwt}`)
    expect(result.wasModified).toBe(true)
    expect(result.scrubbed).not.toContain(jwt)
    expect(result.findings.some(f => f.type === 'jwt-token')).toBe(true)
  })

  it('detects and redacts IP addresses', () => {
    const result = scrubPII('Server at 192.168.1.100 is down')
    expect(result.wasModified).toBe(true)
    expect(result.scrubbed).not.toContain('192.168.1.100')
    expect(result.findings.some(f => f.type === 'ip-address')).toBe(true)
  })

  it('detects and redacts Anthropic API keys', () => {
    const result = scrubPII('Key: sk-ant-api03-ABCDEF1234567890abcdef1234567890ABCDEF1234567890-END')
    expect(result.wasModified).toBe(true)
    expect(result.findings.some(f => f.type === 'api-key')).toBe(true)
  })

  it('handles empty string gracefully', () => {
    const result = scrubPII('')
    expect(result.scrubbed).toBe('')
    expect(result.findings).toHaveLength(0)
    expect(result.wasModified).toBe(false)
    expect(result.totalRedacted).toBe(0)
  })

  it('handles multiple PII types in one text', () => {
    const input = 'User alice@example.com from IP 10.0.0.1, account DE89370400440532013000'
    const result = scrubPII(input)
    expect(result.wasModified).toBe(true)
    expect(result.findings.length).toBeGreaterThanOrEqual(2)
    expect(result.scrubbed).not.toContain('alice@example.com')
    expect(result.scrubbed).not.toContain('DE89370400440532013000')
  })

  it('totalRedacted counts all redacted instances', () => {
    const result = scrubPII('a@b.com and c@d.com')
    expect(result.totalRedacted).toBeGreaterThanOrEqual(2)
  })

  it('credentials in URLs are redacted (email part first)', () => {
    // Note: the email regex runs before url-with-credentials, so "user@host" in
    // the URL gets redacted as an email. Either way, credentials are scrubbed.
    const result = scrubPII('Webhook: https://admin:secret@api.example.com/hook')
    expect(result.wasModified).toBe(true)
    // Either the email or the URL pattern fires — credentials are gone
    expect(result.scrubbed).not.toContain('secret@api.example.com')
  })
})

describe('scrubPIIBatch', () => {
  it('processes multiple texts and returns scrubbed array', () => {
    const texts = [
      'Safe text without PII',
      'Contact: user@example.com',
      'IP: 192.168.0.1',
    ]
    const result = scrubPIIBatch(texts)
    expect(result.scrubbed).toHaveLength(3)
    expect(result.scrubbed[0]).toBe('Safe text without PII')
    expect(result.scrubbed[1]).toContain('[EMAIL_REDACTED]')
    expect(result.summary.wasModified).toBe(true)
  })

  it('handles empty array', () => {
    const result = scrubPIIBatch([])
    expect(result.scrubbed).toHaveLength(0)
    expect(result.summary.wasModified).toBe(false)
    expect(result.summary.totalRedacted).toBe(0)
  })

  it('summary.findings contains findings from all texts', () => {
    const texts = ['a@b.com', 'c@d.com', 'no pii here']
    const result = scrubPIIBatch(texts)
    const emailFindings = result.summary.findings.filter(f => f.type === 'email')
    const totalEmailCount = emailFindings.reduce((sum, f) => sum + f.count, 0)
    expect(totalEmailCount).toBeGreaterThanOrEqual(2)
  })

  it('returns combined scrubbed text in summary.scrubbed', () => {
    const texts = ['line one', 'line two']
    const result = scrubPIIBatch(texts)
    expect(result.summary.scrubbed).toContain('line one')
    expect(result.summary.scrubbed).toContain('line two')
  })
})

describe('budgetToMaxTurns', () => {
  it('converts $1 to 15 turns', async () => {
    const { budgetToMaxTurns } = await import('@/lib/budget-utils')
    expect(budgetToMaxTurns(1)).toBe(15)
  })

  it('caps at 60 turns for large budgets', async () => {
    const { budgetToMaxTurns } = await import('@/lib/budget-utils')
    expect(budgetToMaxTurns(100)).toBe(60)
  })

  it('enforces minimum of 5 turns for $0 budget', async () => {
    const { budgetToMaxTurns } = await import('@/lib/budget-utils')
    expect(budgetToMaxTurns(0)).toBe(5)
  })

  it('handles $5 budget (75 turns → capped at 60)', async () => {
    const { budgetToMaxTurns } = await import('@/lib/budget-utils')
    expect(budgetToMaxTurns(5)).toBe(60)
  })

  it('handles fractional budget $0.5 → 8 turns', async () => {
    const { budgetToMaxTurns } = await import('@/lib/budget-utils')
    expect(budgetToMaxTurns(0.5)).toBe(8)
  })
})
