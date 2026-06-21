/**
 * Reverse-Engineering — Slice 2: turn a ReverseReport into rebuild steps.
 *
 * Produces an ordered list of concrete build steps from the analysis + the
 * user's intent (preserve logic, migrate DB, fix bugs/security, redesign,
 * cross-platform). The steps feed the existing suggestionsToPlan() → validated
 * sequential build, so no new execution machinery is needed.
 *
 * Important honesty: "logic 1:1" is encoded as a PARITY-TEST step, not as a
 * promise — equivalence must be proven against the original, not assumed.
 */
import type { ReverseReport } from './analyze'

export interface RebuildOptions {
  /** Target stack in plain words, e.g. "Next.js + PostgreSQL". */
  targetStack?: string
  /** Add a redesign (modern UI) step. */
  redesign?: boolean
  /** Add a step to fix known bugs. */
  fixBugs?: boolean
  /** Add a step to fix the security findings from the analysis. */
  fixSecurity?: boolean
  /** Migrate the database to this engine, e.g. "PostgreSQL". */
  migrateDatabase?: string
  /** Keep behaviour identical — adds an explicit parity-test step. */
  preserveLogic?: boolean
  /** Make it deployable on any OS. */
  crossPlatform?: boolean
  /** Free-text extra step. */
  custom?: string
  /** Cap modules turned into their own port step (default 8). */
  maxModuleSteps?: number
}

export interface RebuildStep {
  title: string
  description: string
}

/**
 * Build an ordered, deduplicated list of rebuild steps from a report + options.
 * Order: scaffold → DB → per-module logic port → security → bugs → redesign →
 * cross-platform → parity tests → validate → custom.
 */
export function reportToRebuildSteps(report: ReverseReport, opts: RebuildOptions = {}): RebuildStep[] {
  const steps: RebuildStep[] = []
  const stack = opts.targetStack?.trim() || 'einem modernen, plattformunabhängigen Stack'

  steps.push({
    title: 'Architektur & Datenmodell rekonstruieren',
    description: `Das Grundgerüst von „${report.appName}" in ${stack} aufbauen: Datenmodell, Schichten und eine gemeinsame Datenquelle (Single Source of Truth) entsprechend der Analyse.`,
  })

  if (opts.migrateDatabase) {
    const from = report.databaseEngines[0] ?? 'der bestehenden Datenbank'
    steps.push({
      title: `Datenbank nach ${opts.migrateDatabase} migrieren`,
      description: `Schema und Datenzugriff von ${from} auf ${opts.migrateDatabase} portieren, inkl. Typ-/Query-Anpassungen und Migrationsskripten.`,
    })
  }

  const maxModules = opts.maxModuleSteps ?? 8
  const moduleList = report.modules.slice(0, maxModules)
  if (moduleList.length > 0) {
    for (const mod of moduleList) {
      steps.push({
        title: `Modul „${mod}" portieren`,
        description: `Die Geschäftslogik des Moduls „${mod}" funktional gleichwertig nach ${stack} übertragen, an die gemeinsame Datenquelle anbinden.`,
      })
    }
    if (report.modules.length > maxModules) {
      steps.push({
        title: 'Restliche Module portieren',
        description: `Die übrigen ${report.modules.length - maxModules} Modul(e) übertragen.`,
      })
    }
  } else {
    steps.push({
      title: 'Kern-Geschäftslogik portieren',
      description: `Die zentrale Logik funktional gleichwertig nach ${stack} übertragen.`,
    })
  }

  if (opts.fixSecurity) {
    const detail = report.security.length
      ? `Konkret aus der Analyse: ${report.security.join('; ')}.`
      : 'Codebasis auf Schwachstellen prüfen und beheben (Secrets auslagern, Eingaben validieren, parametrisierte Queries).'
    steps.push({ title: 'Sicherheitslücken beheben', description: detail })
  }

  if (opts.fixBugs) {
    steps.push({ title: 'Bekannte Bugs beheben', description: 'Identifizierte Fehler korrigieren und mit Regressionstests absichern.' })
  }

  if (opts.redesign) {
    steps.push({ title: 'UI modernisieren (Redesign)', description: 'Eine moderne, plattformunabhängige Web-Oberfläche statt der alten Desktop-UI gestalten — gleiche Funktionen, bessere UX.' })
  }

  if (opts.crossPlatform || report.platform === 'windows') {
    steps.push({ title: 'Plattformunabhängig machen', description: 'Windows-spezifische Abhängigkeiten ersetzen, sodass die App auf jedem System läuft und deploybar ist (Docker/Cloud/lokal).' })
  }

  if (opts.preserveLogic) {
    steps.push({
      title: 'Logik-Parität gegen das Original beweisen',
      description: 'Paritäts-Tests erstellen, die zentrale Berechnungen/Abläufe gegen das Original-Verhalten prüfen, bis „Logik 1:1" nachweisbar grün ist (kein Versprechen ohne Beweis).',
    })
  }

  steps.push({ title: 'App validieren', description: 'Vollständiger Build, alle Tests grün, 0 Typfehler — als Definition of Done jeder Phase.' })

  if (opts.custom && opts.custom.trim()) {
    steps.push({ title: 'Eigener Schritt', description: opts.custom.trim() })
  }

  // Dedupe by title (defensive — e.g. crossPlatform + windows both adding it)
  const seen = new Set<string>()
  return steps.filter(s => (seen.has(s.title) ? false : (seen.add(s.title), true)))
}
