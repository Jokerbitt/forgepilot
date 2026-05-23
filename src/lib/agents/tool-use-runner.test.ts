import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn()
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
    __mockCreate: mockCreate,
  }
})

vi.mock('@/lib/logger', () => ({
  aiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import Anthropic from '@anthropic-ai/sdk'

function getMockCreate() {
  const instance = vi.mocked(Anthropic).mock.results[0]?.value as {
    messages: { create: ReturnType<typeof vi.fn> }
  }
  return instance?.messages.create
}

function taskCompleteResponse(summary = 'done', files: string[] = []) {
  return {
    content: [{ type: 'tool_use', id: 'tc1', name: 'task_complete', input: { summary, files_changed: files } }],
    stop_reason: 'tool_use',
    usage: { input_tokens: 100, output_tokens: 50 },
  }
}

function endTurnResponse() {
  return { content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn', usage: { input_tokens: 50, output_tokens: 20 } }
}

function toolUseResponse(name: string, input: Record<string, unknown>, id = 'tu1') {
  return { content: [{ type: 'tool_use', id, name, input }], stop_reason: 'tool_use', usage: { input_tokens: 80, output_tokens: 40 } }
}

function makeTempDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'tool-test-')) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(Anthropic).mockImplementation(() => ({ messages: { create: vi.fn() } }) as unknown as InstanceType<typeof Anthropic>)
})

