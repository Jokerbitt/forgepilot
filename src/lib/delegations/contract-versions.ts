import type { Delegation, TaskContract } from '../models/delegation'
import fs from 'fs/promises'
import path from 'path'

export interface ContractVersion {
  id: string
  delegationId: string
  version: number
  title: string
  description: string
  riskClass: string
  changedBy: 'user' | 'system'
  changedAt: string
  changeReason?: string
  /** Full contract snapshot at this version (used as "from" baseline for next diff) */
  snapshot: Partial<TaskContract>
  diff?: {
    from: Partial<TaskContract>
    to: Partial<TaskContract>
  }
}

export interface ContractVersionStore {
  [delegationId: string]: ContractVersion[]
}

const VERSIONS_FILE = path.join(process.cwd(), 'config', 'contract-versions.json')

/**
 * Load version history from persistent storage
 */
async function loadVersionStore(): Promise<ContractVersionStore> {
  try {
    const content = await fs.readFile(VERSIONS_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    // File doesn't exist yet or can't be read — return empty store
    return {}
  }
}

/**
 * Save version store to persistent storage
 */
async function saveVersionStore(store: ContractVersionStore): Promise<void> {
  const dir = path.dirname(VERSIONS_FILE)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(VERSIONS_FILE, JSON.stringify(store, null, 2))
}

/**
 * Calculate diff between two contract objects
 */
function calculateDiff(
  from: Partial<TaskContract> | undefined,
  to: TaskContract
): { from: Partial<TaskContract>; to: Partial<TaskContract> } | undefined {
  if (!from) {
    return undefined
  }

  const fromKeys = Object.keys(from) as (keyof TaskContract)[]
  const toKeys = Object.keys(to) as (keyof TaskContract)[]
  const allKeys = new Set([...fromKeys, ...toKeys])

  const diffFrom: Record<string, unknown> = {}
  const diffTo: Record<string, unknown> = {}
  let hasChanges = false

  allKeys.forEach((key) => {
    const fromValue = from[key as keyof Partial<TaskContract>]
    const toValue = to[key as keyof TaskContract]

    // Simple equality check — for arrays, use JSON string comparison
    const fromStr = Array.isArray(fromValue) ? JSON.stringify(fromValue) : fromValue
    const toStr = Array.isArray(toValue) ? JSON.stringify(toValue) : toValue

    if (fromStr !== toStr) {
      if (fromValue !== undefined) diffFrom[key] = fromValue
      if (toValue !== undefined) diffTo[key] = toValue
      hasChanges = true
    }
  })

  return hasChanges
    ? {
        from: diffFrom as Partial<TaskContract>,
        to: diffTo as Partial<TaskContract>,
      }
    : undefined
}

/**
 * Save a new contract version with change tracking.
 * @param delegationId - The delegation ID to save the version for
 * @param contract - The task contract to save
 * @param delegation - The delegation object for context
 * @param reason - Optional reason for the version change
 * @returns The saved ContractVersion record
 */
export async function saveVersion(
  delegationId: string,
  contract: TaskContract,
  delegation: Delegation,
  reason?: string
): Promise<ContractVersion> {
  const store = await loadVersionStore()

  // Initialize array for this delegation if it doesn't exist
  if (!store[delegationId]) {
    store[delegationId] = []
  }

  const versions = store[delegationId]
  const version = versions.length + 1

  // Get the previous version's snapshot as baseline for diff
  const previousVersion = versions.length > 0 ? versions[versions.length - 1] : undefined
  const previousSnapshot = previousVersion?.snapshot

  const diff = calculateDiff(previousSnapshot, contract)

  const newVersion: ContractVersion = {
    id: `${delegationId}-v${version}`,
    delegationId,
    version,
    title: contract.goal,
    description: contract.context,
    riskClass: contract.riskClass,
    changedBy: 'user',
    changedAt: new Date().toISOString(),
    changeReason: reason,
    snapshot: contract as Partial<TaskContract>,
    diff,
  }

  versions.push(newVersion)
  await saveVersionStore(store)

  return newVersion
}

/**
 * Get version history for a delegation.
 * @param delegationId - The delegation ID to fetch history for
 * @returns Array of ContractVersion records in chronological order
 */
export async function getVersionHistory(delegationId: string): Promise<ContractVersion[]> {
  const store = await loadVersionStore()
  return store[delegationId] || []
}

/**
 * Get a specific version by version number.
 * @param delegationId - The delegation ID
 * @param versionNumber - The version number to retrieve
 * @returns The ContractVersion if found, null otherwise
 */
export async function getVersion(
  delegationId: string,
  versionNumber: number
): Promise<ContractVersion | null> {
  const history = await getVersionHistory(delegationId)
  return history.find((v) => v.version === versionNumber) || null
}

/**
 * Get the current/latest version of a delegation contract.
 * @param delegationId - The delegation ID
 * @returns The latest ContractVersion if available, null otherwise
 */
export async function getLatestVersion(delegationId: string): Promise<ContractVersion | null> {
  const history = await getVersionHistory(delegationId)
  return history.length > 0 ? history[history.length - 1] : null
}
