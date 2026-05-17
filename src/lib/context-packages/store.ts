import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { ContextPackage } from './types'

const DATA_DIR = join(process.cwd(), 'config')
const STORE_PATH = join(DATA_DIR, 'context-packages.json')

function read(): ContextPackage[] {
  if (!existsSync(STORE_PATH)) return []
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf-8')) as ContextPackage[]
  } catch {
    return []
  }
}

function write(packages: ContextPackage[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(STORE_PATH, JSON.stringify(packages, null, 2), 'utf-8')
}

export function getPackages(workItemId?: string): ContextPackage[] {
  const all = read()
  return workItemId ? all.filter(p => p.workItemId === workItemId) : all
}

export function getPackage(id: string): ContextPackage | undefined {
  return read().find(p => p.id === id)
}

export function savePackage(pkg: ContextPackage): ContextPackage {
  const all = read()
  const idx = all.findIndex(p => p.id === pkg.id)
  if (idx >= 0) { all[idx] = pkg } else { all.push(pkg) }
  write(all)
  return pkg
}

export function deletePackage(id: string): boolean {
  const all = read()
  const filtered = all.filter(p => p.id !== id)
  write(filtered)
  return filtered.length < all.length
}
