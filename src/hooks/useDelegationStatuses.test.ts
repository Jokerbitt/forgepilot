import { expect, it } from 'vitest'
import { useDelegationStatuses } from './useDelegationStatuses'

it('exports useDelegationStatuses', () => {
  expect(typeof useDelegationStatuses).toBe('function')
})
