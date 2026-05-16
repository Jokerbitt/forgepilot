import { notFound } from 'next/navigation'
import { findProjectBriefById } from '@/lib/project-briefs'
import { BlueprintScreen } from '@/components/project-briefs/BlueprintScreen'

interface Props {
  params: { id: string }
}

export default function BlueprintPage({ params }: Props) {
  const brief = findProjectBriefById(params.id)
  if (!brief) notFound()
  return <BlueprintScreen initialBrief={brief} />
}
