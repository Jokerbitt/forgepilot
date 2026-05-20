export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

interface OllamaTagModel {
  name: string
  size: number
  modified_at: string
  [key: string]: unknown
}

interface OllamaTagsResponse {
  models: OllamaTagModel[]
}

export interface OllamaModelInfo {
  id: string
  name: string
  size: number
  modifiedAt: string
}

export interface OllamaModelsResponse {
  models: OllamaModelInfo[]
  error?: string
}

export async function GET(): Promise<NextResponse<OllamaModelsResponse>> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(3000),
    })

    if (!response.ok) {
      return NextResponse.json({ models: [], error: 'Ollama not running' })
    }

    const data = await response.json() as OllamaTagsResponse

    const models: OllamaModelInfo[] = (data.models ?? []).map((m) => ({
      id: m.name,
      name: m.name,
      size: m.size,
      modifiedAt: m.modified_at,
    }))

    return NextResponse.json({ models })
  } catch {
    return NextResponse.json({ models: [], error: 'Ollama not running' })
  }
}
