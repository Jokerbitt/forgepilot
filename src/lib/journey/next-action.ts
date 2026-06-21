/**
 * Journey Companion — extra idea: "Was als Nächstes?" assistant.
 *
 * Looks at a built app and recommends the next sensible steps in plain German,
 * prioritised. Reuses the existing analyzers (codebase, responsive, security) so
 * the advice reflects the real state. Read-only.
 */
import { existsSync } from 'fs'
import { analyzeCodebase } from '@/lib/suggestions/codebase-analyzer'
import { checkResponsive } from '@/lib/journey/responsive-check'
import { scanSecurityDeep } from '@/lib/reverse/security-scan'

export type ActionPriority = 'high' | 'medium' | 'low'

export interface NextAction {
  priority: ActionPriority
  title: string
  why: string
  /** Optional hint which journey feature handles it. */
  via?: string
}

/** Suggest prioritised next actions for an app repo. */
export function suggestNextActions(repoPath: string): NextAction[] {
  if (!existsSync(repoPath)) {
    return [{ priority: 'high', title: 'Pfad prüfen', why: 'Der angegebene App-Pfad wurde nicht gefunden.' }]
  }

  const code = analyzeCodebase(repoPath)
  const security = scanSecurityDeep(repoPath)
  const responsive = checkResponsive(repoPath)

  const actions: NextAction[] = []
  const order: Record<ActionPriority, number> = { high: 0, medium: 1, low: 2 }

  const highSec = security.filter(s => s.severity === 'high').length
  if (highSec > 0) {
    actions.push({ priority: 'high', title: 'Sicherheitslücken beheben', why: `${highSec} kritische(r) Sicherheitsfund(e) gefunden.`, via: 'Wartung' })
  }
  if (!code.hasTests) {
    actions.push({ priority: 'high', title: 'Tests hinzufügen', why: 'Keine Tests erkannt — ohne sie sind Änderungen riskant.', via: 'weiter verbessern' })
  }
  if (responsive.score < 50) {
    actions.push({ priority: 'medium', title: 'Mobil-tauglich machen', why: `Geringe mobile Bereitschaft (${responsive.score}/100).`, via: 'Mobil-Check' })
  }
  if (security.length > highSec) {
    actions.push({ priority: 'medium', title: 'Weitere Sicherheitshinweise prüfen', why: 'Es gibt zusätzliche, weniger kritische Hinweise.', via: 'Wartung' })
  }
  if (!code.hasReadme) {
    actions.push({ priority: 'low', title: 'README / Doku ergänzen', why: 'Erleichtert späteres Verstehen und Onboarding.', via: 'weiter verbessern' })
  }
  if (!code.hasCI) {
    actions.push({ priority: 'low', title: 'Automatische Checks (CI) einrichten', why: 'Prüft Änderungen automatisch.', via: 'weiter verbessern' })
  }

  if (actions.length === 0) {
    actions.push({ priority: 'low', title: 'App live schalten & teilen', why: 'Grundlagen sehen gut aus — Zeit, die App live zu schalten.', via: 'Teilen / Deploy' })
  }

  return actions.sort((a, b) => order[a.priority] - order[b.priority])
}
