import { describe, it, expect } from 'vitest'
import { detectStack, resolveStackGate } from './stack-gate'

describe('detectStack', () => {
  it('detects node via package.json', () => {
    expect(detectStack(['package.json', 'README.md'])).toBe('node')
  })

  it('detects python via pyproject.toml / setup.py / requirements.txt', () => {
    expect(detectStack(['pyproject.toml'])).toBe('python')
    expect(detectStack(['setup.py'])).toBe('python')
    expect(detectStack(['requirements.txt'])).toBe('python')
  })

  it('detects go via go.mod', () => {
    expect(detectStack(['go.mod', 'main.go'])).toBe('go')
  })

  it('detects rust via Cargo.toml', () => {
    expect(detectStack(['Cargo.toml', 'src'])).toBe('rust')
  })

  it('returns unknown when no marker is present', () => {
    expect(detectStack(['README.md', 'LICENSE'])).toBe('unknown')
    expect(detectStack([])).toBe('unknown')
  })

  it('prefers node when both node and another marker exist', () => {
    expect(detectStack(['package.json', 'go.mod'])).toBe('node')
  })
})

describe('resolveStackGate — Node path is bit-identical to the legacy npm logic', () => {
  it('build present only when a build script exists → npm run build', () => {
    const gate = resolveStackGate({ files: ['package.json'], scripts: { build: 'next build' } })
    expect(gate.stack).toBe('node')
    expect(gate.build).toEqual({ cmd: 'npm', args: ['run', 'build'] })
  })

  it('omits build when there is no build script (gate would skip — unchanged)', () => {
    const gate = resolveStackGate({ files: ['package.json'], scripts: { 'test:run': 'vitest run' } })
    expect(gate.build).toBeUndefined()
  })

  it('test prefers test:run (ForgePilot convention) → npm run test:run', () => {
    const gate = resolveStackGate({
      files: ['package.json'],
      scripts: { build: 'next build', 'test:run': 'vitest run', test: 'vitest' },
    })
    expect(gate.test).toEqual({ cmd: 'npm', args: ['run', 'test:run'] })
  })

  it('test falls back to plain test for external repos → npm run test', () => {
    const gate = resolveStackGate({
      files: ['package.json'],
      scripts: { build: 'next build', test: 'vitest run' },
    })
    expect(gate.test).toEqual({ cmd: 'npm', args: ['run', 'test'] })
  })

  it('omits test when there is no test script (gate would skip — unchanged)', () => {
    const gate = resolveStackGate({ files: ['package.json'], scripts: { build: 'next build' } })
    expect(gate.test).toBeUndefined()
  })

  it('omits both when scripts is missing entirely', () => {
    const gate = resolveStackGate({ files: ['package.json'], scripts: undefined })
    expect(gate.build).toBeUndefined()
    expect(gate.test).toBeUndefined()
    expect(gate.stack).toBe('node')
  })
})

describe('resolveStackGate — Python', () => {
  it('runs pytest, no build step', () => {
    const gate = resolveStackGate({ files: ['pyproject.toml'] })
    expect(gate.stack).toBe('python')
    expect(gate.test).toEqual({ cmd: 'python3', args: ['-m', 'pytest', '-q'] })
    expect(gate.build).toBeUndefined()
  })

  it('ignores any package.json scripts when stack is python', () => {
    // Python markers without package.json must not pick up Node scripts.
    const gate = resolveStackGate({ files: ['requirements.txt'], scripts: { build: 'next build' } })
    expect(gate.stack).toBe('python')
    expect(gate.build).toBeUndefined()
  })
})

describe('resolveStackGate — Go', () => {
  it('builds and tests with the go toolchain', () => {
    const gate = resolveStackGate({ files: ['go.mod'] })
    expect(gate.stack).toBe('go')
    expect(gate.build).toEqual({ cmd: 'go', args: ['build', './...'] })
    expect(gate.test).toEqual({ cmd: 'go', args: ['test', './...'] })
  })
})

describe('resolveStackGate — Rust', () => {
  it('builds and tests with cargo', () => {
    const gate = resolveStackGate({ files: ['Cargo.toml'] })
    expect(gate.stack).toBe('rust')
    expect(gate.build).toEqual({ cmd: 'cargo', args: ['build'] })
    expect(gate.test).toEqual({ cmd: 'cargo', args: ['test'] })
  })
})

describe('resolveStackGate — unknown', () => {
  it('returns no commands for an unrecognised stack (caller logs "ungated")', () => {
    const gate = resolveStackGate({ files: ['README.md'] })
    expect(gate).toEqual({ stack: 'unknown' })
  })
})