describe('runWithToolUse', () => {
  it('returns success when task_complete is called', async () => {
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: { create: vi.fn().mockResolvedValue(taskCompleteResponse('Fixed the bug', ['src/fix.ts'])) },
    }) as unknown as InstanceType<typeof Anthropic>)

    const { runWithToolUse } = await import('./tool-use-runner')
    const result = await runWithToolUse('Fix bug', { apiKey: 'k', projectRoot: makeTempDir() })

    expect(result.success).toBe(true)
    expect(result.summary).toBe('Fixed the bug')
    expect(result.filesChanged).toContain('src/fix.ts')
    expect(result.turnsUsed).toBe(1)
  })

  it('returns success=false on end_turn without task_complete', async () => {
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: { create: vi.fn().mockResolvedValue(endTurnResponse()) },
    }) as unknown as InstanceType<typeof Anthropic>)

    const { runWithToolUse } = await import('./tool-use-runner')
    const result = await runWithToolUse('Task', { apiKey: 'k', projectRoot: makeTempDir() })

    expect(result.success).toBe(false)
  })

  it('reads a file and passes content to next turn', async () => {
    const dir = makeTempDir()
    fs.writeFileSync(path.join(dir, 'hello.ts'), 'export const x = 42')

    let captured = ''
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn()
          .mockResolvedValueOnce(toolUseResponse('read_file', { path: 'hello.ts' }))
          .mockImplementationOnce(async (req: { messages: Array<{ role: string; content: unknown }> }) => {
            const last = req.messages[req.messages.length - 1]
            const c = last.content as Array<{ content?: string }>
            captured = c[0]?.content ?? ''
            return taskCompleteResponse()
          }),
      },
    }) as unknown as InstanceType<typeof Anthropic>)

    const { runWithToolUse } = await import('./tool-use-runner')
    await runWithToolUse('Read', { apiKey: 'k', projectRoot: dir })
    expect(captured).toContain('export const x = 42')
  })

  it('blocks path traversal in read_file', async () => {
    const dir = makeTempDir()
    let captured = ''
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn()
          .mockResolvedValueOnce(toolUseResponse('read_file', { path: '../../../etc/passwd' }))
          .mockImplementationOnce(async (req: { messages: Array<{ role: string; content: unknown }> }) => {
            const last = req.messages[req.messages.length - 1]
            captured = (last.content as Array<{ content?: string }>)[0]?.content ?? ''
            return taskCompleteResponse()
          }),
      },
    }) as unknown as InstanceType<typeof Anthropic>)

    const { runWithToolUse } = await import('./tool-use-runner')
    await runWithToolUse('Traverse', { apiKey: 'k', projectRoot: dir })
    expect(captured).toContain('outside project root')
  })

  it('writes a file to disk', async () => {
    const dir = makeTempDir()
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn()
          .mockResolvedValueOnce(toolUseResponse('write_file', { path: 'src/new.ts', content: 'export const y = 1' }))
          .mockResolvedValueOnce(taskCompleteResponse()),
      },
    }) as unknown as InstanceType<typeof Anthropic>)

    const { runWithToolUse } = await import('./tool-use-runner')
    await runWithToolUse('Write', { apiKey: 'k', projectRoot: dir })
    expect(fs.readFileSync(path.join(dir, 'src/new.ts'), 'utf-8')).toBe('export const y = 1')
  })

  it('blocks writes to .env files', async () => {
    const dir = makeTempDir()
    let captured = ''
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn()
          .mockResolvedValueOnce(toolUseResponse('write_file', { path: '.env.local', content: 'SECRET=x' }))
          .mockImplementationOnce(async (req: { messages: Array<{ role: string; content: unknown }> }) => {
            captured = (req.messages[req.messages.length - 1].content as Array<{ content?: string }>)[0]?.content ?? ''
            return taskCompleteResponse()
          }),
      },
    }) as unknown as InstanceType<typeof Anthropic>)

    const { runWithToolUse } = await import('./tool-use-runner')
    await runWithToolUse('Leak', { apiKey: 'k', projectRoot: dir })
    expect(captured).toContain('blocked')
    expect(fs.existsSync(path.join(dir, '.env.local'))).toBe(false)
  })

  it('allows git status command', async () => {
    const dir = makeTempDir()
    let captured = ''
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn()
          .mockResolvedValueOnce(toolUseResponse('run_command', { command: 'git status' }))
          .mockImplementationOnce(async (req: { messages: Array<{ role: string; content: unknown }> }) => {
            captured = (req.messages[req.messages.length - 1].content as Array<{ content?: string }>)[0]?.content ?? ''
            return taskCompleteResponse()
          }),
      },
    }) as unknown as InstanceType<typeof Anthropic>)

    const { runWithToolUse } = await import('./tool-use-runner')
    await runWithToolUse('Git', { apiKey: 'k', projectRoot: dir })
    expect(captured).not.toContain('not in the allowed list')
  })

  it('blocks rm -rf command', async () => {
    const dir = makeTempDir()
    let captured = ''
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn()
          .mockResolvedValueOnce(toolUseResponse('run_command', { command: 'rm -rf /tmp' }))
          .mockImplementationOnce(async (req: { messages: Array<{ role: string; content: unknown }> }) => {
            captured = (req.messages[req.messages.length - 1].content as Array<{ content?: string }>)[0]?.content ?? ''
            return taskCompleteResponse()
          }),
      },
    }) as unknown as InstanceType<typeof Anthropic>)

    const { runWithToolUse } = await import('./tool-use-runner')
    await runWithToolUse('Rm', { apiKey: 'k', projectRoot: dir })
    expect(captured).toContain('not in the allowed list')
  })

  it('blocks shell injection after an allowed command prefix', async () => {
    const dir = makeTempDir()
    let captured = ''
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn()
          .mockResolvedValueOnce(toolUseResponse('run_command', { command: 'grep TODO README.md; rm -rf /tmp' }))
          .mockImplementationOnce(async (req: { messages: Array<{ role: string; content: unknown }> }) => {
            captured = (req.messages[req.messages.length - 1].content as Array<{ content?: string }>)[0]?.content ?? ''
            return taskCompleteResponse()
          }),
      },
    }) as unknown as InstanceType<typeof Anthropic>)

    const { runWithToolUse } = await import('./tool-use-runner')
    await runWithToolUse('Inject', { apiKey: 'k', projectRoot: dir })
    expect(captured).toContain('not in the allowed list')
  })

  it('blocks file commands with absolute paths', async () => {
    const dir = makeTempDir()
    let captured = ''
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn()
          .mockResolvedValueOnce(toolUseResponse('run_command', { command: 'cat /etc/passwd' }))
          .mockImplementationOnce(async (req: { messages: Array<{ role: string; content: unknown }> }) => {
            captured = (req.messages[req.messages.length - 1].content as Array<{ content?: string }>)[0]?.content ?? ''
            return taskCompleteResponse()
          }),
      },
    }) as unknown as InstanceType<typeof Anthropic>)

    const { runWithToolUse } = await import('./tool-use-runner')
    await runWithToolUse('Absolute path', { apiKey: 'k', projectRoot: dir })
    expect(captured).toContain('not in the allowed list')
  })

  it('blocks git push --force', async () => {
    const dir = makeTempDir()
    let captured = ''
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn()
          .mockResolvedValueOnce(toolUseResponse('run_command', { command: 'git push --force origin main' }))
          .mockImplementationOnce(async (req: { messages: Array<{ role: string; content: unknown }> }) => {
            captured = (req.messages[req.messages.length - 1].content as Array<{ content?: string }>)[0]?.content ?? ''
            return taskCompleteResponse()
          }),
      },
    }) as unknown as InstanceType<typeof Anthropic>)

    const { runWithToolUse } = await import('./tool-use-runner')
    await runWithToolUse('Force', { apiKey: 'k', projectRoot: dir })
    expect(captured).toContain('not in the allowed list')
  })

  it('blocks branch named main', async () => {
    const dir = makeTempDir()
    let captured = ''
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn()
          .mockResolvedValueOnce(toolUseResponse('git_create_branch', { name: 'main' }))
          .mockImplementationOnce(async (req: { messages: Array<{ role: string; content: unknown }> }) => {
            captured = (req.messages[req.messages.length - 1].content as Array<{ content?: string }>)[0]?.content ?? ''
            return taskCompleteResponse()
          }),
      },
    }) as unknown as InstanceType<typeof Anthropic>)

    const { runWithToolUse } = await import('./tool-use-runner')
    await runWithToolUse('Branch', { apiKey: 'k', projectRoot: dir })
    expect(captured).toContain('cannot create branch')
  })

  it('stops after maxTurns and returns success=false', async () => {
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: { create: vi.fn().mockResolvedValue(toolUseResponse('list_files', { dir: '.' })) },
    }) as unknown as InstanceType<typeof Anthropic>)

    const { runWithToolUse } = await import('./tool-use-runner')
    const result = await runWithToolUse('Loop', { apiKey: 'k', projectRoot: makeTempDir(), maxTurns: 3 })
    expect(result.success).toBe(false)
    expect(result.turnsUsed).toBe(3)
  })

  it('estimates cost from token usage', async () => {
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'tool_use', id: 't1', name: 'task_complete', input: { summary: 'done' } }],
          stop_reason: 'tool_use',
          usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 },
        }),
      },
    }) as unknown as InstanceType<typeof Anthropic>)

    const { runWithToolUse } = await import('./tool-use-runner')
    const result = await runWithToolUse('Cost', { apiKey: 'k', projectRoot: makeTempDir() })
    // 1M * $3 input + 1M * $15 output = $18
    expect(result.estimatedCostUsd).toBeCloseTo(18, 0)
  })
})
