/**
 * Scrub known secret patterns from a string before exposing it to external critics.
 * This is a defence-in-depth measure — the daily report builder must never embed secrets
 * in the first place, but we scrub anyway as a safety net.
 */
export function scrubSecrets(text: string): string {
  return text
    // Anthropic / OpenAI style keys: sk-<20+ chars>
    .replace(/sk-[a-zA-Z0-9_-]{20,}/g, '[API_KEY_REDACTED]')
    // xAI / Grok keys: xai-<20+ chars>
    .replace(/xai-[a-zA-Z0-9_-]{20,}/g, '[API_KEY_REDACTED]')
    // Generic key=value patterns for common secret names
    .replace(
      /(api[_-]?key|secret|token|password|passwd|credentials?)\s*[:=]\s*\S+/gi,
      '$1: [REDACTED]',
    )
    // Bearer tokens in Authorization headers (may appear in logs embedded in reports)
    .replace(/Bearer\s+[a-zA-Z0-9._-]{20,}/gi, 'Bearer [REDACTED]')
    // Env-var-style assignments: KEY=value (all-caps identifier)
    .replace(/\b[A-Z][A-Z0-9_]{4,}_(?:KEY|SECRET|TOKEN|PASSWORD)\s*=\s*\S+/g, '[ENV_SECRET_REDACTED]')
}

/**
 * Returns true when text contains patterns that look like unredacted secrets.
 * Used in tests / CI to assert a clean report.
 */
export function containsSecretPattern(text: string): boolean {
  const patterns = [
    /sk-[a-zA-Z0-9_-]{20,}/,
    /xai-[a-zA-Z0-9_-]{20,}/,
    /ANTHROPIC_API_KEY\s*[:=]\s*\S+/i,
    /LINEAR_API_KEY\s*[:=]\s*\S+/i,
    /XAI_API_KEY\s*[:=]\s*\S+/i,
    /NEXTAUTH_SECRET\s*[:=]\s*\S+/i,
    /Bearer\s+[a-zA-Z0-9._-]{20,}/i,
  ]
  return patterns.some(p => p.test(text))
}
