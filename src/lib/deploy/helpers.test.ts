import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createServer, type Server } from 'net'
import { findFreePort, detectStartPlan, generateDockerfile, dockerImageTag } from './helpers'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'fp-deploy-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

describe('findFreePort', () => {
  it('returns a usable free port', async () => {
    const port = await findFreePort(34567, 20)
    expect(port).toBeGreaterThanOrEqual(34567)
  })

  it('skips a port that is already in use', async () => {
    const occupied = 34580
    const srv: Server = createServer()
    await new Promise<void>(res => srv.listen(occupied, '127.0.0.1', res))
    try {
      const port = await findFreePort(occupied, 20)
      expect(port).toBeGreaterThan(occupied)
    } finally {
      await new Promise<void>(res => srv.close(() => res()))
    }
  })
})

describe('detectStartPlan', () => {
  it('prefers build + start with needsBuild', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { build: 'next build', start: 'next start' } }))
    expect(detectStartPlan(dir)).toEqual({ needsBuild: true, steps: ['build', 'start'] })
  })

  it('falls back to start only', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { start: 'node server.js' } }))
    expect(detectStartPlan(dir)).toEqual({ needsBuild: false, steps: ['start'] })
  })

  it('falls back to dev', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'next dev' } }))
    expect(detectStartPlan(dir)).toEqual({ needsBuild: false, steps: ['dev'] })
  })

  it('returns empty steps when no scripts exist', () => {
    expect(detectStartPlan(dir)).toEqual({ needsBuild: false, steps: [] })
  })
})

describe('generateDockerfile', () => {
  it('includes the port and a start command', () => {
    const df = generateDockerfile(4000)
    expect(df).toContain('ENV PORT=4000')
    expect(df).toContain('EXPOSE 4000')
    expect(df).toContain('npm run build --if-present')
    expect(df).toContain('CMD ["npm", "run", "start"]')
  })
})

describe('dockerImageTag', () => {
  it('builds a safe slugged tag from the repo path', () => {
    expect(dockerImageTag('/Users/me/dev/My Cool App')).toBe('forgepilot/my-cool-app')
    expect(dockerImageTag('/tmp/')).toBe('forgepilot/tmp')
  })
})
