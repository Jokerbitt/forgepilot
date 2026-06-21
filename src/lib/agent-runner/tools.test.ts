import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  execBash,
  readFileTool,
  writeFileTool,
  editFileTool,
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

  it('edit_file surgically replaces a unique snippet, preserving the rest', () => {
    const original = 'line A\n<div>\n  body\n</div>\nline B'
    fs.writeFileSync(path.join(tmpDir, 'page.tsx'), original)
    const result = editFileTool('page.tsx', '<div>', '<div data-testid="home-root">', tmpDir)
    expect(result.ok).toBe(true)
    const onDisk = fs.readFileSync(path.join(tmpDir, 'page.tsx'), 'utf-8')
    expect(onDisk).toBe('line A\n<div data-testid="home-root">\n  body\n</div>\nline B')
  })

  it('edit_file refuses when old_string is missing', () => {
    fs.writeFileSync(path.join(tmpDir, 'f.txt'), 'hello world')
    const result = editFileTool('f.txt', 'NOT THERE', 'x', tmpDir)
    expect(result.ok).toBe(false)
    expect(result.output).toContain('not found')
    expect(fs.readFileSync(path.join(tmpDir, 'f.txt'), 'utf-8')).toBe('hello world')
  })

  it('edit_file refuses when old_string is not unique', () => {
    fs.writeFileSync(path.join(tmpDir, 'f.txt'), 'x x x')
    const result = editFileTool('f.txt', 'x', 'y', tmpDir)
    expect(result.ok).toBe(false)
    expect(result.output).toContain('not unique')
    expect(fs.readFileSync(path.join(tmpDir, 'f.txt'), 'utf-8')).toBe('x x x')
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
