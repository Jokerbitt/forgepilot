/**
 * error-classifier.ts — JOK-183: Structured error classification for delegations.
 *
 * Maps raw error strings to human-readable error classes with cause, next action,
 * and severity. Used by delegation detail UI and API error responses.
 * All functions are pure and never throw.
 */

export type ErrorClass =
  | 'provider-missing'
  | 'provider-offline'
  | 'turn-limit'
  | 'timeout'
  | 'auth-failed'
  | 'github-pr-failed'
  | 'linear-sync-failed'
  | 'tests-red'
  | 'scope-conflict'
  | 'budget-exceeded'
  | 'unknown'

export type ErrorSeverity = 'blocking' | 'warning' | 'info'

export interface ClassifiedError {
  /** Machine-readable error class */
  class: ErrorClass
  /** Short title shown in UI (German) */
  title: string
  /** One sentence: what caused this (German) */
  cause: string
  /** One concrete action Sven can take right now (German) */
  nextAction: string
  /** UI severity — blocking = red, warning = amber, info = blue */
  severity: ErrorSeverity
  /** Settings path or docs link if applicable */
  actionHref?: string
}

// ─── Pattern registry ────────────────────���────────────────────────────────────

interface Pattern {
  class: ErrorClass
  match: (msg: string) => boolean
}

const PATTERNS: Pattern[] = [
  // Provider / AI key missing
  {
    class: 'provider-missing',
    match: msg =>
      /no.?ai.?provider|noaiprovider|api.?key.?(missing|not.?set|invalid)|provider.?not.?configured/i.test(msg) ||
      /no.?provider.?available|provider.?unavailable|missing.?api.?key/i.test(msg),
  },
  // Local model / Ollama offline
  {
    class: 'provider-offline',
    match: msg =>
      /ollama|lm.?studio|local.?model.?offline|connection.?refused.*(11434|1234)/i.test(msg) ||
      /econnrefused.*127\.0\.0\.1|failed.?to.?connect.*local/i.test(msg),
  },
  // Turn / context limit
  {
    class: 'turn-limit',
    match: msg =>
      /turn.?limit|max_turns|maximum.?turns|max.?steps.?exceeded|context.?window.?exceeded/i.test(msg),
  },
  // Execution timeout
  {
    class: 'timeout',
    match: msg =>
      /timeout|timed.?out|execution.?exceeded|request.?timed/i.test(msg),
  },
  // Auth / permissions
  {
    class: 'auth-failed',
    match: msg =>
      /401|403|unauthorized|forbidden|authentication.?failed|invalid.?token|bad.?credentials/i.test(msg),
  },
  // GitHub PR errors
  {
    class: 'github-pr-failed',
    match: msg =>
      /github.*pr|pull.?request.*fail|push.*rejected|branch.*exists|merge.?conflict/i.test(msg),
  },
  // Linear sync errors
  {
    class: 'linear-sync-failed',
    match: msg =>
      /linear.*(error|fail|sync)|could.?not.?update.*linear|linear.*not.?reachable/i.test(msg),
  },
  // Tests failing
  {
    class: 'tests-red',
    match: msg =>
      /tests?.?(fail|red|error|broken)|npm.?test.*fail|vitest.*fail|jest.*fail|\d+.?test.?(fail|error)/i.test(msg),
  },
  // Scope / lock conflict
  {
    class: 'scope-conflict',
    match: msg =>
      /scope.?conflict|write.?scope|scope.?lock|another.?agent|locked.?by/i.test(msg),
  },
  // Budget exceeded
  {
    class: 'budget-exceeded',
    match: msg =>
      /budget.?exceeded|cost.?limit|max.?budget|spending.?limit/i.test(msg),
  },
]

// ─── Descriptions per error class ──────────────────────────���─────────────────

