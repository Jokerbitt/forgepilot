import { NextResponse } from 'next/server'
import { DELEGATION_TEMPLATES } from '@/lib/delegation-templates'

export async function GET(): Promise<Response> {
  return NextResponse.json(DELEGATION_TEMPLATES)
}
