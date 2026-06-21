/**
 * error-classifier.ts — Translates raw agent/CLI error output into
 * human-readable German messages with specific fix instructions.
 *
 * M4: Reliable Execute Loop — no more "exit code 1" dead-ends.
 */

export type ErrorSeverity = 'critical' | 'warning' | 'info'
export type ErrorCategory =
  | 'auth'           // API keys, login, tokens
  | 'billing'        // quota exhausted, credit balance
  | 'rate_limit'     // too many requests
  | 'network'        // connectivity, DNS, timeouts
  | 'tool_missing'   // claude, git, gh, npm not found
  | 'git'            // merge conflicts, branch issues
  | 'build'          // compile errors, type errors
  | 'test'           // test failures
  | 'budget'         // max turns, cost limit
  | 'process'        // OOM, killed, timeout
  | 'workspace'      // path not found, permissions
  | 'unknown'

export interface ClassifiedError {
  category: ErrorCategory
  severity: ErrorSeverity
  /** Short German title shown in the UI */
  title: string
  /** Detailed German explanation */
  detail: string
  /** Specific actionable fix the user can take */
  fix: string
  /** Path to fix in ForgePilot (if applicable) */
  fixHref?: string
  /** Raw matched pattern (for debugging) */
  matchedPattern?: string
}

interface ErrorPattern {
  category: ErrorCategory
  severity: ErrorSeverity
  patterns: RegExp[]
  title: string
  detail: string
  fix: string
  fixHref?: string
}

// ─── Pattern definitions (order matters — first match wins) ──────────────────

