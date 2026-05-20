/**
 * logger/index.test.ts — Structured logger tests
 *
 * Verify that:
 * - The base logger instantiates without errors
 * - Child loggers are created with correct module fields
 * - Logging methods (info, warn, error) work without throwing
 */

import { describe, it, expect } from 'vitest'
import { logger, aiLogger, evalLogger, dsgvoLogger, delegationLogger, orchestrationLogger, apiLogger } from './index'

describe('Pino Logger', () => {
  it('creates the base logger without errors', () => {
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
  })

  it('creates child loggers with correct module fields', () => {
    const expectedModules = [
      { logger: aiLogger, moduleName: 'ai' },
      { logger: evalLogger, moduleName: 'eval' },
      { logger: dsgvoLogger, moduleName: 'dsgvo' },
      { logger: delegationLogger, moduleName: 'delegation' },
      { logger: orchestrationLogger, moduleName: 'orchestration' },
      { logger: apiLogger, moduleName: 'api' },
    ]

    for (const { logger: childLogger, moduleName } of expectedModules) {
      expect(childLogger).toBeDefined()
      expect(typeof childLogger.info).toBe('function')
      // Verify the child logger has the module field in its bindings
      // by checking that it's a child of the base logger
      expect(childLogger).toHaveProperty('bindings')
      const bindings = (childLogger as unknown as { bindings: () => Record<string, unknown> }).bindings?.()
      expect(bindings?.module).toBe(moduleName)
    }
  })

  it('logs info messages without throwing', () => {
    expect(() => {
      aiLogger.info(
        { event: 'ai.generate', provider: 'anthropic', model: 'claude-opus' },
        'Test AI generation logging'
      )
    }).not.toThrow()
  })

  it('logs error messages without throwing', () => {
    expect(() => {
      dsgvoLogger.error(
        { event: 'ledger.insert_error', error: 'Test error message' },
        'Test error logging'
      )
    }).not.toThrow()
  })

  it('logs warn messages without throwing', () => {
    expect(() => {
      apiLogger.warn(
        { event: 'api.missing_auth' },
        'Test warning logging'
      )
    }).not.toThrow()
  })
})
