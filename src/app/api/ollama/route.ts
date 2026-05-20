export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

interface OllamaModel {
  name: string
  size: number
}

interface OllamaRunningModel {
  name: string
  size_vram: number
}

export interface OllamaStatus {
  reachable: boolean
  models: { name: string; sizeGb: number }[]
  activeModels: { name: string; vramGb: number }[]
  totalModels: number
}

export async function GET() {
  try {
    const [tagsRes, psRes] = await Promise.all([
      fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) }),
      fetch('http://localhost:11434/api/ps', { signal: AbortSignal.timeout(2000) }),
    ])

    const tagsData = await tagsRes.json() as { models: OllamaModel[] }
    const psData = await psRes.json() as { models: OllamaRunningModel[] }

    const models = (tagsData.models ?? []).map(m => ({
      name: m.name,
      sizeGb: Math.round((m.size / 1e9) * 10) / 10,
    }))

    const activeModels = (psData.models ?? []).map(m => ({
      name: m.name,
      vramGb: Math.round((m.size_vram / 1e9) * 10) / 10,
    }))

    return NextResponse.json({
      reachable: true,
      models,
      activeModels,
      totalModels: models.length,
    } satisfies OllamaStatus)
  } catch {
    return NextResponse.json({
      reachable: false,
      models: [],
      activeModels: [],
      totalModels: 0,
    } satisfies OllamaStatus)
  }
}
