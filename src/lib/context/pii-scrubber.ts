/**
 * PII Scrubber — DSGVO Art. 5 (Datensparsamkeit)
 *
 * Scans text for Personally Identifiable Information and replaces it
 * with neutral placeholders BEFORE any text is sent to an external AI API.
 *
 * Works entirely offline — no external service, no extra latency.
 * Findings are logged for the DSGVO Processing Ledger (M88).
 */

export type PIIType =
  | 'email'
  | 'phone'
  | 'iban'
  | 'ip-address'
  | 'url-with-credentials'
  | 'german-id'
  | 'credit-card'
  | 'jwt-token'
  | 'api-key'
  | 'ssh-key'

export interface PIIFinding {
  type: PIIType
  count: number
  placeholder: string
}

export interface ScrubResult {
  scrubbed: string
  findings: PIIFinding[]
  totalRedacted: number
  wasModified: boolean
}

const PII_PATTERNS: Array<{
  type: PIIType
  regex: RegExp
  placeholder: string
}> = [
  // JWT tokens (before email — greedy)
  {
    type: 'jwt-token',
    regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    placeholder: '[JWT_REDACTED]',
  },
  // API keys / secrets (sk-, ghp_, lin_api_, sk-ant-, AIza, etc.)
  {
    type: 'api-key',
    regex: /\b(?:sk-ant-api\d+|sk-proj-|ghp_|gho_|ghu_|ghs_|ghr_|lin_api_|AIza|sk-[a-zA-Z0-9]{32,})[a-zA-Z0-9_\-\.]{10,}/g,
    placeholder: '[API_KEY_REDACTED]',
  },
  // SSH private keys
  {
    type: 'ssh-key',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    placeholder: '[SSH_KEY_REDACTED]',
  },
  // Credit card numbers (Luhn-like patterns)
  {
    type: 'credit-card',
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    placeholder: '[CREDITCARD_REDACTED]',
  },
  // IBAN (DE, AT, CH, etc.)
  {
    type: 'iban',
    regex: /\b[A-Z]{2}\d{2}[\s]?(?:\d{4}[\s]?){3,6}\d{1,4}\b/g,
    placeholder: '[IBAN_REDACTED]',
  },
  // URLs with credentials (http://user:pass@host) — must run before email
  {
    type: 'url-with-credentials',
    regex: /https?:\/\/[^@\s]+:[^@\s]+@[^\s]+/g,
    placeholder: '[URL_WITH_CREDENTIALS_REDACTED]',
  },
  // Email addresses
  {
    type: 'email',
    regex: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
    placeholder: '[EMAIL_REDACTED]',
  },
  // German/Austrian phone numbers
  {
    type: 'phone',
    regex: /(?:\+49|0049|\+43|0043|\+41|0041)[\s\-]?(?:\(?\d{2,5}\)?[\s\-]?\d{3,8}[\s\-]?\d{0,6})/g,
    placeholder: '[PHONE_REDACTED]',
  },
  // IP addresses (IPv4)
  {
    type: 'ip-address',
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    placeholder: '[IP_REDACTED]',
  },
  // German ID / Passport numbers
  {
    type: 'german-id',
    regex: /\b[CFGHJKLMNPRTVWXYZ][CFGHJKLMNPRTVWXYZ0-9]{8}\b/g,
    placeholder: '[ID_REDACTED]',
  },
]

/**
 * Scrub PII from text before sending to an external AI API.
 * Returns the cleaned text plus a summary of what was redacted.
 */
export function scrubPII(text: string): ScrubResult {
  const findingsMap = new Map<PIIType, number>()
  let scrubbed = text

  for (const { type, regex, placeholder } of PII_PATTERNS) {
    regex.lastIndex = 0
    const matches = scrubbed.match(regex)
    if (matches && matches.length > 0) {
      findingsMap.set(type, (findingsMap.get(type) ?? 0) + matches.length)
      scrubbed = scrubbed.replace(regex, placeholder)
    }
  }

  const findings: PIIFinding[] = Array.from(findingsMap.entries()).map(([type, count]) => ({
    type,
    count,
    placeholder: PII_PATTERNS.find(p => p.type === type)?.placeholder ?? '[REDACTED]',
  }))

  const totalRedacted = findings.reduce((sum, f) => sum + f.count, 0)

  return {
    scrubbed,
    findings,
    totalRedacted,
    wasModified: totalRedacted > 0,
  }
}

/**
 * Scrub an array of strings (e.g. context layers) and return
 * the combined scrub result.
 */
export function scrubPIIBatch(texts: string[]): { scrubbed: string[]; summary: ScrubResult } {
  const allFindings: PIIFinding[] = []
  const scrubbed = texts.map(t => {
    const r = scrubPII(t)
    allFindings.push(...r.findings)
    return r.scrubbed
  })

  const totalRedacted = allFindings.reduce((sum, f) => sum + f.count, 0)

  return {
    scrubbed,
    summary: {
      scrubbed: scrubbed.join('\n'),
      findings: allFindings,
      totalRedacted,
      wasModified: totalRedacted > 0,
    },
  }
}
