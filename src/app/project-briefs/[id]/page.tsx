import { notFound } from 'next/navigation'
import { findProjectBriefById } from '@/lib/project-briefs'
import { BlueprintScreen } from '@/components/project-briefs/BlueprintScreen'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BlueprintPage({ params }: Props) {
  const { id } = await params
  const brief = findProjectBriefById(id)
  if (!brief) notFound()
  return <BlueprintScreen initialBrief={brief} />
}
