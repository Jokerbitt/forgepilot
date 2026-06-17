// Input guardrails for LLM prompts: sanitization + prompt-injection heuristics.
// Destination: src/lib/ai/guardrails/input-validation.ts

/**
 * Matches C0 control chars (U+0000–U+001F) and C1 / DEL (U+007F–U+009F),
 * while preserving tab (U+0009) and newline (U+000A). Built from a source
 * string so this file stays pure ASCII.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp(
  '[\\u0000-\\u0008\\u000B-\\u001F\\u007F-\\u009F]',
  'g',
);

/**
 * Normalize untrusted prompt text before sending it to a model:
 * - strips control characters (keeps \n and \t),
 * - trims surrounding whitespace,
 * - caps length to `maxChars` (truncates the tail).
 */
export function sanitizePrompt(raw: string, maxChars: number): string {
  const stripped = raw.replace(CONTROL_CHARS, '');
  const trimmed = stripped.trim();
  return trimmed.length > maxChars ? trimmed.slice(0, maxChars) : trimmed;
}

/**
 * Common prompt-injection / jailbreak phrases. Heuristic only — this is a
 * signal for logging/review, not a hard security boundary.
 */
const INJECTION_PATTERNS: ReadonlyArray<RegExp> = [
  /ignore (?:all |the )?(?:previous|prior|above) instructions/i,
  /disregard (?:all |the )?(?:previous|prior|above)/i,
  /forget (?:everything|all previous|your instructions)/i,
  /system prompt/i,
  /you are now (?:a|an|in)/i,
  /act as (?:if|though|a|an)/i,
  /developer mode/i,
  /\bDAN\b/,
  /reveal (?:your |the )?(?:system|hidden) (?:prompt|instructions)/i,
  /override (?:your |the )?(?:safety|guardrails|rules)/i,
];

/**
 * Scan text for known injection phrases. Returns the matched fragments so the
 * caller can log or surface them.
 */
export function detectPromptInjection(text: string): {
  suspicious: boolean;
  matches: string[];
} {
  const matches: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    const m = text.match(pattern);
    if (m) matches.push(m[0]);
  }
  return { suspicious: matches.length > 0, matches };
}
