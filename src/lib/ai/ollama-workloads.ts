import { ollamaChat, ollamaEmbed } from './ollama-client'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'

export interface EmbedResult {
  vector: number[]
  model: string
  dimensions: number
}

export interface ClassifyResult {
  label: string
  confidence: 'high' | 'medium' | 'low'
  model: string
  rawResponse: string
}

export interface SummarizeResult {
  summary: string
  model: string
  inputTokens?: number
  outputTokens?: number
}

export interface CompressResult {
  compressed: string
  originalTokenEstimate: number
  compressedTokenEstimate: number
  model: string
}

function getLocalModel(purpose: 'fast' | 'coding' = 'fast'): string {
  const config = getNBAConfig()
  return purpose === 'coding' ? config.localCodingModel : config.localFastModel
}

export async function embed(text: string, model = 'bge-m3'): Promise<EmbedResult> {
  const vector = await ollamaEmbed(model, text)
  return { vector, model, dimensions: vector.length }
}

export async function classify(
  text: string,
  labels: string[],
  model?: string,
): Promise<ClassifyResult> {
  const resolvedModel = model ?? getLocalModel('fast')
  const labelsStr = labels.map((l, i) => `${i + 1}. ${l}`).join('\n')

  const system =
    'You are a text classifier. Respond with ONLY the label name that best fits the input text. No explanation, no punctuation — just the label.'
  const prompt = `Labels:\n${labelsStr}\n\nText: ${text.slice(0, 2000)}\n\nBest label:`

  const { text: raw } = await ollamaChat(resolvedModel, system, prompt, 32)
  const matched = labels.find(l => raw.toLowerCase().includes(l.toLowerCase())) ?? labels[0]

  const exactMatch = labels.some(l => raw.toLowerCase().trim() === l.toLowerCase().trim())
  const confidence: ClassifyResult['confidence'] = exactMatch ? 'high' : raw.length < 50 ? 'medium' : 'low'

  return { label: matched, confidence, model: resolvedModel, rawResponse: raw }
}

export async function summarize(
  text: string,
  maxSentences = 3,
  model?: string,
): Promise<SummarizeResult> {
  const resolvedModel = model ?? getLocalModel('fast')
  const system = `You are a concise summarizer. Write a summary of at most ${maxSentences} sentences. No preamble, no filler — only the summary.`
  const prompt = `Summarize this text:\n\n${text.slice(0, 6000)}`

  const { text: summary, inputTokens, outputTokens } = await ollamaChat(
    resolvedModel,
    system,
    prompt,
    maxSentences * 80,
  )

  return { summary, model: resolvedModel, inputTokens, outputTokens }
}

export async function compressContext(
  content: string,
  targetTokens: number,
  model?: string,
): Promise<CompressResult> {
  const resolvedModel = model ?? getLocalModel('fast')
  const originalTokenEstimate = Math.ceil(content.length * 0.25)

  if (originalTokenEstimate <= targetTokens) {
    return {
      compressed: content,
      originalTokenEstimate,
      compressedTokenEstimate: originalTokenEstimate,
      model: resolvedModel,
    }
  }

  const targetChars = targetTokens * 4
  const system = `You compress context packages for AI agents. Your output must be under ${targetChars} characters. Preserve: decisions, constraints, key facts, risks. Drop: repetition, verbose prose, examples. Output the compressed context only.`
  const prompt = content.slice(0, 12000)

  const { text: compressed } = await ollamaChat(
    resolvedModel,
    system,
    prompt,
    targetTokens,
    60000,
  )

  return {
    compressed,
    originalTokenEstimate,
    compressedTokenEstimate: Math.ceil(compressed.length * 0.25),
    model: resolvedModel,
  }
}

export async function cosineSimilarity(a: number[], b: number[]): Promise<number> {
  if (a.length !== b.length) throw new Error('Vector dimension mismatch')
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}
