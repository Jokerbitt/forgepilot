import type { PersistenceStrategy, TargetPlatform } from '@/lib/models/project-brief'

export function platformLabel(platform: TargetPlatform): string {
  if (platform === 'webapp') return 'Webapp'
  if (platform === 'desktop') return 'Desktop App'
  if (platform === 'mobile') return 'Mobile App fuer iOS und Android'
  if (platform === 'cross_platform') return 'Cross-platform App fuer Web, Desktop und Mobile'
  return 'ForgePilot soll empfehlen'
}

export function persistenceLabel(strategy: PersistenceStrategy): string {
  if (strategy === 'postgres') return 'PostgreSQL'
  if (strategy === 'sqlite') return 'SQLite'
  if (strategy === 'json_file') return 'JSON-Dateien'
  if (strategy === 'supabase') return 'Supabase / Managed Postgres'
  if (strategy === 'none') return 'Keine dauerhafte Datenhaltung'
  return 'ForgePilot soll empfehlen'
}

export function resolveTargetPlatform(idea: string, requested: TargetPlatform, customPlatformNote?: string): TargetPlatform {
  if (customPlatformNote?.trim()) return requested === 'undecided' ? 'webapp' : requested
  if (requested !== 'undecided') return requested

  const text = idea.toLowerCase()
  const hasMobile = /\b(mobile|ios|android|app store|push|touch|smartphone|handy)\b/.test(text)
  const hasDesktop = /\b(desktop|mac|macos|windows|linux|offline|dateien|filesystem|lokal)\b/.test(text)
  const hasWeb = /\b(webapp|web app|browser|saas|dashboard|portal|admin|team|teilen|url)\b/.test(text)

  if ((hasMobile && hasDesktop) || (hasMobile && hasWeb) || (hasDesktop && hasWeb)) return 'cross_platform'
  if (hasMobile) return 'mobile'
  if (hasDesktop) return 'desktop'
  return 'webapp'
}

export function resolvePersistenceStrategy(
  idea: string,
  requested: PersistenceStrategy,
  resolvedPlatform: TargetPlatform,
): PersistenceStrategy {
  if (requested !== 'recommend') return requested

  const text = idea.toLowerCase()
  const needsAuditOrCollaboration = /\b(team|agenten|parallel|audit|logs|rechte|rollen|multi|saas|kunden|reports|suche|dashboard)\b/.test(text)
  const localOffline = /\b(desktop|offline|lokal|single-user|einzelner nutzer|dateien)\b/.test(text)
  const prototype = /\b(prototyp|demo|experiment|klein|einfach)\b/.test(text)

  if (needsAuditOrCollaboration || resolvedPlatform === 'webapp' || resolvedPlatform === 'cross_platform') return 'postgres'
  if (localOffline || resolvedPlatform === 'desktop') return 'sqlite'
  if (prototype) return 'json_file'
  return 'postgres'
}

export function platformPromptGuidance(platform: TargetPlatform, customPlatformNote?: string): string {
  if (customPlatformNote?.trim()) {
    return `Nutzer moechte eine eigene Produktform beschreiben: ${customPlatformNote.trim()}. Leite daraus passende Architektur-, UX- und Deployment-Empfehlungen ab.`
  }
  if (platform === 'webapp') {
    return 'Plane primaer als Webapp: Browser-first, responsive, schnelle MVP-Auslieferung, spaeter optional PWA/Desktop/Mobile Wrapper.'
  }
  if (platform === 'desktop') {
    return 'Plane primaer als Desktop App: lokale Dateien, Offline-Faehigkeit, Systemintegration, Update-Mechanik und Tastatur-Workflows beachten.'
  }
  if (platform === 'mobile') {
    return 'Plane primaer als Mobile App fuer iOS und Android: Touch-first, kleine Screens, Offline/Push, App-Store-Verteilung und native Geraetefunktionen beachten.'
  }
  if (platform === 'cross_platform') {
    return 'Plane cross-platform: gemeinsamer Produktkern, priorisierte Oberflaeche fuer den MVP, klare Reihenfolge fuer Web/Desktop/Mobile.'
  }
  return 'ForgePilot soll die Produktform empfehlen: zuerst Nutzerkontext, Nutzungshaeufigkeit, Geraet, Offline-Bedarf und Integrationsbedarf klaeren.'
}

export function persistencePromptGuidance(strategy: PersistenceStrategy): string {
  if (strategy === 'postgres') return 'Plane PostgreSQL als robuste Produktiv-Datenbank: Transaktionen, Queries, parallele Agenten, Audit-Logs und spaeterer SaaS-Ausbau.'
  if (strategy === 'sqlite') return 'Plane SQLite fuer lokale Single-User/Desktop/Offline-Nutzung mit einfacher Verteilung.'
  if (strategy === 'json_file') return 'Plane JSON nur fuer Prototyp, lokale Export/Import-Faehigkeit oder sehr kleine Single-User-Tools. Markiere Migrationsgrenzen klar.'
  if (strategy === 'supabase') return 'Plane Supabase/Managed Postgres fuer schnelle Webapp/SaaS-Entwicklung mit Auth, Realtime und weniger Infrastrukturaufwand.'
  if (strategy === 'none') return 'Plane keine persistente Datenhaltung, aber pruefe Export, Audit-Anforderungen und spaetere Migration.'
  return 'ForgePilot soll Datenhaltung empfehlen. Default: Postgres fuer produktive Apps, SQLite fuer lokale Desktop/Offline-Apps, JSON nur fuer Prototypen oder Export.'
}
