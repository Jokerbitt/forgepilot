import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getTheme, setTheme, getSystemTheme, defaultTheme } from '@/lib/theme/theme-store'

// Mock classList
const classListMock = {
  _classes: new Set<string>(),
  add(cls: string) { this._classes.add(cls) },
  remove(cls: string) { this._classes.delete(cls) },
  contains(cls: string) { return this._classes.has(cls) },
}

// Mock localStorage
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { for (const k in store) { delete store[k] } },
}

vi.stubGlobal('localStorage', localStorageMock)
vi.stubGlobal('window', {
  localStorage: localStorageMock,
  matchMedia: vi.fn().mockImplementation((query: string) => ({ matches: query.includes('dark') })),
})
vi.stubGlobal('document', {
  documentElement: { classList: classListMock },
})

describe('theme-store', () => {
  beforeEach(() => {
    localStorageMock.clear()
    classListMock._classes.clear()
  })

  it('getTheme() returns "dark" when localStorage is empty', () => {
    expect(getTheme()).toBe('dark')
  })

  it('defaultTheme is "dark"', () => {
    expect(defaultTheme).toBe('dark')
  })

  it('setTheme() updates localStorage', () => {
    setTheme('light')
    expect(localStorageMock.getItem('fp-theme')).toBe('light')
  })

  it('getTheme() returns stored value after setTheme("light")', () => {
    setTheme('light')
    expect(getTheme()).toBe('light')
  })

  it('getTheme() returns stored value after setTheme("dark")', () => {
    setTheme('dark')
    expect(getTheme()).toBe('dark')
  })

  it('setTheme("light") removes "dark" class from documentElement', () => {
    classListMock._classes.add('dark')
    setTheme('light')
    expect(classListMock.contains('dark')).toBe(false)
  })

  it('setTheme("dark") adds "dark" class to documentElement', () => {
    setTheme('dark')
    expect(classListMock.contains('dark')).toBe(true)
  })

  it('getSystemTheme() returns "dark" when prefers-color-scheme matches dark', () => {
    expect(getSystemTheme()).toBe('dark')
  })
})
