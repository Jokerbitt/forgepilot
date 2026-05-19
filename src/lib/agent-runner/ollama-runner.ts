import type { AgentLog, TokenUsage, CostSavings } from '@/lib/models/delegation'
import {
  OLLAMA_TOOLS,
  executeToolCall,
  type OllamaToolCall,
  type ToolExecutionResult,
} from './tools'

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: OllamaToolCall[]
  tool_name?: string
}

export interface OllamaChatResponse {
  model: string
  message: {
    role: 'assistant'
    content: string
    tool_calls?: OllamaToolCall[]
  }
  done: boolean
  /** Tokens used for the prompt in this turn */
  prompt_eval_count?: number
  /** Tokens generated in this turn */
  eval_count?: number
}

export interface OllamaRunResult {
  success: boolean
  summary: string
  turns: number
  tokenUsage: TokenUsage
  costSavings: CostSavings
}

/**
 * Claude Sonnet 4 pricing (May 2026):
 * Input:  $3.00 / 1M tokens
 * Output: $15.00 / 1M tokens
 */
const CLAUDE_INPUT_USD_PER_TOKEN  = 3.00  / 1_000_000
const CLAUDE_OUTPUT_USD_PER_TOKEN = 15.00 / 1_000_000

export function calculateCostSavings(usage: TokenUsage, model: string): CostSavings {
  const claudeEquivalentUsd =
    usage.promptTokens * CLAUDE_INPUT_USD_PER_TOKEN +
    usage.completionTokens * CLAUDE_OUTPUT_USD_PER_TOKEN
  return {
    tokensUsed: usage,
    claudeEquivalentUsd: Math.round(claudeEquivalentUsd * 100_000) / 100_000,
    actualCostUsd: 0,
    savedUsd: Math.round(claudeEquivalentUsd * 100_000) / 100_000,
    localModel: model,
  }
}

export interface OllamaRunnerOptions {
  endpoint?: string
  fetcher?: typeof fetch
  onLog?: (logs: AgentLog[]) => void
}

const DEFAULT_ENDPOINT = 'http://localhost:11434/api/chat'

const SYSTEM_PROMPT = `You are an autonomous software engineering agent running locally via Ollama.

You have access to these tools:
- bash_exec(command): run a shell command in the project root
- read_file(path): read a file
- write_file(path, content): write a file
- list_dir(path): list directory contents

Rules:
- Work in small, verifiable steps.
- Read relevant source files before editing them.
- After making changes, run tests via bash_exec.
- When the task is fully complete, respond with the literal text TASK_COMPLETE followed by a one-paragraph summary. Do not emit further tool calls after that.
- If you cannot proceed (missing context, blocked by a safety rule, unclear scope), respond with TASK_BLOCKED and explain why.
- Never commit secrets. Never run destructive commands.`

export class OllamaAgentRunner {
  readonly id: string
  readonly model: string
  readonly cwd: string
  private readonly endpoint: string
  private readonly fetcher: typeof fetch
  private readonly onLog: (logs: AgentLog[]) => void

  constructor(id: string, model: string, cwd: string, options: OllamaRunnerOptions = {}) {
    this.id = id
    this.model = model
    this.cwd = cwd
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT
    this.fetcher = options.fetcher ?? fetch
    this.onLog = options.onLog ?? (() => {})
  }

  private emit(log: AgentLog) {
    this.onLog([log])
  }

  private nowLog(type: AgentLog['type'], message: string): AgentLog {
    return { timestamp: new Date().toISOString(), type, message: message.slice(0, 1000) }
  }

