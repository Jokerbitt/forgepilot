import { describe, expect, it } from 'vitest'
import { PROJECTS_LOADING_SKELETON_COUNT } from './loading-config'

describe('Projects page loading state', () => {
  it('keeps the loading skeleton compact', () => {
    expect(PROJECTS_LOADING_SKELETON_COUNT).toBe(3)
  })
})
