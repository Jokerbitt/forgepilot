import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { checkPwa, buildManifest, buildServiceWorker, pwaPlanStep } from './pwa'

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-pwa-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function write(rel: string, content = 'x') {
  const full = path.join(dir, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

describe('checkPwa', () => {
  it('reports nothing in place for a bare app', () => {
    const r = checkPwa(dir)
    expect(r.score).toBe(0)
    expect(r.installable).toBe(false)
    expect(r.findings).toHaveLength(2)
    expect(r.summary).toMatch(/Noch keine Handy-App/)
  })

  it('reports partial when only the manifest exists', () => {
    write('public/manifest.webmanifest', '{}')
    const r = checkPwa(dir)
    expect(r.hasManifest).toBe(true)
    expect(r.hasServiceWorker).toBe(false)
    expect(r.score).toBe(50)
    expect(r.installable).toBe(false)
    expect(r.summary).toMatch(/Teilweise/)
  })

  it('reports installable when manifest + service worker exist', () => {
    write('public/manifest.webmanifest', '{}')
    write('public/sw.js', '// sw')
    const r = checkPwa(dir)
    expect(r.installable).toBe(true)
    expect(r.score).toBe(100)
    expect(r.summary).toMatch(/installierbar/)
  })

  it('handles a missing folder gracefully', () => {
    const r = checkPwa(path.join(dir, 'does-not-exist'))
    expect(r.score).toBe(0)
    expect(r.summary).toMatch(/nicht gefunden/)
  })
})

describe('buildManifest', () => {
  it('produces valid JSON with the app name and standalone display', () => {
    const parsed = JSON.parse(buildManifest({ name: 'PlantVault' })) as Record<string, unknown>
    expect(parsed.name).toBe('PlantVault')
    expect(parsed.display).toBe('standalone')
    expect(parsed.start_url).toBe('/')
    expect(Array.isArray(parsed.icons)).toBe(true)
  })

  it('truncates an overly long short_name and falls back on empty name', () => {
    const parsed = JSON.parse(buildManifest({ name: 'A-Very-Long-Application-Name' })) as { short_name: string }
    expect(parsed.short_name.length).toBeLessThanOrEqual(12)
    const fallback = JSON.parse(buildManifest({ name: '   ' })) as { name: string }
    expect(fallback.name).toBe('Meine App')
  })
})

describe('buildServiceWorker', () => {
  it('registers install, activate and fetch handlers with a cache', () => {
    const sw = buildServiceWorker()
    expect(sw).toContain("addEventListener('install'")
    expect(sw).toContain("addEventListener('fetch'")
    expect(sw).toContain('caches.open')
  })
})

describe('pwaPlanStep', () => {
  it('embeds the manifest and service-worker contents for the agent', () => {
    const step = pwaPlanStep('PlantVault')
    expect(step.title).toMatch(/PWA/)
    expect(step.description).toContain('public/manifest.webmanifest')
    expect(step.description).toContain('public/sw.js')
    expect(step.description).toContain('PlantVault')
  })
})
