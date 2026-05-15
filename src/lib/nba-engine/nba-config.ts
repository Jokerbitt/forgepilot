import fs from 'fs'
import path from 'path'

export interface NBAConfig {
  ignoreStatuses: string[]
  penalizeOldBacklogs: boolean
  backlogPenaltyAgeDays: number
  backlogPenaltyScore: number
  showTriageJoker: boolean
  maxRecommendations: number
  pinnedItems: string[]
}

const CONFIG_PATH = path.join(process.cwd(), 'config', 'nba-settings.json')

export function getNBAConfig(): NBAConfig {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8')
    return JSON.parse(data) as NBAConfig
  } catch (error) {
    // Fallback if file doesn't exist
    return {
      ignoreStatuses: ['done', 'cancelled', 'duplicate', 'archived'],
      penalizeOldBacklogs: true,
      backlogPenaltyAgeDays: 90,
      backlogPenaltyScore: 20,
      showTriageJoker: true,
      maxRecommendations: 5,
      pinnedItems: []
    }
  }
}

export function saveNBAConfig(config: NBAConfig): void {
  const dir = path.dirname(CONFIG_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}
