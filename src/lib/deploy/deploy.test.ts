import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { deployApp } from './deploy'
import type { CommandRunner } from './types'

let dir: string
let calls: Array<{ cmd: string; args: string[] }>

function makeRunner(over: Partial<CommandRunner> = {}): CommandRunner {
  return {
    run(cmd, args) { calls.push({ cmd, args }); return '' },
    spawn(cmd, args) { calls.push({ cmd, args }); return 4242 },
    ...over,
  }
}

const freePort = async () => 5555

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'fp-deployx-')); calls = [] })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

describe('deployApp — guards', () => {
  it('errors when the repo path is missing', async () => {
    const res = await deployApp({ repoPath: join(dir, 'nope'), provider: 'local' }, { runner: makeRunner(), freePort })
    expect(res.status).toBe('error')
  })
})

describe('deployApp — local', () => {
  it('installs when node_modules is missing, builds, then spawns start on the chosen port', async () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { build: 'next build', start: 'next start' } }))
    const res = await deployApp({ repoPath: dir, provider: 'local' }, { runner: makeRunner(), freePort })
    expect(res.status).toBe('ok')
    if (res.status === 'ok') {
      expect(res.url).toBe('http://localhost:5555')
      expect(res.pid).toBe(4242)
    }
    expect(calls.map(c => c.args.join(' '))).toEqual(['install', 'run build', 'run start'])
  })

  it('skips install when node_modules exists', async () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { start: 'node s.js' } }))
    mkdirSync(join(dir, 'node_modules'))
    const res = await deployApp({ repoPath: dir, provider: 'local' }, { runner: makeRunner(), freePort })
    expect(res.status).toBe('ok')
    expect(calls.find(c => c.args[0] === 'install')).toBeUndefined()
  })

  it('errors when there is no start/dev script', async () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: {} }))
    const res = await deployApp({ repoPath: dir, provider: 'local' }, { runner: makeRunner(), freePort })
    expect(res.status).toBe('error')
  })
})

describe('deployApp — vercel', () => {
  it('parses the vercel.app URL from CLI output', async () => {
    writeFileSync(join(dir, 'package.json'), '{}')
    const runner = makeRunner({ run: (cmd, args) => { calls.push({ cmd, args }); return 'Inspect: ...\nhttps://my-app-abc.vercel.app' } })
    const res = await deployApp({ repoPath: dir, provider: 'vercel', production: true }, { runner, freePort })
    expect(res.status).toBe('ok')
    if (res.status === 'ok') expect(res.url).toBe('https://my-app-abc.vercel.app')
    expect(calls[0]!.args).toContain('--prod')
  })

  it('maps a login error to a friendly hint', async () => {
    writeFileSync(join(dir, 'package.json'), '{}')
    const runner = makeRunner({ run: () => { throw new Error('Error: No existing credentials found. Please run vercel login') } })
    const res = await deployApp({ repoPath: dir, provider: 'vercel' }, { runner, freePort })
    expect(res.status).toBe('error')
    if (res.status === 'error') expect(res.error).toMatch(/login/i)
  })
})

describe('deployApp — docker', () => {
  it('writes a Dockerfile, builds the image and runs the container', async () => {
    writeFileSync(join(dir, 'package.json'), '{}')
    const runner = makeRunner({
      run: (cmd, args) => { calls.push({ cmd, args }); return args[0] === 'run' ? 'container1234567890' : '' },
    })
    const res = await deployApp({ repoPath: dir, provider: 'docker' }, { runner, freePort })
    expect(res.status).toBe('ok')
    if (res.status === 'ok') expect(res.url).toBe('http://localhost:5555')
    expect(existsSync(join(dir, 'Dockerfile'))).toBe(true)
    expect(calls.some(c => c.cmd === 'docker' && c.args[0] === 'build')).toBe(true)
    expect(calls.some(c => c.cmd === 'docker' && c.args[0] === 'run')).toBe(true)
  })

  it('maps a daemon-down error to a friendly hint', async () => {
    writeFileSync(join(dir, 'package.json'), '{}')
    const runner = makeRunner({ run: () => { throw new Error('Cannot connect to the Docker daemon') } })
    const res = await deployApp({ repoPath: dir, provider: 'docker' }, { runner, freePort })
    expect(res.status).toBe('error')
    if (res.status === 'error') expect(res.error).toMatch(/Docker/)
  })
})
