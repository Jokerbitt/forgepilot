/**
 * Journey Companion — extra idea: template gallery.
 *
 * Ready-made app templates a non-techie can start from instead of a blank page.
 * Each template is a goal + a list of feature steps that feed the existing
 * validated build flow (suggestionsToPlan → executor). Pure: registry + shaping.
 */

export interface AppTemplate {
  id: string
  name: string
  emoji: string
  /** One-line description shown in the gallery. */
  description: string
  /** Build goal handed to the planner. */
  goal: string
  /** Feature steps, each becomes a validated build phase. */
  features: string[]
}

export const APP_TEMPLATES: AppTemplate[] = [
  {
    id: 'crm', name: 'CRM / Kundenverwaltung', emoji: '👥',
    description: 'Kontakte, Firmen, Notizen und Aufgaben verwalten.',
    goal: 'Ein einfaches CRM zur Kundenverwaltung',
    features: ['Kontakte anlegen, bearbeiten, löschen', 'Firmen mit zugeordneten Kontakten', 'Notizen & Aufgaben pro Kontakt', 'Such- und Filterfunktion'],
  },
  {
    id: 'booking', name: 'Buchungstool', emoji: '📅',
    description: 'Termine/Ressourcen buchen mit Kalenderübersicht.',
    goal: 'Ein Buchungstool für Termine und Ressourcen',
    features: ['Ressourcen/Dienstleistungen verwalten', 'Verfügbare Zeitfenster anzeigen', 'Buchung anlegen und bestätigen', 'Kalenderübersicht'],
  },
  {
    id: 'shop', name: 'Online-Shop', emoji: '🛒',
    description: 'Produkte, Warenkorb und Bestellungen.',
    goal: 'Ein einfacher Online-Shop',
    features: ['Produktkatalog mit Bildern und Preisen', 'Warenkorb', 'Bestellvorgang (Checkout)', 'Bestellübersicht für den Betreiber'],
  },
  {
    id: 'blog', name: 'Blog / CMS', emoji: '📝',
    description: 'Artikel schreiben, veröffentlichen, kategorisieren.',
    goal: 'Ein Blog mit einfachem Redaktionssystem',
    features: ['Artikel erstellen und bearbeiten (Editor)', 'Veröffentlichen / Entwurf', 'Kategorien und Tags', 'Öffentliche Artikelansicht'],
  },
  {
    id: 'tasks', name: 'Aufgaben-/Projektboard', emoji: '✅',
    description: 'Aufgaben in Spalten (Kanban) organisieren.',
    goal: 'Ein Aufgaben-/Projektboard (Kanban)',
    features: ['Boards und Spalten', 'Aufgaben per Drag & Drop verschieben', 'Zuständige und Fälligkeitsdaten', 'Filter nach Status'],
  },
  {
    id: 'inventory', name: 'Lager-/Bestandsverwaltung', emoji: '📦',
    description: 'Artikel, Bestände und Bewegungen erfassen.',
    goal: 'Eine Bestandsverwaltung für Artikel und Lager',
    features: ['Artikelstamm anlegen', 'Bestände pro Lagerort', 'Zu-/Abgänge buchen', 'Niedrigbestand-Warnungen'],
  },
]

export interface TemplateStep { title: string; description: string }

/** Look up a template by id. */
export function findTemplate(id: string): AppTemplate | undefined {
  return APP_TEMPLATES.find(t => t.id === id)
}

/** Turn a template's features into validated build steps (or null for unknown id). */
export function templateToSteps(id: string): TemplateStep[] | null {
  const tpl = findTemplate(id)
  if (!tpl) return null
  return tpl.features.map(f => ({
    title: f,
    description: `${f} — als Teil von „${tpl.name}". Build grün + Tests bestehen.`,
  }))
}