const DESCRIPTIONS: Record<ErrorClass, Omit<ClassifiedError, 'class'>> = {
  'provider-missing': {
    title:      'Kein KI-Provider konfiguriert',
    cause:      'Es ist kein aktiver API-Key oder Provider hinterlegt, den der Runner nutzen kann.',
    nextAction: 'Settings öffnen und einen Provider mit API-Key einrichten.',
    severity:   'blocking',
    actionHref: '/settings#ai-provider',
  },
  'provider-offline': {
    title:      'Lokaler KI-Server nicht erreichbar',
    cause:      'Ollama oder LM Studio läuft nicht oder ist auf dem falschen Port.',
    nextAction: '`ollama serve` im Terminal starten oder LM Studio öffnen.',
    severity:   'blocking',
    actionHref: '/settings#ai-provider',
  },
  'turn-limit': {
    title:      'Agent hat Arbeitsfenster überschritten',
    cause:      'Die Aufgabe war zu groß oder zu offen — der Agent hat das Schritt-Limit erreicht.',
    nextAction: 'Aufgabe in kleinere Teilziele zerlegen oder mit höherem Budget erneut starten.',
    severity:   'warning',
  },
  'timeout': {
    title:      'Ausführung Timeout',
    cause:      'Der Runner hat die maximale Ausführungszeit überschritten.',
    nextAction: 'Aufgabe vereinfachen oder den Budget-Wert erhöhen und erneut starten.',
    severity:   'warning',
  },
  'auth-failed': {
    title:      'Authentifizierung fehlgeschlagen',
    cause:      'GitHub, Linear oder ein anderer Dienst hat den Token abgelehnt.',
    nextAction: 'API-Keys in den Settings prüfen und ggf. erneuern.',
    severity:   'blocking',
    actionHref: '/settings#api-keys',
  },
  'github-pr-failed': {
    title:      'GitHub PR konnte nicht erstellt werden',
    cause:      'Der Branch existiert bereits, die Änderungen wurden rejected, oder es gibt einen Merge-Konflikt.',
    nextAction: 'GitHub öffnen, Branch-Status prüfen und manuell mergen oder Konflikt auflösen.',
    severity:   'blocking',
  },
  'linear-sync-failed': {
    title:      'Linear Sync fehlgeschlagen',
    cause:      'Linear ist nicht erreichbar oder der API-Key ist ungültig.',
    nextAction: 'Linear API-Key in Settings prüfen. Der Task-Status kann manuell in Linear gesetzt werden.',
    severity:   'warning',
    actionHref: '/settings#api-keys',
  },
  'tests-red': {
    title:      'Tests schlagen fehl',
    cause:      'Die Test-Suite ist rot — der Agent konnte den Task nicht fehlerfrei abschließen.',
    nextAction: 'Logs lesen, die fehlerhaften Tests identifizieren und die Delegation mit spezifischeren Anweisungen erneut starten.',
    severity:   'blocking',
  },
  'scope-conflict': {
    title:      'Scope-Konflikt',
    cause:      'Ein anderer Prozess hält denselben Write-Scope — zwei Delegationen würden dieselben Dateien verändern.',
    nextAction: 'Warten bis die laufende Delegation abgeschlossen ist, dann erneut starten.',
    severity:   'warning',
  },
  'budget-exceeded': {
    title:      'Budget überschritten',
    cause:      'Die geschätzten Kosten überschreiten das eingestellte Ausführungs-Budget.',
    nextAction: 'Budget in der Delegation erhöhen oder Aufgabe in kleinere Teile aufteilen.',
    severity:   'warning',
  },
  'unknown': {
    title:      'Unbekannter Fehler',
    cause:      'Ein unerwarteter Fehler ist aufgetreten.',
    nextAction: 'Logs prüfen und die Delegation erneut starten. Bei Wiederholung den Support kontaktieren.',
    severity:   'warning',
  },
}

// ─── Public API ──────────────────────────────��─────────────────────────��──────

/**
 * Classify an error message string into a structured ClassifiedError.
 * Returns an 'unknown' classification when no pattern matches.
 */
export function classifyError(errorMessage: string): ClassifiedError {
  if (!errorMessage?.trim()) {
    return { class: 'unknown', ...DESCRIPTIONS['unknown'] }
  }

  for (const pattern of PATTERNS) {
    if (pattern.match(errorMessage)) {
      return { class: pattern.class, ...DESCRIPTIONS[pattern.class] }
    }
  }

  return { class: 'unknown', ...DESCRIPTIONS['unknown'] }
}

/**
 * Classify an error message and return only the most actionable fields.
 * Convenience wrapper for API responses that need a minimal payload.
 */
export function classifyErrorSummary(
  errorMessage: string,
): Pick<ClassifiedError, 'class' | 'title' | 'nextAction' | 'severity'> {
  const { class: cls, title, nextAction, severity } = classifyError(errorMessage)
  return { class: cls, title, nextAction, severity }
}
