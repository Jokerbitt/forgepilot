import { describe, it, expect } from 'vitest'
import { toShareLink } from './share'

describe('toShareLink', () => {
  it('accepts a public URL as shareable', () => {
    const s = toShareLink('https://my-app.vercel.app')
    expect(s.valid).toBe(true)
    expect(s.isLocal).toBe(false)
    expect(s.note).toMatch(/öffentlich/)
  })

  it('adds https:// when the scheme is missing', () => {
    expect(toShareLink('my-app.vercel.app').url).toBe('https://my-app.vercel.app/')
  })

  it('flags localhost and LAN addresses as local-only', () => {
    expect(toShareLink('http://localhost:3001').isLocal).toBe(true)
    expect(toShareLink('http://192.168.0.5:3000').isLocal).toBe(true)
    expect(toShareLink('http://localhost:3001').note).toMatch(/nur auf deinem/)
  })

  it('rejects empty and invalid input', () => {
    expect(toShareLink('').valid).toBe(false)
    expect(toShareLink('   ').valid).toBe(false)
    expect(toShareLink('http://').valid).toBe(false)
  })
})
