import { NextResponse } from 'next/server'
import { getNBAConfig, saveNBAConfig, type NBAConfig } from '@/lib/nba-engine/nba-config'

export async function GET() {
  try {
    const config = getNBAConfig()
    return NextResponse.json(config)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read config' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const updates = await request.json() as Partial<NBAConfig>
    const currentConfig = getNBAConfig()
    
    const newConfig = {
      ...currentConfig,
      ...updates
    }
    
    saveNBAConfig(newConfig)
    return NextResponse.json(newConfig)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
  }
}
