import fs from 'fs'
import path from 'path'
import type { AttentionItem, AttentionStore } from '@/lib/models/attention'

const STORE_FILE = path.join(process.cwd(), 'config', 'attention-store.json')

function readStore(): AttentionStore {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8')) as AttentionStore
  } catch {
    return { items: [], updatedAt: new Date().toISOString() }
  }
}

function writeStore(store: AttentionStore) {
  const dir = path.dirname(STORE_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = STORE_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8')
  fs.renameSync(tmp, STORE_FILE)
}

export function getAttentionItems(): AttentionItem[] {
  return readStore().items
}

export function getOpenAttentionItems(): AttentionItem[] {
  return readStore().items.filter(i => !i.resolvedAt)
}

export function upsertAttentionItem(item: AttentionItem): void {
  const store = readStore()
  const idx = store.items.findIndex(i => i.id === item.id)
  if (idx >= 0) {
    store.items[idx] = item
  } else {
    store.items.unshift(item)
  }
  store.updatedAt = new Date().toISOString()
  writeStore(store)
}

export function resolveAttentionItem(id: string, by: 'user' | 'system' = 'user'): boolean {
  const store = readStore()
  const idx = store.items.findIndex(i => i.id === id)
  if (idx < 0) return false
  store.items[idx] = {
    ...store.items[idx],
    resolvedAt: new Date().toISOString(),
    resolvedBy: by,
  }
  store.updatedAt = new Date().toISOString()
  writeStore(store)
  return true
}

export function resolveItemsByDelegation(delegationId: string, by: 'user' | 'system' = 'system'): void {
  const store = readStore()
  const now = new Date().toISOString()
  store.items = store.items.map(i =>
    i.delegationId === delegationId && !i.resolvedAt
      ? { ...i, resolvedAt: now, resolvedBy: by }
      : i
  )
  store.updatedAt = now
  writeStore(store)
}
