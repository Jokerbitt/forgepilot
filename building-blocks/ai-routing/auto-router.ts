// Auto-router: picks local vs cloud provider and falls back on failure.
// Destination: src/lib/ai/auto-router.ts

import type { AIProvider, AIResult, GenerateOptions } from './provider-types';
import { OllamaProvider } from './ollama-provider';
import { AnthropicProvider } from './anthropic-provider';

export type RoutingMode = 'auto' | 'local' | 'cloud';

/** Reads the AI_MODE env var, defaulting to 'auto'. */
function envMode(): RoutingMode {
  const raw = process.env.AI_MODE;
  if (raw === 'local' || raw === 'cloud' || raw === 'auto') return raw;
  return 'auto';
}

/**
 * Provider registry. Order matters: it defines fallback priority within a
 * given kind. Add new providers here.
 */
const localProviders: AIProvider[] = [new OllamaProvider()];
const cloudProviders: AIProvider[] = [new AnthropicProvider()];

/**
 * Resolve the ordered list of providers to try for a request.
 *
 * Priority:
 *   1. mode='local'  → only local providers.
 *   2. mode='cloud'  → only cloud providers.
 *   3. mode='auto'   → for 'fast' tasks prefer LOCAL (privacy + zero cost),
 *                      fall back to cloud. For 'coding' tasks prefer CLOUD
 *                      (quality), fall back to local. Unavailable providers
 *                      are filtered out so the caller never gets a dead route.
 */
export async function resolveProvider(
  purpose: GenerateOptions['purpose'] = 'fast',
  mode: RoutingMode = envMode(),
): Promise<AIProvider[]> {
  if (mode === 'local') {
    return filterAvailable(localProviders);
  }
  if (mode === 'cloud') {
    return filterAvailable(cloudProviders);
  }

  // auto
  const local = await filterAvailable(localProviders);
  const cloud = await filterAvailable(cloudProviders);

  // 'coding' → prefer cloud quality; everything else → prefer local.
  const ordered =
    purpose === 'coding' ? [...cloud, ...local] : [...local, ...cloud];

  return ordered;
}

async function filterAvailable(providers: AIProvider[]): Promise<AIProvider[]> {
  const checks = await Promise.all(
    providers.map(async (p) => ((await p.isAvailable()) ? p : null)),
  );
  return checks.filter((p): p is AIProvider => p !== null);
}

/**
 * Generate text using the best available provider, falling back to the next
 * one on error. Throws only when every candidate fails (or none is available).
 */
export async function generateText(
  opts: GenerateOptions,
  mode: RoutingMode = envMode(),
): Promise<AIResult> {
  const providers = await resolveProvider(opts.purpose, mode);

  if (providers.length === 0) {
    throw new Error(
      `No AI provider available for mode='${mode}'. ` +
        `Check OLLAMA_HOST/ANTHROPIC_API_KEY and that Ollama is running.`,
    );
  }

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      return await provider.generate(opts);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${provider.id}: ${message}`);
      // Continue to the next provider in priority order.
    }
  }

  throw new Error(`All AI providers failed:\n${errors.join('\n')}`);
}
