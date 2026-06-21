// PII scrubber: redact emails, phones, credit cards and IBANs before logging
// or sending text to a third-party model.
// Destination: src/lib/ai/guardrails/pii-scrubber.ts

interface PiiRule {
  label: string;
  pattern: RegExp;
  placeholder: string;
}

/**
 * Regex rules, applied in order. Patterns are intentionally conservative —
 * they aim to catch the common shapes, not every theoretical variant. Order
 * matters: credit cards run before generic digit runs would, etc.
 */
const RULES: ReadonlyArray<PiiRule> = [
  {
    // RFC-ish email: local@domain.tld
    label: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    placeholder: '[EMAIL]',
  },
  {
    // IBAN: 2 letters, 2 check digits, up to 30 alphanumerics (optionally
    // grouped in fours). Run before phone/card so it isn't partially eaten.
    label: 'iban',
    pattern: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g,
    placeholder: '[IBAN]',
  },
  {
    // Credit-card-like: 13–16 digits, optionally separated by space or dash.
    label: 'credit_card',
    pattern: /\b(?:\d[ -]?){13,16}\b/g,
    placeholder: '[CARD]',
  },
  {
    // Phone: optional +, country/area code, 7+ digits with common separators.
    label: 'phone',
    pattern: /(?:\+\d{1,3}[ -]?)?(?:\(\d{1,4}\)[ -]?)?\d{2,4}(?:[ -]?\d{2,4}){2,4}/g,
    placeholder: '[PHONE]',
  },
];

/**
 * Replace PII in `text` with stable placeholders.
 * Returns the scrubbed text plus the labels of every category that matched
 * (deduplicated), so callers can log "found: email, phone" without leaking
 * the values themselves.
 */
export function scrubPII(text: string): { scrubbed: string; found: string[] } {
  let scrubbed = text;
  const found = new Set<string>();

  for (const rule of RULES) {
    // Reset lastIndex defensively (rules use the /g flag).
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(scrubbed)) {
      found.add(rule.label);
      rule.pattern.lastIndex = 0;
      scrubbed = scrubbed.replace(rule.pattern, rule.placeholder);
    }
  }

  return { scrubbed, found: [...found] };
}
