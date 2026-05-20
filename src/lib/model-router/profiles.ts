import { BUILT_IN_PROVIDER_CONFIGS } from '@/lib/ai/providers/catalog'
import type { ModelProfile } from '@/lib/models/model-router'
import { buildModelProfilesFromProviderConfigs, DESKTOP_AGENT_PROFILES } from './capabilities'

export const DEFAULT_PROFILES: ModelProfile[] = [
  ...buildModelProfilesFromProviderConfigs(BUILT_IN_PROVIDER_CONFIGS),
  ...DESKTOP_AGENT_PROFILES,
]
