/**
 * Process Registry — persistente PID-Speicherung für laufende Agenten-Prozesse.
 * Ermöglicht das Stoppen (Cancel) von laufenden Delegationen.
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const REGISTRY_FILE = path.join(process.cwd(), 'config', 'running-processes.json')

interface ProcessEntry {
  pid: number
  delegationId: string
  startedAt: string
}

type Registry = Record<string, ProcessEntry>

function readRegistry(): Registry {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8')) as Registry
  } catch {
    return {}
  }
}

function writeRegistry(registry: Registry) {
  const dir = path.dirname(REGISTRY_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = REGISTRY_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(registry, null, 2), 'utf-8')
  fs.renameSync(tmp, REGISTRY_FILE)
}

export function registerProcess(delegationId: string, pid: number) {
  const registry = readRegistry()
  registry[delegationId] = { pid, delegationId, startedAt: new Date().toISOString() }
  writeRegistry(registry)
}

export function unregisterProcess(delegationId: string) {
  const registry = readRegistry()
  delete registry[delegationId]
  writeRegistry(registry)
}

export function getProcessPid(delegationId: string): number | null {
  const registry = readRegistry()
  return registry[delegationId]?.pid ?? null
}

export function isProcessAlive(delegationId: string): boolean {
  const pid = getProcessPid(delegationId)
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    unregisterProcess(delegationId)
    return false
  }
}

export function killProcess(delegationId: string): { killed: boolean; reason: string } {
  const pid = getProcessPid(delegationId)
  if (!pid) return { killed: false, reason: 'Kein Prozess registriert für diese Delegation' }

  try {
    // On Windows: use taskkill to kill the process tree
    // On Unix: kill the process group
    if (process.platform === 'win32') {
      execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' })
    } else {
      // Kill process group (negative PID) to also kill child processes
      process.kill(-pid, 'SIGTERM')
    }
    unregisterProcess(delegationId)
    return { killed: true, reason: `Prozess ${pid} beendet` }
  } catch (err) {
    // Process may have already exited
    unregisterProcess(delegationId)
    return { killed: false, reason: `Prozess ${pid} war bereits beendet (${String(err)})` }
  }
}
