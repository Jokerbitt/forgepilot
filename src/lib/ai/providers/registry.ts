/**
 * AI Provider Registry
 *
 * Central store of all available AI providers. Built-in providers are
 * pre-configured; users can add any OpenAI-compatible custom endpoint
 * via the Settings UI.
 *
 * Adding a new provider = implement AIProvider + call registerProvider().
 */

import type { AIProvider, AIProviderConfig, AIModelDef } from './types'
import { AnthropicProvider } from './anthropic'
import { OpenAICompatibleProvider } from './openai-compatible'
import { OllamaProvider } from './ollama'

// ─── Provider instances (singletons) ─────────────────────────────────────────

const PROVIDER_INSTANCES = new Map<string, AIProvider>()

function getOrCreate(id: string, factory: () => AIProvider): AIProvider {
  if (!PROVIDER_INSTANCES.has(id)) PROVIDER_INSTANCES.set(id, factory())
  return PROVIDER_INSTANCES.get(id)!
}

export function getProviderInstance(id: string): AIProvider | undefined {
  return PROVIDER_INSTANCES.get(id)
}

/** Register a custom provider instance (for dynamic/user-defined providers) */
export function registerProvider(id: string, provider: AIProvider): void {
  PROVIDER_INSTANCES.set(id, provider)
}

// ─── Built-in provider configs ────────────────────────────────────────────────

const CLAUDE_MODELS: AIModelDef[] = [
  { id: 'claude-haiku-4-5',  name: 'Claude Haiku 4.5',  purpose: 'fast',   costPer1kInput: 0.0008, costPer1kOutput: 0.004 },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', purpose: 'coding', costPer1kInput: 0.003,  costPer1kOutput: 0.015 },
  { id: 'claude-opus-4-5',   name: 'Claude Opus 4.5',   purpose: 'coding', costPer1kInput: 0.015,  costPer1kOutput: 0.075 },
]

