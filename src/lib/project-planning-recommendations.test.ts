import { describe, it, expect } from 'vitest'
import {
  platformLabel,
  persistenceLabel,
  resolveTargetPlatform,
  resolvePersistenceStrategy,
  platformPromptGuidance,
  persistencePromptGuidance,
} from './project-planning-recommendations'

describe('platformLabel', () => {
  it('returns Webapp for webapp', () => {
    expect(platformLabel('webapp')).toBe('Webapp')
  })

  it('returns Desktop App for desktop', () => {
    expect(platformLabel('desktop')).toBe('Desktop App')
  })

  it('returns mobile label for mobile', () => {
    expect(platformLabel('mobile')).toContain('Mobile')
  })

  it('returns cross-platform label for cross_platform', () => {
    expect(platformLabel('cross_platform')).toContain('Cross-platform')
  })

  it('returns recommendation fallback for undecided', () => {
    expect(platformLabel('undecided')).toContain('empfehlen')
  })
})

describe('persistenceLabel', () => {
  it('maps postgres to PostgreSQL', () => {
    expect(persistenceLabel('postgres')).toBe('PostgreSQL')
  })

  it('maps sqlite to SQLite', () => {
    expect(persistenceLabel('sqlite')).toBe('SQLite')
  })

  it('maps json_file', () => {
    expect(persistenceLabel('json_file')).toContain('JSON')
  })

  it('maps supabase', () => {
    expect(persistenceLabel('supabase')).toContain('Supabase')
  })

  it('maps none', () => {
    expect(persistenceLabel('none')).toContain('Keine')
  })

  it('returns recommendation fallback for recommend', () => {
    expect(persistenceLabel('recommend')).toContain('empfehlen')
  })
})

describe('resolveTargetPlatform', () => {
  it('returns the requested platform when not undecided', () => {
    expect(resolveTargetPlatform('Build a dashboard', 'mobile')).toBe('mobile')
    expect(resolveTargetPlatform('Build a dashboard', 'desktop')).toBe('desktop')
  })

  it('resolves to webapp when idea has browser/saas keywords', () => {
    expect(resolveTargetPlatform('Build a SaaS dashboard', 'undecided')).toBe('webapp')
    expect(resolveTargetPlatform('Admin portal for team collaboration', 'undecided')).toBe('webapp')
  })

  it('resolves to mobile when idea has mobile keywords', () => {
    expect(resolveTargetPlatform('iOS app with push notifications for smartphone', 'undecided')).toBe('mobile')
    expect(resolveTargetPlatform('Android Handy App', 'undecided')).toBe('mobile')
  })

  it('resolves to desktop when idea has desktop/offline keywords', () => {
    expect(resolveTargetPlatform('Local file manager for macOS desktop', 'undecided')).toBe('desktop')
    expect(resolveTargetPlatform('Offline tool working with lokale Dateien', 'undecided')).toBe('desktop')
  })

  it('resolves to cross_platform when multiple platform keywords are present', () => {
    expect(resolveTargetPlatform('Mobile and web dashboard with team sharing', 'undecided')).toBe('cross_platform')
  })

  it('uses customPlatformNote to return the requested platform when note is provided', () => {
    expect(resolveTargetPlatform('anything', 'undecided', 'specific platform')).toBe('webapp')
    expect(resolveTargetPlatform('anything', 'mobile', 'specific note')).toBe('mobile')
  })

  it('defaults to webapp for neutral ideas', () => {
    expect(resolveTargetPlatform('Build a todo app', 'undecided')).toBe('webapp')
  })
})

describe('resolvePersistenceStrategy', () => {
  it('returns non-recommend strategy as-is', () => {
    expect(resolvePersistenceStrategy('any idea', 'sqlite', 'webapp')).toBe('sqlite')
    expect(resolvePersistenceStrategy('any idea', 'postgres', 'mobile')).toBe('postgres')
    expect(resolvePersistenceStrategy('any idea', 'json_file', 'desktop')).toBe('json_file')
  })

  it('resolves recommend to postgres for webapp platform', () => {
    expect(resolvePersistenceStrategy('Build a management tool', 'recommend', 'webapp')).toBe('postgres')
  })

  it('resolves recommend to postgres for cross_platform', () => {
    expect(resolvePersistenceStrategy('Build a cross platform app', 'recommend', 'cross_platform')).toBe('postgres')
  })

  it('resolves recommend to sqlite for desktop offline apps', () => {
    expect(resolvePersistenceStrategy('A desktop offline lokale app', 'recommend', 'desktop')).toBe('sqlite')
  })

  it('resolves recommend to postgres when idea mentions team/audit/saas', () => {
    expect(resolvePersistenceStrategy('SaaS team with audit logs', 'recommend', 'mobile')).toBe('postgres')
  })

  it('resolves recommend to json_file for prototypes', () => {
    expect(resolvePersistenceStrategy('Just a little Prototyp experiment', 'recommend', 'mobile')).toBe('json_file')
  })
})

describe('platformPromptGuidance', () => {
  it('returns customPlatformNote guidance when note is provided', () => {
    const guidance = platformPromptGuidance('webapp', 'My custom platform note')
    expect(guidance).toContain('My custom platform note')
  })

  it('returns webapp guidance for webapp', () => {
    expect(platformPromptGuidance('webapp')).toContain('Browser-first')
  })

  it('returns mobile guidance for mobile', () => {
    expect(platformPromptGuidance('mobile')).toContain('Touch-first')
  })

  it('returns undecided fallback for undecided', () => {
    expect(platformPromptGuidance('undecided')).toContain('empfehlen')
  })
})

describe('persistencePromptGuidance', () => {
  it('returns postgres guidance for postgres', () => {
    expect(persistencePromptGuidance('postgres')).toContain('PostgreSQL')
  })

  it('returns sqlite guidance for sqlite', () => {
    expect(persistencePromptGuidance('sqlite')).toContain('SQLite')
  })

  it('returns json_file guidance for json_file', () => {
    expect(persistencePromptGuidance('json_file')).toContain('JSON')
  })

  it('returns recommendation fallback for recommend', () => {
    expect(persistencePromptGuidance('recommend')).toContain('empfehlen')
  })
})
