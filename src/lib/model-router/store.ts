import fs from 'fs'
import path from 'path'
import type { ModelProfile } from '@/lib/models/model-router'
import type { RoutingDecision } from '@/lib/models/model-router'
import { DEFAULT_PROFILES } from './profiles'

const STORE_PATH = path.join(process.cwd(), 'config', 'model-router-store.json')

interface RouterStore {
  profiles: ModelProfile[]
  decisions: RoutingDecision[]
}

function readStore(): RouterStore {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return { profiles: DEFAULT_PROFILES, decisions: [] }
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8')
    return JSON.parse(raw) as RouterStore
  } catch {
    return { profiles: DEFAULT_PROFILES, decisions: [] }
  }
}

function writeStore(store: RouterStore): void {
  const dir = path.dirname(STORE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2))
}

export function getProfiles(): ModelProfile[] {
  return readStore().profiles
}

export function getProfile(id: string): ModelProfile | undefined {
  return readStore().profiles.find(p => p.id === id)
}

export function upsertProfile(profile: ModelProfile): ModelProfile {
  const store = readStore()
  const idx = store.profiles.findIndex(p => p.id === profile.id)
  if (idx >= 0) {
    store.profiles[idx] = profile
  } else {
    store.profiles.push(profile)
  }
  writeStore(store)
  return profile
}

export function getDecisions(taskId?: string): RoutingDecision[] {
  const store = readStore()
  if (taskId) return store.decisions.filter(d => d.taskId === taskId)
  return store.decisions
}

export function saveDecision(decision: RoutingDecision): RoutingDecision {
  const store = readStore()
  store.decisions.push(decision)
  writeStore(store)
  return decision
}
