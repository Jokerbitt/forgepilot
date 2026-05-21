import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { verifyWebhookSignature } from './hmac'

function makeSignature(payload: string, secret: string): string {
  const hex = createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
  return `sha256=${hex}`
}

describe('verifyWebhookSignature', () => {
  const secret = 'test-secret-abc123'
  const payload = '{"event":"test","data":{}}'

  it('returns true when no secret is configured (open mode)', () => {
    expect(verifyWebhookSignature(payload, null, undefined)).toBe(true)
    expect(verifyWebhookSignature(payload, 'anything', undefined)).toBe(true)
  })

  it('returns false when secret is set but signature is missing', () => {
    expect(verifyWebhookSignature(payload, null, secret)).toBe(false)
  })

  it('returns true for valid sha256= signature', () => {
    const sig = makeSignature(payload, secret)
    expect(verifyWebhookSignature(payload, sig, secret)).toBe(true)
  })

  it('returns true for valid signature without sha256= prefix', () => {
    const hex = createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
    expect(verifyWebhookSignature(payload, hex, secret)).toBe(true)
  })

  it('returns false for wrong secret', () => {
    const sig = makeSignature(payload, 'wrong-secret')
    expect(verifyWebhookSignature(payload, sig, secret)).toBe(false)
  })

  it('returns false for tampered payload', () => {
    const sig = makeSignature(payload, secret)
    expect(verifyWebhookSignature('{"tampered":true}', sig, secret)).toBe(false)
  })

  it('returns false for invalid hex signature', () => {
    expect(verifyWebhookSignature(payload, 'sha256=not-valid-hex!@#', secret)).toBe(false)
  })
})
