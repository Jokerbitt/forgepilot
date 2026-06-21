import { describe, it, expect } from 'vitest'
import { buildOllamaTaskPrompt } from './ollama-prompt'

describe('buildOllamaTaskPrompt', () => {
  it('includes goal, context, and definition of done', () => {
    const p = buildOllamaTaskPrompt({
      goal: 'Add data-testid to the home page',
      context: 'Edit src/app/page.tsx',
      definitionOfDone: ['data-testid present', 'build green'],
    })
    expect(p).toContain('TASK: Add data-testid to the home page')
    expect(p).toContain('CONTEXT:\nEdit src/app/page.tsx')
    expect(p).toContain('- data-testid present')
    expect(p).toContain('- build green')
    expect(p).toContain('TASK_COMPLETE')
    expect(p).toContain('tool calls')
  })

  it('omits empty context and DoD sections', () => {
    const p = buildOllamaTaskPrompt({ goal: 'Just do it' })
    expect(p).toContain('TASK: Just do it')
    expect(p).not.toContain('CONTEXT:')
    expect(p).not.toContain('DEFINITION OF DONE:')
  })

  it('stays compact — local models choke on huge prompts', () => {
    const p = buildOllamaTaskPrompt({ goal: 'g', context: 'c', definitionOfDone: ['d'] })
    expect(p.length).toBeLessThan(800)
  })
})