  private async callOllama(messages: OllamaMessage[]): Promise<OllamaChatResponse> {
    const res = await this.fetcher(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        tools: OLLAMA_TOOLS,
        stream: false,
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 300)}`)
    }
    const json = (await res.json()) as OllamaChatResponse
    return json
  }

  async run(userPrompt: string, maxTurns: number): Promise<OllamaRunResult> {
    const messages: OllamaMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]

    this.emit(this.nowLog('info', `🦙 Ollama-Runner gestartet (Modell: ${this.model}, max ${maxTurns} Turns)`))

    let turns = 0
    let lastAssistantText = ''
    let totalPromptTokens = 0
    let totalCompletionTokens = 0

    const makeResult = (success: boolean, summary: string): OllamaRunResult => {
      const tokenUsage: TokenUsage = {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      }
      return { success, summary, turns, tokenUsage, costSavings: calculateCostSavings(tokenUsage, this.model) }
    }

    while (turns < maxTurns) {
      turns += 1
      let response: OllamaChatResponse
      try {
        response = await this.callOllama(messages)
      } catch (err) {
        const msg = (err as Error).message
        this.emit(this.nowLog('error', `❌ Ollama nicht erreichbar: ${msg}`))
        return makeResult(false, `Ollama-Aufruf fehlgeschlagen: ${msg}`)
      }

      // Accumulate token counts from Ollama response
      totalPromptTokens += response.prompt_eval_count ?? 0
      totalCompletionTokens += response.eval_count ?? 0

      const assistant = response.message
      lastAssistantText = assistant.content ?? ''

      if (lastAssistantText.trim()) {
        this.emit(this.nowLog('thought', `💭 ${lastAssistantText.trim().slice(0, 500)}`))
      }

      // Emit token progress every 5 turns
      if (turns % 5 === 0) {
        const saved = calculateCostSavings(
          { promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens, totalTokens: totalPromptTokens + totalCompletionTokens },
          this.model
        )
        this.emit(this.nowLog('info',
          `📊 Turn ${turns}/${maxTurns} · ${(totalPromptTokens + totalCompletionTokens).toLocaleString()} Tokens · Ersparnis: $${saved.savedUsd.toFixed(4)} gegenüber Claude`
        ))
      }

      messages.push({
        role: 'assistant',
        content: lastAssistantText,
        ...(assistant.tool_calls ? { tool_calls: assistant.tool_calls } : {}),
      })

      const completeMatch = /\bTASK_COMPLETE\b/.test(lastAssistantText)
      const blockedMatch = /\bTASK_BLOCKED\b/.test(lastAssistantText)
      if (completeMatch) {
        this.emit(this.nowLog('success', `✅ TASK_COMPLETE nach ${turns} Turns · ${(totalPromptTokens + totalCompletionTokens).toLocaleString()} Tokens total`))
        return makeResult(true, lastAssistantText.trim())
      }
      if (blockedMatch) {
        this.emit(this.nowLog('error', `⛔ TASK_BLOCKED nach ${turns} Turns`))
        return makeResult(false, lastAssistantText.trim())
      }

      const toolCalls = assistant.tool_calls ?? []
      if (toolCalls.length === 0) {
        this.emit(this.nowLog('success', `✅ Run beendet nach ${turns} Turns`))
        return makeResult(true, lastAssistantText.trim() || 'Run beendet ohne Tool-Calls')
      }

      for (const call of toolCalls) {
        const { name } = call.function
        const argPreview = JSON.stringify(call.function.arguments ?? {}).slice(0, 200)
        this.emit(this.nowLog('command', `🔧 ${name}(${argPreview})`))

        const result: ToolExecutionResult = executeToolCall(call, this.cwd)
        this.emit(
          this.nowLog(
            result.ok ? 'info' : 'error',
            `${result.ok ? '↳' : '↳ ❌'} ${result.output.slice(0, 400)}`,
          ),
        )

        messages.push({
          role: 'tool',
          content: result.output,
          tool_name: name,
        })
      }
    }

    this.emit(this.nowLog('error', `⏱️ maxTurns (${maxTurns}) erreicht ohne Abschluss`))
    return makeResult(false, `maxTurns erreicht. Letzte Antwort: ${lastAssistantText.slice(0, 500)}`)
  }
}

export async function isOllamaReachable(
  endpoint = 'http://localhost:11434/api/tags',
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetcher(endpoint, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}
