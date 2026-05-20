export const dynamic = 'force-dynamic'
/**
 * GET  /api/delegations/templates          — list all templates (optionally filtered by category)
 * GET  /api/delegations/templates?id=      — get single template + pre-filled contract
 */

import { NextResponse } from 'next/server'
import { getTemplates, getTemplate, templateToContract } from '@/lib/delegations/templates'
import type { TemplateCategory } from '@/lib/delegations/templates'

export function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id       = searchParams.get('id')
  const category = searchParams.get('category') as TemplateCategory | null

  if (id) {
    const template = getTemplate(id)
    if (!template) {
      return NextResponse.json({ error: `Template "${id}" not found` }, { status: 404 })
    }
    return NextResponse.json({
      template,
      contract: templateToContract(template),
    })
  }

  return NextResponse.json(getTemplates(category ?? undefined))
}
