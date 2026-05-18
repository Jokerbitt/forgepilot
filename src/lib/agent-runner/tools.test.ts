import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  execBash,
  readFileTool,
  writeFileTool,
  listDirTool,
  isCommandSafe,
  executeToolCall,
  type OllamaToolCall,
} from './tools'

describe('isCommandSafe', () => {
  it('allows benign commands', () => {
    expect(isCommandSafe('ls -la').safe).toBe(true)
    expect(isCommandSafe('npm test').safe).toBe(true)
  })

  it('blocks rm -rf on root and home', () => {
    expect(isCommandSafe('rm -rf /').safe).toBe(false)
    expect(isCommandSafe('rm -rf ~').safe).toBe(false)
    expect(isCommandSafe('rm -rf ~/').safe).toBe(false)
    expect(isCommandSafe('rm -rf $HOME').safe).toBe(false)
  })

  it('rejects empty commands', () => {
    expect(isCommandSafe('').safe).toBe(false)
    expect(isCommandSafe('   ').safe).toBe(false)
  })
})

describe('tool executor', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgepilot-tools-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('bash_exec runs a command and returns output', () => {
    const result = execBash('echo hello-forge', tmpDir)
    expect(result.ok).toBe(true)
    expect(result.output).toContain('hello-forge')
  })

  it('bash_exec blocks dangerous commands without running them', () => {
    const result = execBash('rm -rf /', tmpDir)
    expect(result.ok).toBe(false)
    expect(result.output).toContain('BLOCKED')
  })

  it('read_file returns file content', () => {
    const file = path.join(tmpDir, 'note.txt')
    fs.writeFileSync(file, 'forge content', 'utf-8')
    const result = readFileTool('note.txt', tmpDir)
    expect(result.ok).toBe(true)
    expect(result.output).toBe('forge content')
  })

  it('write_file writes content to disk', () => {
    const result = writeFileTool('out.txt', 'written-data', tmpDir)
    expect(result.ok).toBe(true)
    const onDisk = fs.readFileSync(path.join(tmpDir, 'out.txt'), 'utf-8')
    expect(onDisk).toBe('written-data')
  })

  it('list_dir lists directory entries', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'a')
    fs.mkdirSync(path.join(tmpDir, 'sub'))
    const result = listDirTool('.', tmpDir)
    expect(result.ok).toBe(true)
    expect(result.output).toContain('a.txt')
    expect(result.output).toContain('sub/')
  })

  it('executeToolCall dispatches to the right tool', () => {
    const call: OllamaToolCall = {
      function: { name: 'bash_exec', arguments: { command: 'echo dispatch-test' } },
    }
    const result = executeToolCall(call, tmpDir)
    expect(result.ok).toBe(true)
    expect(result.output).toContain('dispatch-test')
  })

  it('executeToolCall rejects unknown tools', () => {
    const call: OllamaToolCall = {
      function: { name: 'nonexistent_tool', arguments: {} },
    }
    const result = executeToolCall(call, tmpDir)
    expect(result.ok).toBe(false)
    expect(result.output).toContain('Unknown tool')
  })
})
