import { NextResponse } from 'next/server'
import { readMilestones, getWorkPackagesByMilestoneId } from '@/lib/knowledge/milestone-store'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const briefId = searchParams.get('briefId')

  const milestones = readMilestones().filter(m => !briefId || m.briefId === briefId)

  const result = milestones.map(m => ({
    ...m,
    workPackages: getWorkPackagesByMilestoneId(m.id),
  }))

  return NextResponse.json(result)
}
