import fs from 'fs'
import path from 'path'
import type { AgentProfile, AgentRole } from '@/lib/models/agent-profile'
import { DEFAULT_AGENT_PROFILES } from './default-profiles'

function storePath(): string {
  return path.join(process.cwd(), 'config', 'agent-registry.json')
}

interface RegistryStore {
  profiles: AgentProfile[]
}

function readStore(): RegistryStore {
  try {
    const p = storePath()
    if (!fs.existsSync(p)) return { profiles: DEFAULT_AGENT_PROFILES }
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as RegistryStore
  } catch {
    return { profiles: DEFAULT_AGENT_PROFILES }
  }
}

function writeStore(store: RegistryStore): void {
  const p = storePath()
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(p, JSON.stringify(store, null, 2))
}

export function getAgents(role?: AgentRole): AgentProfile[] {
  const store = readStore()
  if (role) return store.profiles.filter(p => p.role === role)
  return store.profiles
}

export function getAgent(id: string): AgentProfile | undefined {
  return readStore().profiles.find(p => p.id === id)
}

export function upsertAgent(profile: AgentProfile): AgentProfile {
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

export function getAvailableAgents(role?: AgentRole): AgentProfile[] {
  return getAgents(role).filter(p => p.availability === 'available')
}

export function pickAgentForWorkload(workload: string, role?: AgentRole): AgentProfile | undefined {
  const candidates = getAvailableAgents(role)
  return candidates.find(p => p.preferredWorkloads.includes(workload)) ?? candidates[0]
}
