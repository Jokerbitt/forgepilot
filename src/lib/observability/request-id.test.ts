import { describe, it, expect, vi } from 'vitest'
import { getRequestId, loggerForRequest, REQUEST_ID_HEADER } from './request-id'

function reqWith(headers: Record<string, string>): { headers: Headers } {
  return { headers: new Headers(headers) }
}

describe('getRequestId', () => {
  it('returns the x-request-id header verbatim when present', () => {
    expect(getRequestId(reqWith({ [REQUEST_ID_HEADER]: 'abc-123-xyz' }))).toBe('abc-123-xyz')
  })

  it('accepts a bare Headers instance', () => {
    const h = new Headers({ [REQUEST_ID_HEADER]: 'plain-headers-9999' })
    expect(getRequestId(h)).toBe('plain-headers-9999')
  })

  it('returns "unknown" when no header is set', () => {
    expect(getRequestId(reqWith({}))).toBe('unknown')
  })

  it('returns "unknown" when the source is undefined', () => {
    expect(getRequestId(undefined)).toBe('unknown')
  })

  it('returns "unknown" when the header object is null', () => {
    expect(getRequestId({ headers: null as unknown as Headers })).toBe('unknown')
  })

  it('uses the header even when other headers come along for the ride', () => {
    expect(
      getRequestId(reqWith({ 'content-type': 'application/json', [REQUEST_ID_HEADER]: 'real-id' })),
    ).toBe('real-id')
  })
})

describe('loggerForRequest', () => {
  it('returns a child logger seeded with the request id', () => {
    const calls: Array<Record<string, string>> = []
    const stub = {
      child: vi.fn((bindings: Record<string, string>) => {
        calls.push(bindings)
        return stub
      }),
    } as unknown as Parameters<typeof loggerForRequest>[2]

    loggerForRequest(reqWith({ [REQUEST_ID_HEADER]: 'req-9' }), undefined, stub)
    expect(calls).toEqual([{ requestId: 'req-9' }])
  })

  it('adds the route binding when provided', () => {
    const calls: Array<Record<string, string>> = []
    const stub = {
      child: (bindings: Record<string, string>) => {
        calls.push(bindings)
        return stub
      },
    } as unknown as Parameters<typeof loggerForRequest>[2]

    loggerForRequest(reqWith({ [REQUEST_ID_HEADER]: 'req-12' }), 'delegations.create', stub)
    expect(calls[0]).toEqual({ requestId: 'req-12', route: 'delegations.create' })
  })

  it('still works (with requestId="unknown") when middleware did not run', () => {
    const child = vi.fn()
    const stub = { child } as unknown as Parameters<typeof loggerForRequest>[2]
    child.mockReturnValue(stub)

    loggerForRequest(undefined, 'cron.tick', stub)
    expect(child).toHaveBeenCalledWith({ requestId: 'unknown', route: 'cron.tick' })
  })
})
