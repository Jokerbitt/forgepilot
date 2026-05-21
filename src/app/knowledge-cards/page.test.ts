import { describe, it, expect } from 'vitest'
import KnowledgeCardsPage from './page'

describe('KnowledgeCardsPage', () => {
  it('exports KnowledgeCardsPage as default', () => {
    expect(typeof KnowledgeCardsPage).toBe('function')
  })
})
