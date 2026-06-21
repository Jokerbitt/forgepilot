import { describe, it, expect } from 'vitest'
import { selectDomains, buildKnowledgeBlock } from './knowledge-packages'

describe('selectDomains', () => {
  it('returns typescript by default for any code task', () => {
    const domains = selectDomains('add a new button', '', undefined)
    expect(domains).toContain('typescript')
  })

  it('detects nextjs from goal keywords', () => {
    const domains = selectDomains('create a new API route handler in Next.js', '', undefined)
    expect(domains).toContain('nextjs')
  })

  it('detects testing domain from goal', () => {
    const domains = selectDomains('write vitest tests for the delegation model', '', undefined)
    expect(domains).toContain('testing')
  })

  it('respects skillCategory for ui-component', () => {
    const domains = selectDomains('build a form', '', 'ui-component')
    expect(domains).toContain('react')
    expect(domains).toContain('css')
  })

  it('limits to 3 domains max', () => {
    const domains = selectDomains('nextjs api route with testing and security auth', '', 'api-route')
    expect(domains.length).toBeLessThanOrEqual(3)
  })
})

describe('buildKnowledgeBlock', () => {
  it('returns a non-empty string for a code goal', () => {
    const block = buildKnowledgeBlock('build a REST API endpoint', '', 'api-route')
    expect(block.length).toBeGreaterThan(50)
    expect(block).toContain('Engineering Knowledge')
  })

  it('includes relevant domain content', () => {
    const block = buildKnowledgeBlock('write unit tests', '', 'test')
    expect(block).toContain('Vitest')
  })
})
