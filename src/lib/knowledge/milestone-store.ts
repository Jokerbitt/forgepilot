import fs from 'fs'
import path from 'path'
import { nanoid } from 'nanoid'
import type { Milestone, WorkPackage } from '@/lib/models/milestone'

const MILESTONES_FILE = path.join(process.cwd(), 'config', 'milestones.json')
const WORK_PACKAGES_FILE = path.join(process.cwd(), 'config', 'work-packages.json')

function atomicWrite(file: string, data: unknown) {
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, file)
}

// ─── Milestones ───────────────────────────────────────────────────────────────

export function readMilestones(): Milestone[] {
  try { return JSON.parse(fs.readFileSync(MILESTONES_FILE, 'utf-8')) as Milestone[] }
  catch { return [] }
}

export function writeMilestones(milestones: Milestone[]) {
  atomicWrite(MILESTONES_FILE, milestones)
}

export function getMilestonesByBriefId(briefId: string): Milestone[] {
  return readMilestones().filter(m => m.briefId === briefId)
}

export function upsertMilestone(milestone: Milestone) {
  const all = readMilestones()
  const idx = all.findIndex(m => m.id === milestone.id)
  if (idx >= 0) all[idx] = milestone
  else all.push(milestone)
  writeMilestones(all)
}

export function saveMilestones(milestones: Milestone[]) {
  const all = readMilestones()
  for (const m of milestones) {
    const idx = all.findIndex(x => x.id === m.id)
    if (idx >= 0) all[idx] = m
    else all.push(m)
  }
  writeMilestones(all)
}

// ─── Work Packages ────────────────────────────────────────────────────────────

export function readWorkPackages(): WorkPackage[] {
  try { return JSON.parse(fs.readFileSync(WORK_PACKAGES_FILE, 'utf-8')) as WorkPackage[] }
  catch { return [] }
}

export function writeWorkPackages(wps: WorkPackage[]) {
  atomicWrite(WORK_PACKAGES_FILE, wps)
}

export function getWorkPackagesByMilestoneId(milestoneId: string): WorkPackage[] {
  return readWorkPackages().filter(wp => wp.milestoneId === milestoneId)
}

export function getWorkPackagesByBriefId(briefId: string): WorkPackage[] {
  return readWorkPackages().filter(wp => wp.briefId === briefId)
}

export function saveWorkPackages(wps: WorkPackage[]) {
  const all = readWorkPackages()
  for (const wp of wps) {
    const idx = all.findIndex(x => x.id === wp.id)
    if (idx >= 0) all[idx] = wp
    else all.push(wp)
  }
  writeWorkPackages(all)
}

// ─── Combined generator helpers ───────────────────────────────────────────────

export interface GeneratedPlan {
  milestones: Milestone[]
  workPackages: WorkPackage[]
}

export function persistGeneratedPlan(
  briefId: string,
  rawMilestones: Array<Omit<Milestone, 'id' | 'createdAt' | 'updatedAt' | 'briefId' | 'workPackageIds'>>,
  rawWorkPackages: Array<Omit<WorkPackage, 'id' | 'createdAt' | 'updatedAt' | 'briefId' | 'milestoneId' | 'delegationIds'> & { milestoneIndex: number }>,
): GeneratedPlan {
  const now = new Date().toISOString()

  const milestones: Milestone[] = rawMilestones.map(m => ({
    ...m,
    id: nanoid(10),
    briefId,
    workPackageIds: [],
    createdAt: now,
    updatedAt: now,
  }))

  const workPackages: WorkPackage[] = rawWorkPackages.map(wp => {
    const milestoneId = milestones[wp.milestoneIndex]?.id ?? milestones[0]?.id ?? 'unknown'
    return {
      ...wp,
      id: nanoid(10),
      briefId,
      milestoneId,
      delegationIds: [],
      createdAt: now,
      updatedAt: now,
    }
  })

  // Wire workPackageIds back onto milestones
  for (const wp of workPackages) {
    const m = milestones.find(x => x.id === wp.milestoneId)
    if (m) m.workPackageIds.push(wp.id)
  }

  saveMilestones(milestones)
  saveWorkPackages(workPackages)
  return { milestones, workPackages }
}
