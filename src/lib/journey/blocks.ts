/**
 * Journey Companion — Phase 2.1: ready-made building blocks a non-techie can add
 * with one click (Login, payments, e-mail, file upload, …).
 *
 * Each block maps to a clear, behaviour-preserving build step that reuses an
 * existing ForgePilot connector where possible, then runs through the normal
 * validated build flow. Pure: registry + step shaping only.
 */
import type { BlockCategory } from '@/lib/building-blocks/types'

export interface JourneyBlock {
  id: string
  /** User-facing label (German). */
  label: string
  /** What it does, in plain words. */
  description: string
  /** Emoji for the picker. */
  emoji: string
  /** Connector building-block to reuse, if any. */
  connector?: BlockCategory
}

export const JOURNEY_BLOCKS: JourneyBlock[] = [
  { id: 'login', label: 'Login & Registrierung', emoji: '🔑', description: 'Nutzer können sich registrieren und anmelden.', connector: 'connector-oauth' },
  { id: 'payments', label: 'Zahlungen', emoji: '💳', description: 'Nutzer können bezahlen (z. B. Stripe-Checkout).' },
  { id: 'email', label: 'E-Mail-Versand', emoji: '✉️', description: 'Die App kann E-Mails verschicken (Bestätigungen, Benachrichtigungen).', connector: 'connector-email' },
  { id: 'notifications', label: 'Benachrichtigungen', emoji: '🔔', description: 'In-App-Benachrichtigungen für Nutzer.', connector: 'connector-notify' },
  { id: 'file-upload', label: 'Datei-Upload', emoji: '📎', description: 'Nutzer können Dateien hochladen und speichern.', connector: 'connector-storage' },
  { id: 'search', label: 'Suche', emoji: '🔎', description: 'Volltextsuche über die Inhalte der App.', connector: 'connector-search' },
]

export interface BlockStep {
  blockId: string
  title: string
  description: string
}

/** Look up a block by id. */
export function findBlock(id: string): JourneyBlock | undefined {
  return JOURNEY_BLOCKS.find(b => b.id === id)
}

/** Turn a block into a validated build step (or null for an unknown id). */
export function blockToStep(id: string): BlockStep | null {
  const block = findBlock(id)
  if (!block) return null
  const reuse = block.connector
    ? ` Nutze den vorhandenen Baustein „${block.connector}" als Basis.`
    : ''
  return {
    blockId: block.id,
    title: block.label,
    description: `Füge „${block.label}" hinzu: ${block.description}${reuse} Bestehendes Verhalten erhalten; Build grün + Tests bestehen.`,
  }
}
