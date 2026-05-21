/**
 * NotificationRepository — Postgres storage layer for Notifications
 *
 * Replaces the JSON file store in src/lib/notifications/notification-store.ts.
 * Provides CRUD + list with filtering, markRead, and markAllRead.
 */

import { eq, desc, and } from 'drizzle-orm'
import { getDb } from '@/db/index'
import { notifications as notificationsTable } from '@/db/schema'
import type { DbNotification, NewNotification } from '@/db/schema'
import type { Notification, NotificationType, NotificationSeverity } from '@/lib/models/notification'

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateNotificationInput {
  id?: string
  type: NotificationType
  severity?: NotificationSeverity
  title: string
  body: string
  link?: string
  sourceId?: string
}

export interface ListNotificationsOptions {
  unreadOnly?: boolean
  limit?: number
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function rowToNotification(row: DbNotification): Notification {
  return {
    id:        row.id,
    type:      row.type as NotificationType,
    severity:  row.severity as NotificationSeverity,
    title:     row.title,
    body:      row.body,
    link:      row.link ?? undefined,
    sourceId:  row.sourceId ?? undefined,
    read:      row.read,
    createdAt: row.createdAt.toISOString(),
  }
}

function inputToNewRow(input: CreateNotificationInput, userId: string): NewNotification {
  return {
    userId,
    type:      input.type,
    severity:  input.severity ?? 'info',
    title:     input.title,
    body:      input.body,
    link:      input.link ?? null,
    sourceId:  input.sourceId ?? null,
    read:      false,
    ...(input.id ? { id: input.id } : {}),
  }
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class NotificationRepository {
  private readonly userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    const db = getDb()
    const row = inputToNewRow(input, this.userId)
    const [inserted] = await db.insert(notificationsTable).values(row).returning()
    if (!inserted) throw new Error('Postgres insert returned no row')
    return rowToNotification(inserted)
  }

  async findById(id: string): Promise<Notification | null> {
    const db = getDb()
    const [row] = await db
      .select()
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.id, id),
        eq(notificationsTable.userId, this.userId),
      ))
      .limit(1)

    return row ? rowToNotification(row) : null
  }

  async delete(id: string): Promise<boolean> {
    const db = getDb()
    const result = await db
      .delete(notificationsTable)
      .where(and(
        eq(notificationsTable.id, id),
        eq(notificationsTable.userId, this.userId),
      ))
      .returning({ id: notificationsTable.id })

    return result.length > 0
  }

  async listByUser(options: ListNotificationsOptions = {}): Promise<Notification[]> {
    const db = getDb()

    const conditions = options.unreadOnly
      ? and(
          eq(notificationsTable.userId, this.userId),
          eq(notificationsTable.read, false),
        )
      : eq(notificationsTable.userId, this.userId)

    let query = db
      .select()
      .from(notificationsTable)
      .where(conditions)
      .orderBy(desc(notificationsTable.createdAt))

    if (options.limit !== undefined) {
      // Drizzle requires .limit() call separately for type safety
      const rows = await db
        .select()
        .from(notificationsTable)
        .where(conditions)
        .orderBy(desc(notificationsTable.createdAt))
        .limit(options.limit)
      return rows.map(rowToNotification)
    }

    const rows = await query
    return rows.map(rowToNotification)
  }

  async markRead(id: string): Promise<boolean> {
    const db = getDb()
    const result = await db
      .update(notificationsTable)
      .set({ read: true })
      .where(and(
        eq(notificationsTable.id, id),
        eq(notificationsTable.userId, this.userId),
      ))
      .returning({ id: notificationsTable.id })

    return result.length > 0
  }

  async markAllRead(): Promise<void> {
    const db = getDb()
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.userId, this.userId))
  }

  async getUnreadCount(): Promise<number> {
    const db = getDb()
    const rows = await db
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.userId, this.userId),
        eq(notificationsTable.read, false),
      ))
    return rows.length
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createNotificationRepository(userId: string): NotificationRepository {
  return new NotificationRepository(userId)
}
