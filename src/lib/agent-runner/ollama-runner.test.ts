import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { OllamaAgentRunner, type OllamaChatResponse } from './ollama-runner'

function makeResponse(payload: OllamaChatResponse): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('OllamaAgentRunner', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgepilot-runner-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('does NOT report false success when the model only talks (no tool_calls, no TASK_COMPLETE)', async () => {
    // A model that never calls a tool produced nothing — reporting success would be
    // a lie. It must be nudged, then fail honestly after MAX_NO_PROGRESS_TURNS.
    const fetcher = vi.fn().mockImplementation(() =>
      Promise.resolve(
        makeResponse({
          model: 'qwen2.5-coder:14b',
          message: { role: 'assistant', content: 'All set.' },
          done: true,
        }),
      ),
    )
    const logs: string[] = []
    const runner = new OllamaAgentRunner('del-1', 'qwen2.5-coder:14b', tmpDir, {
      fetcher: fetcher as unknown as typeof fetch,
      onLog: entries => entries.forEach(e => logs.push(e.message)),
    })

    const result = await runner.run('do nothing', 5)

    expect(result.success).toBe(false)
    expect(result.turns).toBe(3) // nudged on turns 1 & 2, gave up on the 3rd empty turn
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(logs.some(l => l.includes('zum Handeln auf'))).toBe(true) // nudge emitted
    expect(logs.some(l => l.includes('Abgebrochen'))).toBe(true)     // honest failure
  })

  it('recovers when a nudge gets the model to finally act (tool call, then complete)', async () => {
    const file = path.join(tmpDir, 'hello.txt')
    fs.writeFileSync(file, 'world', 'utf-8')
    const responses: OllamaChatResponse[] = [
      { model: 'qwen2.5-coder:14b', message: { role: 'assistant', content: 'Let me think...' }, done: true },
      { model: 'qwen2.5-coder:14b', message: { role: 'assistant', content: '', tool_calls: [{ function: { name: 'read_file', arguments: { path: 'hello.txt' } } }] }, done: true },
      { model: 'qwen2.5-coder:14b', message: { role: 'assistant', content: 'TASK_COMPLETE — fertig.' }, done: true },
    ]
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(makeResponse(responses.shift()!)))
    const runner = new OllamaAgentRunner('del-nudge-recover', 'qwen2.5-coder:14b', tmpDir, {
      fetcher: fetcher as unknown as typeof fetch,
    })

    const result = await runner.run('go', 5)

    expect(result.success).toBe(true)
    expect(result.turns).toBe(3) // empty → nudge, tool call, then TASK_COMPLETE
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('rejects premature TASK_COMPLETE when no tools were executed (nudges, then fails)', async () => {
    // Claiming completion without a single tool call = nothing was done. The loop
    // must not accept it as success — nudge, then fail honestly.
    const fetcher = vi.fn().mockImplementation(() =>
      Promise.resolve(
        makeResponse({
          model: 'qwen2.5-coder:14b',
          message: { role: 'assistant', content: 'TASK_COMPLETE — fertig.' },
          done: true,
        }),
      ),
    )
    const logs: string[] = []
    const runner = new OllamaAgentRunner('del-2', 'qwen2.5-coder:14b', tmpDir, {
      fetcher: fetcher as unknown as typeof fetch,
      onLog: entries => entries.forEach(e => logs.push(e.message)),
    })
    const result = await runner.run('go', 10)
    expect(result.success).toBe(false)
    expect(result.turns).toBe(3)
    expect(logs.some(l => l.includes('ohne Änderungen'))).toBe(true)
  })

  it('executes a tool_call and loops until done', async () => {
    const file = path.join(tmpDir, 'hello.txt')
    fs.writeFileSync(file, 'world', 'utf-8')

    const responses: OllamaChatResponse[] = [
      {
        model: 'qwen2.5-coder:14b',
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            { function: { name: 'read_file', arguments: { path: 'hello.txt' } } },
          ],
        },
        done: true,
      },
      {
        model: 'qwen2.5-coder:14b',
        message: { role: 'assistant', content: 'Saw the file. TASK_COMPLETE' },
        done: true,
      },
    ]
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(makeResponse(responses.shift()!)))

    const logs: string[] = []
    const runner = new OllamaAgentRunner('del-3', 'qwen2.5-coder:14b', tmpDir, {
      fetcher: fetcher as unknown as typeof fetch,
      onLog: entries => entries.forEach(e => logs.push(e.message)),
    })

    const result = await runner.run('read it', 5)

    expect(result.success).toBe(true)
    expect(result.turns).toBe(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(logs.some(l => l.includes('read_file'))).toBe(true)
    expect(logs.some(l => l.includes('world'))).toBe(true)
  })

  it('executes a JSON tool call emitted as plain text by local models', async () => {
    fs.writeFileSync(path.join(tmpDir, 'hello.txt'), 'world', 'utf-8')

    const responses: OllamaChatResponse[] = [
      {
        model: 'qwen2.5-coder:14b',
        message: {
          role: 'assistant',
          content: '{"name":"read_file","arguments":{"path":"hello.txt"}}',
        },
        done: true,
      },
      {
        model: 'qwen2.5-coder:14b',
        message: { role: 'assistant', content: 'Saw world. TASK_COMPLETE' },
        done: true,
      },
    ]
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(makeResponse(responses.shift()!)))

    const logs: string[] = []
    const runner = new OllamaAgentRunner('del-json-tool', 'qwen2.5-coder:14b', tmpDir, {
      fetcher: fetcher as unknown as typeof fetch,
      onLog: entries => entries.forEach(e => logs.push(e.message)),
    })

    const result = await runner.run('read it', 5)

    expect(result.success).toBe(true)
    expect(result.turns).toBe(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(logs.some(l => l.includes('read_file'))).toBe(true)
    expect(logs.some(l => l.includes('world'))).toBe(true)
  })

  it('executes a fenced JSON tool call emitted as markdown', async () => {
    const responses: OllamaChatResponse[] = [
      {
        model: 'qwen2.5-coder:14b',
        message: {
          role: 'assistant',
          content: '```json\n{"name":"bash_exec","arguments":{"command":"printf ok"}}\n```',
        },
        done: true,
      },
      {
        model: 'qwen2.5-coder:14b',
        message: { role: 'assistant', content: 'Command passed. TASK_COMPLETE' },
        done: true,
      },
    ]
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(makeResponse(responses.shift()!)))

    const logs: string[] = []
    const runner = new OllamaAgentRunner('del-fenced-json-tool', 'qwen2.5-coder:14b', tmpDir, {
      fetcher: fetcher as unknown as typeof fetch,
      onLog: entries => entries.forEach(e => logs.push(e.message)),
    })

    const result = await runner.run('run command', 5)

    expect(result.success).toBe(true)
    expect(result.turns).toBe(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(logs.some(l => l.includes('bash_exec'))).toBe(true)
    expect(logs.some(l => l.includes('ok'))).toBe(true)
  })

  it('respects maxTurns and reports failure when the model never finishes', async () => {
    const fetcher = vi.fn().mockImplementation(() =>
      Promise.resolve(
        makeResponse({
          model: 'qwen2.5-coder:14b',
          message: {
            role: 'assistant',
            content: 'thinking...',
            tool_calls: [
              { function: { name: 'list_dir', arguments: { path: '.' } } },
            ],
          },
          done: true,
        }),
      ),
    )

    const runner = new OllamaAgentRunner('del-4', 'qwen2.5-coder:14b', tmpDir, {
      fetcher: fetcher as unknown as typeof fetch,
    })

    const result = await runner.run('loop forever', 3)
    expect(result.success).toBe(false)
    expect(result.turns).toBe(3)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('handles Ollama errors gracefully', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('connection refused'))
    const runner = new OllamaAgentRunner('del-5', 'qwen2.5-coder:14b', tmpDir, {
      fetcher: fetcher as unknown as typeof fetch,
    })
    const result = await runner.run('hello', 5)
    expect(result.success).toBe(false)
    expect(result.summary).toContain('connection refused')
  })

  it('stops when the model emits TASK_BLOCKED', async () => {
    const fetcher = vi.fn().mockImplementation(() =>
      Promise.resolve(
        makeResponse({
          model: 'qwen2.5-coder:14b',
          message: { role: 'assistant', content: 'TASK_BLOCKED — need credentials.' },
          done: true,
        }),
      ),
    )
    const runner = new OllamaAgentRunner('del-6', 'qwen2.5-coder:14b', tmpDir, {
      fetcher: fetcher as unknown as typeof fetch,
    })
    const result = await runner.run('go', 5)
    expect(result.success).toBe(false)
    expect(result.summary).toContain('TASK_BLOCKED')
  })
})
