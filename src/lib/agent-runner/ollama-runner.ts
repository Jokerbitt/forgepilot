import type { AgentLog } from '@/lib/models/delegation'
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
}

export interface OllamaRunResult {
  success: boolean
  summary: string
  turns: number
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

    while (turns < maxTurns) {
      turns += 1
      let response: OllamaChatResponse
      try {
        response = await this.callOllama(messages)
      } catch (err) {
        const msg = (err as Error).message
        this.emit(this.nowLog('error', `❌ Ollama nicht erreichbar: ${msg}`))
        return { success: false, summary: `Ollama-Aufruf fehlgeschlagen: ${msg}`, turns }
      }

      const assistant = response.message
      lastAssistantText = assistant.content ?? ''

      if (lastAssistantText.trim()) {
        this.emit(this.nowLog('thought', `💭 ${lastAssistantText.trim().slice(0, 500)}`))
      }

      messages.push({
        role: 'assistant',
        content: lastAssistantText,
        ...(assistant.tool_calls ? { tool_calls: assistant.tool_calls } : {}),
      })

      const completeMatch = /\bTASK_COMPLETE\b/.test(lastAssistantText)
      const blockedMatch = /\bTASK_BLOCKED\b/.test(lastAssistantText)
      if (completeMatch) {
        this.emit(this.nowLog('success', `✅ TASK_COMPLETE nach ${turns} Turns`))
        return { success: true, summary: lastAssistantText.trim(), turns }
      }
      if (blockedMatch) {
        this.emit(this.nowLog('error', `⛔ TASK_BLOCKED nach ${turns} Turns`))
        return { success: false, summary: lastAssistantText.trim(), turns }
      }

      const toolCalls = assistant.tool_calls ?? []
      if (toolCalls.length === 0) {
        this.emit(this.nowLog('success', `✅ Run beendet ohne weitere Tool-Calls nach ${turns} Turns`))
        return { success: true, summary: lastAssistantText.trim() || 'Run beendet ohne Tool-Calls', turns }
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
    return { success: false, summary: `maxTurns erreicht. Letzte Antwort: ${lastAssistantText.slice(0, 500)}`, turns }
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