const ERROR_PATTERNS: ErrorPattern[] = [
  // ── Billing / Quota ─────────────────────────────────────────────────────────
  {
    category: 'billing',
    severity: 'critical',
    patterns: [
      /credit balance|insufficient.quota|billing|your account|payment/i,
      /anthropic.*quota|quota.*anthropic/i,
    ],
    title: 'Anthropic-Guthaben aufgebraucht',
    detail: 'Das Anthropic-Konto hat kein Guthaben mehr oder die API-Quote ist erschöpft.',
    fix: 'Konto unter console.anthropic.com aufladen oder auf Claude Max wechseln.',
    fixHref: '/settings',
  },

  // ── Authentication / API Keys ────────────────────────────────────────────────
  {
    category: 'auth',
    severity: 'critical',
    patterns: [
      /invalid x-api-key|api_key_invalid|api key.*invalid|invalid.*api.?key/i,
      /authentication.*failed|unauthorized.*anthropic/i,
    ],
    title: 'Anthropic API Key ungültig',
    detail: 'Der API Key ist falsch, abgelaufen oder wurde widerrufen.',
    fix: 'API Key in den Einstellungen prüfen und ggf. neu generieren unter platform.anthropic.com.',
    fixHref: '/settings',
  },
  {
    category: 'auth',
    severity: 'critical',
    patterns: [
      /not logged in|please log in|claude.*login|run.*claude.*login/i,
      /authentication required.*claude|claude.*not authenticated/i,
    ],
    title: 'Claude Code nicht angemeldet',
    detail: 'Claude Code CLI ist installiert, aber du bist nicht eingeloggt.',
    fix: 'Im Terminal: claude login — dann erneut versuchen.',
    fixHref: '/settings',
  },
  {
    category: 'auth',
    severity: 'critical',
    patterns: [
      /github.*token|ghp_.*invalid|bad credentials|requires authentication.*github/i,
      /git.*authentication.*failed|remote.*authentication.*failed/i,
    ],
    title: 'GitHub Token fehlt oder ungültig',
    detail: 'GitHub-Operationen (Push, PR, Clone) schlagen fehl weil kein gültiger Token konfiguriert ist.',
    fix: 'GitHub Token in den Einstellungen eintragen. Benötigte Rechte: repo, workflow.',
    fixHref: '/settings',
  },
  {
    category: 'auth',
    severity: 'warning',
    patterns: [
      /linear.*token|linear.*api.*key/i,
    ],
    title: 'Linear API Key fehlt',
    detail: 'Linear-Integration nicht konfiguriert — Ticket-Kommentare werden nicht geschrieben.',
    fix: 'Linear API Key in den Einstellungen eintragen (optional).',
    fixHref: '/settings',
  },

  // ── Rate Limits ──────────────────────────────────────────────────────────────
  {
    category: 'rate_limit',
    severity: 'warning',
    patterns: [
      /rate.?limit|too many requests|429|throttle/i,
    ],
    title: 'API Rate Limit erreicht',
    detail: 'Zu viele Anfragen in kurzer Zeit. Der Anbieter hat die Anfragen gedrosselt.',
    fix: 'Kurz warten (1-5 Minuten) und dann erneut starten.',
  },

  // ── Tool Missing ─────────────────────────────────────────────────────────────
  {
    category: 'tool_missing',
    severity: 'critical',
    patterns: [
      /claude.*not found|command not found.*claude|claude.*command not found/i,
      /ENOENT.*claude|No such file.*claude/i,
    ],
    title: 'Claude Code nicht installiert',
    detail: 'Das claude CLI Binary wurde im PATH nicht gefunden.',
    fix: 'Claude Code installieren: npm install -g @anthropic-ai/claude-code — oder in den Settings die Ausführungs-Route auf "API" wechseln.',
    fixHref: '/settings',
  },
  {
    category: 'tool_missing',
    severity: 'critical',
    patterns: [
      /git.*not found|command not found.*git|git.*command not found|ENOENT.*git/i,
    ],
    title: 'git nicht installiert',
    detail: 'Das git Binary wurde im PATH nicht gefunden. Ohne git kann ForgePilot keinen Code committen.',
    fix: 'Git installieren: https://git-scm.com/downloads',
  },
  {
    category: 'tool_missing',
    severity: 'warning',
    patterns: [
      /gh.*not found|command not found.*\bgh\b|\bgh\b.*command not found|ENOENT.*\bgh\b/i,
    ],
    title: 'GitHub CLI (gh) nicht installiert',
    detail: 'Automatische PR-Erstellung ist nicht möglich ohne gh CLI.',
    fix: 'GitHub CLI installieren: brew install gh — dann einloggen: gh auth login',
  },
  {
    category: 'tool_missing',
    severity: 'warning',
    patterns: [
      /npm.*not found|node.*not found|ENOENT.*npm/i,
    ],
    title: 'Node.js / npm nicht gefunden',
    detail: 'Tests und Builds können nicht ausgeführt werden.',
    fix: 'Node.js installieren: https://nodejs.org',
  },

  // ── Network ──────────────────────────────────────────────────────────────────
  {
    category: 'network',
    severity: 'critical',
    patterns: [
      /ENOTFOUND|getaddrinfo.*ENOTFOUND|could not resolve host/i,
    ],
    title: 'Netzwerk-Verbindungsfehler',
    detail: 'Ein Hostname konnte nicht aufgelöst werden. Möglicherweise keine Internetverbindung.',
    fix: 'Internetverbindung prüfen. Falls du ein VPN nutzt, sicherstellen dass github.com und api.anthropic.com erreichbar sind.',
  },
  {
    category: 'network',
    severity: 'warning',
    patterns: [
      /ECONNREFUSED|connection refused/i,
    ],
    title: 'Verbindung verweigert',
    detail: 'Ein lokaler Dienst (Ollama, lokale DB) ist nicht erreichbar.',
    fix: 'Prüfe ob Ollama läuft: ollama serve — oder wechsle auf einen API-Provider.',
    fixHref: '/settings',
  },
  {
    category: 'network',
    severity: 'warning',
    patterns: [
      /ETIMEDOUT|request timed out|timeout.*exceeded/i,
    ],
    title: 'Netzwerk-Timeout',
    detail: 'Eine API-Anfrage hat zu lange gewartet und wurde abgebrochen.',
    fix: 'Netzwerkqualität prüfen. Bei Ollama: prüfe ob das Modell noch lädt (ollama list).',
  },

  // ── Git Errors ───────────────────────────────────────────────────────────────
  {
    category: 'git',
    severity: 'warning',
    patterns: [
      /merge conflict|automatic merge failed|CONFLICT/i,
    ],
    title: 'Git Merge-Konflikt',
    detail: 'Der Agent konnte den Branch nicht automatisch mergen weil es Konflikte gibt.',
    fix: 'Konflikt manuell auflösen oder Delegation auf einen frischen Branch setzen.',
  },
  {
    category: 'git',
    severity: 'warning',
    patterns: [
      /branch.*already exists|already.*exists.*branch/i,
    ],
    title: 'Git Branch existiert bereits',
    detail: 'Der Feature-Branch existiert schon — möglicherweise von einem früheren Versuch.',
    fix: 'Delegation klonen und mit neuer ID neu starten, oder alten Branch löschen: git branch -D feature/...',
  },
  {
    category: 'git',
    severity: 'warning',
    patterns: [
      /nothing to commit|working tree clean|nothing added to commit/i,
    ],
    title: 'Keine Änderungen',
    detail: 'Der Agent hat die Aufgabe abgeschlossen aber keine Dateien geändert.',
    fix: 'Aufgabenstellung präziser formulieren. Prüfe ob der Agent die Dateien am richtigen Ort gesucht hat.',
  },

  // ── Build / Type Errors ──────────────────────────────────────────────────────
  {
    category: 'build',
    severity: 'warning',
    patterns: [
      /typescript.*error|error ts[0-9]+|type.*error.*ts/i,
    ],
    title: 'TypeScript-Fehler',
    detail: 'Der Typ-Check ist fehlgeschlagen. Der Agent hat Typen falsch verwendet.',
    fix: 'Review-Retry starten — der Fehler-Output wird als Kontext injiziert damit der Agent ihn selbst behebt.',
  },
  {
    category: 'build',
    severity: 'warning',
    patterns: [
      /eslint.*error|lint.*failed|eslint.*failing/i,
    ],
    title: 'Lint-Fehler',
    detail: 'ESLint hat Fehler im Code gefunden.',
    fix: 'Review-Retry mit dem Lint-Output als Kontext starten.',
  },
  {
    category: 'build',
    severity: 'warning',
    patterns: [
      /build failed|failed to build|next build.*failed|webpack.*error/i,
    ],
    title: 'Build fehlgeschlagen',
    detail: 'Der Produktions-Build ist fehlgeschlagen.',
    fix: 'Fehler-Details im Log ansehen und Review-Retry starten.',
  },

  // ── Test Failures ────────────────────────────────────────────────────────────
  {
    category: 'test',
    severity: 'warning',
    patterns: [
      /test.*failed|tests.*failed|\d+.*test.*fail/i,
      /vitest.*fail|jest.*fail|npm.*test.*exit.*(1|2)/i,
    ],
    title: 'Tests fehlgeschlagen',
    detail: 'Ein oder mehrere Tests sind fehlgeschlagen. Der Agent hat existierende Tests gebrochen oder neue falsch implementiert.',
    fix: 'Review-Retry starten — der Test-Output wird als Kontext übergeben. Der Agent behebt die Fehler selbst.',
  },

  // ── Budget / Turns ────────────────────────────────────────────────────────────
  {
    category: 'budget',
    severity: 'warning',
    patterns: [
      /reached max turns|max turns.*reached|turn limit|maximum turns/i,
    ],
    title: 'Turn-Limit erreicht',
    detail: 'Die Delegation hat das konfigurierte Turn-Limit verbraucht bevor die Aufgabe fertig war.',
    fix: 'Budget erhöhen (Delegation klonen und maxBudgetUsd erhöhen) oder Aufgabe in kleinere Delegationen aufteilen.',
  },
  {
    category: 'budget',
    severity: 'warning',
    patterns: [
      /budget.*exceeded|cost.*limit|max.*cost|exceeded.*budget/i,
    ],
    title: 'Budget-Limit überschritten',
    detail: 'Die tatsächlichen Kosten haben das konfigurierte Limit erreicht.',
    fix: 'Delegation mit höherem Budget klonen oder auf ein günstigeres Modell wechseln.',
  },

  // ── Process / System ─────────────────────────────────────────────────────────
  {
    category: 'process',
    severity: 'critical',
    patterns: [
      /killed|SIGKILL|out of memory|JavaScript heap out|OOM/i,
    ],
    title: 'Prozess abgebrochen (Out of Memory)',
    detail: 'Der Agent-Prozess wurde vom Betriebssystem wegen Speichermangel beendet.',
    fix: 'Andere Anwendungen schließen um RAM freizugeben. Bei lokalen Modellen: kleineres Modell wählen.',
  },
  {
    category: 'process',
    severity: 'warning',
    patterns: [
      /SIGTERM|process.*exited.*signal|signal.*SIGTERM/i,
    ],
    title: 'Prozess wurde gestoppt',
    detail: 'Der Agent-Prozess wurde manuell gestoppt (SIGTERM).',
    fix: 'Delegation erneut starten wenn der Stopp unbeabsichtigt war.',
  },

  // ── Workspace ────────────────────────────────────────────────────────────────
  {
    category: 'workspace',
    severity: 'critical',
    patterns: [
      /ENOENT.*workspace|no such file.*workspace|workspace.*not found/i,
      /repo.*not found|repository.*not found|path.*not found/i,
    ],
    title: 'Workspace-Pfad nicht gefunden',
    detail: 'Der konfigurierte Repository-Pfad existiert nicht oder ist nicht zugänglich.',
    fix: 'Prüfe den Repo-Pfad in der Delegation. Stelle sicher dass der Ordner existiert und lesbar ist.',
  },
  {
    category: 'workspace',
    severity: 'warning',
    patterns: [
      /permission denied|EACCES|access denied/i,
    ],
    title: 'Zugriff verweigert',
    detail: 'Der Prozess hat keine Schreibrechte auf den Workspace.',
    fix: 'Ordner-Rechte prüfen: ls -la — und ggf. mit chmod reparieren.',
  },
]