const OPENAI_MODELS: AIModelDef[] = [
  { id: 'gpt-4o-mini',  name: 'GPT-4o Mini',  purpose: 'fast',   costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
  { id: 'gpt-4o',       name: 'GPT-4o',       purpose: 'coding', costPer1kInput: 0.005,   costPer1kOutput: 0.015 },
  { id: 'o3-mini',      name: 'o3-mini',      purpose: 'coding', costPer1kInput: 0.0011,  costPer1kOutput: 0.0044 },
  { id: 'text-embedding-3-small', name: 'Embedding 3 Small', purpose: 'embedding', costPer1kInput: 0.00002, costPer1kOutput: 0 },
]

const GROQ_MODELS: AIModelDef[] = [
  { id: 'llama-3.1-8b-instant',   name: 'Llama 3.1 8B (Instant)', purpose: 'fast',   costPer1kInput: 0.00005, costPer1kOutput: 0.00008 },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B',         purpose: 'coding', costPer1kInput: 0.00059, costPer1kOutput: 0.00079 },
  { id: 'mixtral-8x7b-32768',      name: 'Mixtral 8x7B',          purpose: 'coding', costPer1kInput: 0.00027, costPer1kOutput: 0.00027 },
]

const MISTRAL_MODELS: AIModelDef[] = [
  { id: 'mistral-small-latest', name: 'Mistral Small', purpose: 'fast',   costPer1kInput: 0.001, costPer1kOutput: 0.003 },
  { id: 'mistral-large-latest', name: 'Mistral Large', purpose: 'coding', costPer1kInput: 0.003, costPer1kOutput: 0.009 },
]

const GEMINI_MODELS: AIModelDef[] = [
  { id: 'gemini-2.0-flash',   name: 'Gemini 2.0 Flash', purpose: 'fast',   costPer1kInput: 0.0001, costPer1kOutput: 0.0004 },
  { id: 'gemini-1.5-pro',     name: 'Gemini 1.5 Pro',   purpose: 'coding', costPer1kInput: 0.00125, costPer1kOutput: 0.005 },
  { id: 'text-embedding-004', name: 'Embedding 004',    purpose: 'embedding', costPer1kInput: 0, costPer1kOutput: 0 },
]

const TOGETHER_MODELS: AIModelDef[] = [
  { id: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',  name: 'Llama 3.2 3B Turbo',   purpose: 'fast',   costPer1kInput: 0.00006, costPer1kOutput: 0.00006 },
  { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo',  purpose: 'coding', costPer1kInput: 0.00088, costPer1kOutput: 0.00088 },
  { id: 'mistralai/Mistral-7B-Instruct-v0.3',      name: 'Mistral 7B Instruct',   purpose: 'fast',   costPer1kInput: 0.0002,  costPer1kOutput: 0.0002 },
]

const OPENROUTER_MODELS: AIModelDef[] = [
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)',      purpose: 'fast',   costPer1kInput: 0, costPer1kOutput: 0, isFree: true },
  { id: 'mistralai/mistral-7b-instruct:free',    name: 'Mistral 7B (Free)',         purpose: 'fast',   costPer1kInput: 0, costPer1kOutput: 0, isFree: true },
  { id: 'google/gemma-2-9b-it:free',             name: 'Gemma 2 9B (Free)',         purpose: 'coding', costPer1kInput: 0, costPer1kOutput: 0, isFree: true },
  { id: 'deepseek/deepseek-r1:free',             name: 'DeepSeek R1 (Free)',        purpose: 'coding', costPer1kInput: 0, costPer1kOutput: 0, isFree: true },
  { id: 'qwen/qwen-2.5-72b-instruct:free',       name: 'Qwen 2.5 72B (Free)',       purpose: 'coding', costPer1kInput: 0, costPer1kOutput: 0, isFree: true },
  { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini 128K (Free)', purpose: 'fast',   costPer1kInput: 0, costPer1kOutput: 0, isFree: true },
]

// ─── DeepSeek ─────────────────────────────────────────────────────────────────

const DEEPSEEK_MODELS: AIModelDef[] = [
  { id: 'deepseek-chat',     name: 'DeepSeek V3 Chat',     purpose: 'fast',   costPer1kInput: 0.00014, costPer1kOutput: 0.00028 },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1 Reasoner', purpose: 'coding', costPer1kInput: 0.00055, costPer1kOutput: 0.00219 },
]

// ─── xAI / Grok ───────────────────────────────────────────────────────────────

const XAI_MODELS: AIModelDef[] = [
  { id: 'grok-3-mini-fast', name: 'Grok 3 Mini Fast', purpose: 'fast',   costPer1kInput: 0.00006, costPer1kOutput: 0.0004 },
  { id: 'grok-3-mini',      name: 'Grok 3 Mini',      purpose: 'coding', costPer1kInput: 0.0003,  costPer1kOutput: 0.0005 },
  { id: 'grok-3',           name: 'Grok 3',           purpose: 'coding', costPer1kInput: 0.003,   costPer1kOutput: 0.015 },
]

// ─── Cerebras (Free Tier) ─────────────────────────────────────────────────────

const CEREBRAS_MODELS: AIModelDef[] = [
  { id: 'llama3.1-8b',   name: 'Llama 3.1 8B (Cerebras)',  purpose: 'fast',   costPer1kInput: 0.0001, costPer1kOutput: 0.0001, isFree: true },
  { id: 'llama3.3-70b',  name: 'Llama 3.3 70B (Cerebras)', purpose: 'coding', costPer1kInput: 0.0006, costPer1kOutput: 0.0006 },
  { id: 'qwen-3-32b',    name: 'Qwen 3 32B (Cerebras)',    purpose: 'coding', costPer1kInput: 0.0006, costPer1kOutput: 0.0006 },
]

// ─── SambaNova (Free Tier) ────────────────────────────────────────────────────

const SAMBANOVA_MODELS: AIModelDef[] = [
  { id: 'Meta-Llama-3.1-8B-Instruct',  name: 'Llama 3.1 8B (SambaNova)',  purpose: 'fast',   costPer1kInput: 0, costPer1kOutput: 0, isFree: true },
  { id: 'Meta-Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B (SambaNova)', purpose: 'coding', costPer1kInput: 0, costPer1kOutput: 0, isFree: true },
  { id: 'DeepSeek-R1',                 name: 'DeepSeek R1 (SambaNova)',    purpose: 'coding', costPer1kInput: 0, costPer1kOutput: 0, isFree: true },
]

// ─── Perplexity ───────────────────────────────────────────────────────────────

const PERPLEXITY_MODELS: AIModelDef[] = [
  { id: 'sonar',        name: 'Sonar (Web Search)',      purpose: 'fast',   costPer1kInput: 0.001, costPer1kOutput: 0.001 },
  { id: 'sonar-pro',    name: 'Sonar Pro (Web Search)',  purpose: 'coding', costPer1kInput: 0.003, costPer1kOutput: 0.015 },
  { id: 'sonar-reasoning', name: 'Sonar Reasoning',     purpose: 'coding', costPer1kInput: 0.001, costPer1kOutput: 0.005 },
]

// ─── Fireworks AI ─────────────────────────────────────────────────────────────

const FIREWORKS_MODELS: AIModelDef[] = [
  { id: 'accounts/fireworks/models/llama-v3p1-8b-instruct',  name: 'Llama 3.1 8B (Fireworks)',  purpose: 'fast',   costPer1kInput: 0.0002, costPer1kOutput: 0.0002 },
  { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', name: 'Llama 3.3 70B (Fireworks)', purpose: 'coding', costPer1kInput: 0.0009, costPer1kOutput: 0.0009 },
  { id: 'accounts/fireworks/models/qwen2p5-72b-instruct',    name: 'Qwen 2.5 72B (Fireworks)',  purpose: 'coding', costPer1kInput: 0.0009, costPer1kOutput: 0.0009 },
]

// ─── Deepinfra ────────────────────────────────────────────────────────────────

const DEEPINFRA_MODELS: AIModelDef[] = [
  { id: 'meta-llama/Llama-3.2-11B-Vision-Instruct', name: 'Llama 3.2 11B Vision', purpose: 'fast',   costPer1kInput: 0.00035, costPer1kOutput: 0.00040 },
  { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct',   name: 'Llama 3.1 70B',        purpose: 'coding', costPer1kInput: 0.00059, costPer1kOutput: 0.00079 },
  { id: 'Qwen/Qwen2.5-72B-Instruct',                name: 'Qwen 2.5 72B',         purpose: 'coding', costPer1kInput: 0.00035, costPer1kOutput: 0.00040 },
  { id: 'deepseek-ai/DeepSeek-R1',                  name: 'DeepSeek R1',           purpose: 'coding', costPer1kInput: 0.00055, costPer1kOutput: 0.00219 },
]

// ─── Cohere ───────────────────────────────────────────────────────────────────

const COHERE_MODELS: AIModelDef[] = [
  { id: 'command-r7b-12-2024', name: 'Command R7B',        purpose: 'fast',   costPer1kInput: 0.0000375, costPer1kOutput: 0.00015 },
  { id: 'command-r-plus',      name: 'Command R+',         purpose: 'coding', costPer1kInput: 0.0025,    costPer1kOutput: 0.01 },
  { id: 'command-r',           name: 'Command R',          purpose: 'fast',   costPer1kInput: 0.00015,   costPer1kOutput: 0.00060 },
  { id: 'embed-english-v3.0',  name: 'Embed English v3',  purpose: 'embedding', costPer1kInput: 0.0001, costPer1kOutput: 0 },
]

// ─── Nvidia NIM ───────────────────────────────────────────────────────────────

const NVIDIA_MODELS: AIModelDef[] = [
  { id: 'meta/llama-3.1-8b-instruct',  name: 'Llama 3.1 8B (NIM)',  purpose: 'fast',   costPer1kInput: 0.0002, costPer1kOutput: 0.0002 },
  { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (NIM)', purpose: 'coding', costPer1kInput: 0.00035, costPer1kOutput: 0.00040 },
  { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', name: 'Nemotron Ultra 253B', purpose: 'coding', costPer1kInput: 0.001, costPer1kOutput: 0.004 },
  { id: 'mistralai/mistral-large-2-instruct', name: 'Mistral Large 2 (NIM)',    purpose: 'coding', costPer1kInput: 0.002,  costPer1kOutput: 0.006 },
]

export const BUILT_IN_PROVIDER_CONFIGS: AIProviderConfig[] = [
  // ─── Anthropic ─────────────────────────────────────────────────────────────
  {
    id: 'anthropic',
    type: 'anthropic',
    name: 'Anthropic (Claude)',
    apiKeyRef: 'ANTHROPIC_API_KEY',
    models: CLAUDE_MODELS,
    enabled: true,
    isBuiltIn: true,
    dataResidency: 'us',
  },
  // ─── OpenAI ────────────────────────────────────────────────────────────────
  {
    id: 'openai',
    type: 'openai-compatible',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyRef: 'OPENAI_API_KEY',
    models: OPENAI_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
  },
  // ─── Groq (Free Tier) ──────────────────────────────────────────────────────
  {
    id: 'groq',
    type: 'openai-compatible',
    name: 'Groq (Ultra-Fast)',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyRef: 'GROQ_API_KEY',
    models: GROQ_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
    freeTier: {
      limit: '14.400 req/Tag',
      signupUrl: 'https://console.groq.com',
      description: 'Kein Kreditkarte — einfach registrieren und API Key holen.',
    },
  },
  // ─── Mistral AI (EU, DSGVO-konform) ────────────────────────────────────────
  {
    id: 'mistral',
    type: 'openai-compatible',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKeyRef: 'MISTRAL_API_KEY',
    models: MISTRAL_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'eu',
  },
  // ─── Google Gemini (Free Tier) ─────────────────────────────────────────────
  {
    id: 'google-gemini',
    type: 'openai-compatible',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKeyRef: 'GOOGLE_API_KEY',
    models: GEMINI_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
    freeTier: {
      limit: '1.500 req/Tag',
      signupUrl: 'https://aistudio.google.com',
      description: 'Google-Account reicht — kein Kreditkarte nötig.',
    },
  },
  // ─── Together AI ($25 Free Credits) ────────────────────────────────────────
  {
    id: 'together',
    type: 'openai-compatible',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    apiKeyRef: 'TOGETHER_API_KEY',
    models: TOGETHER_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
    freeTier: {
      limit: '$25 Startguthaben',
      signupUrl: 'https://api.together.ai',
      description: '$25 Gratis-Credits, kein Kreditkarte nötig.',
    },
  },
  // ─── OpenRouter (Free Models) ──────────────────────────────────────────────
  {
    id: 'openrouter',
    type: 'openai-compatible',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyRef: 'OPENROUTER_API_KEY',
    models: OPENROUTER_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
    freeTier: {
      limit: 'Kostenlose Modelle verfügbar',
      signupUrl: 'https://openrouter.ai',
      description: 'Llama, Mistral, Gemma & mehr — dauerhaft kostenlos.',
    },
  },
  // ─── DeepSeek (günstigstes Coding-Modell) ──────────────────────────────────
  {
    id: 'deepseek',
    type: 'openai-compatible',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyRef: 'DEEPSEEK_API_KEY',
    models: DEEPSEEK_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
  },
  // ─── xAI / Grok ────────────────────────────────────────────────────────────
  {
    id: 'xai',
    type: 'openai-compatible',
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    apiKeyRef: 'XAI_API_KEY',
    models: XAI_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
    freeTier: {
      limit: '$25 Startguthaben',
      signupUrl: 'https://console.x.ai',
      description: '$25 Gratis-Credits bei Registrierung.',
    },
  },
  // ─── Cerebras (Free Tier — extrem schnell) ─────────────────────────────────
  {
    id: 'cerebras',
    type: 'openai-compatible',
    name: 'Cerebras (Blitzschnell)',
    baseUrl: 'https://api.cerebras.ai/v1',
    apiKeyRef: 'CEREBRAS_API_KEY',
    models: CEREBRAS_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
    freeTier: {
      limit: '60 req/min gratis',
      signupUrl: 'https://cloud.cerebras.ai',
      description: 'Llama 3.1 8B — 2.000+ Tokens/Sekunde, dauerhaft kostenlos.',
    },
  },
  // ─── SambaNova (Free Tier) ─────────────────────────────────────────────────
  {
    id: 'sambanova',
    type: 'openai-compatible',
    name: 'SambaNova Cloud',
    baseUrl: 'https://api.sambanova.ai/v1',
    apiKeyRef: 'SAMBANOVA_API_KEY',
    models: SAMBANOVA_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
    freeTier: {
      limit: 'Kostenlos (Rate-Limited)',
      signupUrl: 'https://cloud.sambanova.ai',
      description: 'Llama 3.3 70B & DeepSeek R1 dauerhaft kostenlos.',
    },
  },
  // ─── Perplexity (Web-Search AI) ────────────────────────────────────────────
  {
    id: 'perplexity',
    type: 'openai-compatible',
    name: 'Perplexity (Web-Search)',
    baseUrl: 'https://api.perplexity.ai',
    apiKeyRef: 'PERPLEXITY_API_KEY',
    models: PERPLEXITY_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
  },
  // ─── Fireworks AI ──────────────────────────────────────────────────────────
  {
    id: 'fireworks',
    type: 'openai-compatible',
    name: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    apiKeyRef: 'FIREWORKS_API_KEY',
    models: FIREWORKS_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
    freeTier: {
      limit: '$1 Startguthaben',
      signupUrl: 'https://fireworks.ai',
      description: '$1 Gratis-Credits — reicht für tausende Anfragen.',
    },
  },
  // ─── Deepinfra ─────────────────────────────────────────────────────────────
  {
    id: 'deepinfra',
    type: 'openai-compatible',
    name: 'Deepinfra',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    apiKeyRef: 'DEEPINFRA_API_KEY',
    models: DEEPINFRA_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
    freeTier: {
      limit: '$1.50 Startguthaben',
      signupUrl: 'https://deepinfra.com',
      description: 'Günstigste GPU-Inference — $1.50 Gratis-Credits.',
    },
  },
  // ─── Cohere ────────────────────────────────────────────────────────────────
  {
    id: 'cohere',
    type: 'openai-compatible',
    name: 'Cohere',
    baseUrl: 'https://api.cohere.com/compatibility/v1',
    apiKeyRef: 'COHERE_API_KEY',
    models: COHERE_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
    freeTier: {
      limit: 'Trial Key kostenlos',
      signupUrl: 'https://cohere.com',
      description: 'Trial API Key — kein Kreditkarte, Command R gratis testen.',
    },
  },
  // ─── Nvidia NIM ────────────────────────────────────────────────────────────
  {
    id: 'nvidia-nim',
    type: 'openai-compatible',
    name: 'Nvidia NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyRef: 'NVIDIA_API_KEY',
    models: NVIDIA_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
    freeTier: {
      limit: '1.000 Anfragen gratis',
      signupUrl: 'https://build.nvidia.com',
      description: '1.000 kostenlose API-Calls — Nemotron, Llama, Mistral.',
    },
  },
  // ─── LM Studio (Local) ─────────────────────────────────────────────────────
  {
    id: 'lm-studio',
    type: 'openai-compatible',
    name: 'LM Studio (Local)',
    baseUrl: 'http://localhost:1234/v1',
    apiKeyRef: '',   // no key needed
    models: [
      { id: 'local-model', name: 'Local Model (auto-detect)', purpose: 'both' },
    ],
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'local',
  },
  // ─── Ollama (Local) ────────────────────────────────────────────────────────
  {
    id: 'ollama',
    type: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434',
    apiKeyRef: '',   // no key needed
    models: [
      { id: 'qwen2.5-coder:14b', name: 'Qwen 2.5 Coder 14B', purpose: 'coding' },
      { id: 'llama3.2:3b',       name: 'Llama 3.2 3B',        purpose: 'fast' },
      { id: 'nomic-embed-text',  name: 'Nomic Embed Text',    purpose: 'embedding' },
    ],
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'local',
  },
]

// ─── Initialize built-in provider instances ───────────────────────────────────

getOrCreate('anthropic',    () => new AnthropicProvider())
getOrCreate('openai',       () => new OpenAICompatibleProvider('openai', 'OpenAI'))
getOrCreate('groq',         () => new OpenAICompatibleProvider('groq', 'Groq', false))
getOrCreate('mistral',      () => new OpenAICompatibleProvider('mistral', 'Mistral AI', false))
getOrCreate('google-gemini',() => new OpenAICompatibleProvider('google-gemini', 'Google Gemini'))
getOrCreate('together',     () => new OpenAICompatibleProvider('together', 'Together AI', false))
getOrCreate('openrouter',   () => new OpenAICompatibleProvider('openrouter', 'OpenRouter', false))
getOrCreate('deepseek',     () => new OpenAICompatibleProvider('deepseek', 'DeepSeek', false))
getOrCreate('xai',          () => new OpenAICompatibleProvider('xai', 'xAI (Grok)', false))
getOrCreate('cerebras',     () => new OpenAICompatibleProvider('cerebras', 'Cerebras', false))
getOrCreate('sambanova',    () => new OpenAICompatibleProvider('sambanova', 'SambaNova Cloud', false))
getOrCreate('perplexity',   () => new OpenAICompatibleProvider('perplexity', 'Perplexity', false))
getOrCreate('fireworks',    () => new OpenAICompatibleProvider('fireworks', 'Fireworks AI', false))
getOrCreate('deepinfra',    () => new OpenAICompatibleProvider('deepinfra', 'Deepinfra', false))
getOrCreate('cohere',       () => new OpenAICompatibleProvider('cohere', 'Cohere'))
getOrCreate('nvidia-nim',   () => new OpenAICompatibleProvider('nvidia-nim', 'Nvidia NIM', false))
getOrCreate('lm-studio',    () => new OpenAICompatibleProvider('lm-studio', 'LM Studio', false))
getOrCreate('ollama',       () => new OllamaProvider())

/** Register a user-defined custom provider at runtime */
export function registerCustomProvider(config: AIProviderConfig): void {
  const instance = new OpenAICompatibleProvider(config.id, config.name, false)
  PROVIDER_INSTANCES.set(config.id, instance)
}
