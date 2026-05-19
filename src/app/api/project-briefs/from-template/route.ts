import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { BRIEF_TEMPLATES } from '@/lib/project-briefs/templates'
import { buildProjectBrief, saveProjectBrief } from '@/lib/project-briefs'

const FromTemplateSchema = z.object({
  templateId: z.enum(['saas', 'mobile', 'rest-api']),
})

export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, FromTemplateSchema)
    if (isValidationError(input)) return input

    const template = BRIEF_TEMPLATES.find(t => t.id === input.templateId)
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 400 })
    }

    const brief = buildProjectBrief({
      title: template.brief.title,
      rawIdea: `${template.name}: ${template.brief.problemStatement}`,
      problemStatement: template.brief.problemStatement,
      targetAudience: template.brief.targetUsers,
      desiredOutcome: template.brief.successMetrics.join('. '),
      constraints: template.brief.techStack,
      scope: 'standard',
      researchMode: 'standard',
      privacyMode: 'local',
    })

    const saved = saveProjectBrief(brief)

    return NextResponse.json(
      {
        id: saved.id,
        redirectUrl: `/project-briefs/${saved.id}`,
      },
      { status: 201 },
    )
  } catch {
    return NextResponse.json({ error: 'Failed to create project brief from template' }, { status: 500 })
  }
}