// ─── Classifier ────────────────────────────────────────────────────────────────

/**
 * Classify an error message or output into a human-readable structured error.
 * Returns the first matching pattern, or a generic "unknown" error.
 */
export function classifyError(output: string): ClassifiedError {
  const normalized = output.slice(0, 10_000) // cap at 10KB for performance

  for (const pattern of ERROR_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(normalized)) {
        return {
          category: pattern.category,
          severity: pattern.severity,
          title: pattern.title,
          detail: pattern.detail,
          fix: pattern.fix,
          fixHref: pattern.fixHref,
          matchedPattern: regex.source,
        }
      }
    }
  }

  return {
    category: 'unknown',
    severity: 'warning',
    title: 'Unbekannter Fehler',
    detail: 'ForgePilot konnte den Fehler nicht automatisch klassifizieren.',
    fix: 'Vollständigen Log ansehen und das Fehler-Detail an das Entwickler-Team melden.',
  }
}

/**
 * Quick check: does this output contain a known error?
 * Returns just the human-readable title, or undefined if no pattern matches.
 * Drop-in replacement for the old detectKnownError() function.
 */
export function detectKnownError(output: string): string | undefined {
  const classified = classifyError(output)
  if (classified.category === 'unknown') return undefined
  return `${classified.title} — ${classified.fix}`
}

/**
 * Extract the most useful error snippet from raw agent output.
 * Returns the last N lines that look like errors.
 */
export function extractErrorSnippet(output: string, maxLines = 15): string {
  const lines = output.split('\n')
  const errorLines = lines.filter(l =>
    /error|fail|exception|fatal|cannot|could not|ENOENT|EACCES/i.test(l),
  )
  const relevant = errorLines.length > 0 ? errorLines : lines
  return relevant.slice(-maxLines).join('\n').trim()
}
