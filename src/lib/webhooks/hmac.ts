import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verify an HMAC-SHA256 webhook signature.
 * Signature format: "sha256=<hex-digest>"
 *
 * Returns true if:
 * - INTAKE_WEBHOOK_SECRET is not set (open mode — backwards compatible)
 * - Signature matches the payload
 *
 * Returns false if:
 * - INTAKE_WEBHOOK_SECRET is set but signature is missing or invalid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string | undefined
): boolean {
  // If no secret configured, allow all requests (backwards compatible)
  if (!secret) return true

  // If secret is configured, signature is required
  if (!signature) return false

  // Support "sha256=<hex>" format (GitHub/Linear style)
  const sigBody = signature.startsWith('sha256=') ? signature.slice(7) : signature

  try {
    const expected = createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex')

    const expectedBuf = Buffer.from(expected, 'hex')
    const actualBuf = Buffer.from(sigBody, 'hex')

    // Buffers must be same length for timingSafeEqual
    if (expectedBuf.length !== actualBuf.length) return false

    return timingSafeEqual(expectedBuf, actualBuf)
  } catch {
    return false
  }
}
