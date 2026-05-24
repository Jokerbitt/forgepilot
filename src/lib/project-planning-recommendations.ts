import type { PersistenceStrategy, TargetPlatform } from '@/lib/models/project-brief'

export function resolveTargetPlatform(idea: string, requested: TargetPlatform, customPlatformNote?: string): TargetPlatform {
  if (requested !== 'undecided') return requested
  if (customPlatformNote?.trim()) return 'webapp'
  const text = idea.toLowerCase()
  const hasMobile = /\b(mobile|ios|android|app store|push|touch|smartphone|handy)\b/.test(text)
  const hasDesktop = /\b(desktop|mac|macos|windows|linux|offline|dateien|filesystem|lokal)\b/.test(text)
  const hasWeb = /\b(webapp|web app|browser|saas|dashboard|portal|admin|team|teilen|url)\b/.test(text)
  if ((hasMobile && hasDesktop) || (hasMobile && hasWeb) || (hasDesktop && hasWeb)) return 'cross_platform'
  if (hasMobile) return 'mobile'
  if (hasDesktop) return 'desktop'
  return 'webapp'
}

export function resolvePersistenceStrategy(idea: string, requested: PersistenceStrategy, platform: TargetPlatform): PersistenceStrategy {
  if (requested !== 'recommend') return requested
  const text = idea.toLowerCase()
  const collaborative = /\b(team|agenten|parallel|audit|logs|rechte|rollen|multi|saas|kunden|reports|suche|dashboard)\b/.test(text)
  const localOffline = /\b(desktop|offline|lokal|single-user|einzelner nutzer|dateien)\b/.test(text)
  const prototype = /\b(prototyp|demo|experiment|klein|einfach)\b/.test(text)
  if (collaborative || platform === 'webapp' || platform === 'cross_platform') return 'postgres'
  if (localOffline || platform === 'desktop') return 'sqlite'
  if (prototype) return 'json_file'
  return 'postgres'
}

export function platformGuidance(platform: TargetPlatform, customPlatformNote?: string): string {
  if (customPlatformNote?.trim()) return `Nutzerdefinierte Produktform beachten: ${customPlatformNote.trim()}.`
  if (platform === 'webapp') return 'Webapp empfohlen: schneller MVP im Browser, gut teilbar, responsiv und spaeter SaaS-faehig.'
  if (platform === 'desktop') return 'Desktop App empfohlen: lokale Dateien, Offline-Faehigkeit, Systemintegration und fokussierte Tastatur-Workflows.'
  if (platform === 'mobile') return 'Mobile App empfohlen: Touch-first fuer iOS und Android mit Push/Offline und kleinen Screens als Designbasis.'
  if (platform === 'cross_platform') return 'Cross-platform empfohlen: gemeinsamer Produktkern mit klarer Reihenfolge fuer Web, Desktop und Mobile.'
  return 'ForgePilot soll die Produktform anhand Nutzerkontext, Geraet, Offline-Bedarf und Verteilung empfehlen.'
}

export function persistenceGuidance(strategy: PersistenceStrategy): string {
  if (strategy === 'postgres') return 'PostgreSQL empfohlen: robuste Produktiv-Datenbank fuer Transaktionen, Suche, parallele Agenten, Audit-Logs und spaeteren SaaS-Ausbau.'
  if (strategy === 'sqlite') return 'SQLite empfohlen: gute Wahl fuer lokale Single-User/Desktop-Apps, Offline-Modus und einfache Verteilung.'
  if (strategy === 'json_file') return 'JSON-Dateien nur fuer Prototyp, lokale Exporte oder sehr kleine Tools nutzen; fuer produktiven Parallelbetrieb spaeter migrieren.'
  if (strategy === 'supabase') return 'Supabase empfohlen: Managed Postgres mit Auth, Realtime und Storage fuer schnelle Webapp/SaaS-Entwicklung.'
  if (strategy === 'none') return 'Keine dauerhafte Datenhaltung: geeignet fuer reine Rechner, Demos oder ephemere Tools; Export/Import trotzdem pruefen.'
  return 'ForgePilot empfiehlt die Datenhaltung automatisch: Postgres fuer produktive Apps, SQLite fuer lokale Desktop/Offline-Apps, JSON nur fuer Prototypen.'
}

export function platformLabel(platform: TargetPlatform): string {
  if (platform === 'webapp') return 'Webapp'
  if (platform === 'desktop') return 'Desktop App'
  if (platform === 'mobile') return 'Mobile iOS & Android'
  if (platform === 'cross_platform') return 'Cross-platform'
  return 'Empfehlung'
}

export function persistenceLabel(strategy: PersistenceStrategy): string {
  if (strategy === 'postgres') return 'PostgreSQL'
  if (strategy === 'sqlite') return 'SQLite'
  if (strategy === 'json_file') return 'JSON-Dateien'
  if (strategy === 'supabase') return 'Supabase'
  if (strategy === 'none') return 'Keine DB'
  return 'DB Empfehlung'
}
