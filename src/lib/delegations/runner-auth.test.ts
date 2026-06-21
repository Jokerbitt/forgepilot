import { describe, it, expect } from 'vitest'
import { resolveCliAnthropicKey } from './runner-auth'

describe('resolveCliAnthropicKey', () => {
  it('defers to the OAuth token: injects NO key when CLAUDE_CODE_OAUTH_TOKEN is set', () => {
    // Prevents a credit-less stored key from shadowing the Max OAuth token.
    expect(resolveCliAnthropicKey({ oauthToken: 'sk-ant-oat01-abc', storedKey: 'sk-ant-api-dead' })).toBeUndefined()
  })

  it('injects the stored key when there is no OAuth token', () => {
    expect(resolveCliAnthropicKey({ oauthToken: undefined, storedKey: 'sk-ant-api-live' })).toBe('sk-ant-api-live')
  })

  it('treats blank/whitespace OAuth token as absent', () => {
    expect(resolveCliAnthropicKey({ oauthToken: '   ', storedKey: 'sk-ant-api-live' })).toBe('sk-ant-api-live')
  })

  it('returns undefined when neither is set', () => {
    expect(resolveCliAnthropicKey({})).toBeUndefined()
    expect(resolveCliAnthropicKey({ oauthToken: null, storedKey: null })).toBeUndefined()
    expect(resolveCliAnthropicKey({ storedKey: '  ' })).toBeUndefined()
  })
})
