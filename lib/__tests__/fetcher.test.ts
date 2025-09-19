import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import { jsonFetch } from '../fetcher'

const originalFetch = global.fetch

describe('jsonFetch', () => {
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('adds a cache-busting timestamp and disables caching by default', async () => {
    const calls: Array<[unknown, RequestInit | undefined]> = []

    global.fetch = (async (input: unknown, init?: RequestInit) => {
      calls.push([input, init])
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as any
    }) as typeof fetch

    const result = await jsonFetch<{ success: boolean }>('/api/test')

    assert.deepEqual(result, { success: true })
    assert.ok(calls.length === 1, 'fetch should be called exactly once')

    const [url, options] = calls[0]
    assert.match(String(url), /^\/api\/test\?ts=\d+$/)
    assert.equal(options?.cache, 'no-store')
    const headers = options?.headers as any
    const acceptHeader = headers?.['Accept'] ?? headers?.get?.('Accept')
    assert.equal(acceptHeader, 'application/json')
  })

  it('respects opt-out flags and merges custom headers', async () => {
    const calls: Array<[unknown, RequestInit | undefined]> = []

    global.fetch = (async (input: unknown, init?: RequestInit) => {
      calls.push([input, init])
      return {
        ok: true,
        status: 200,
        json: async () => ({ payload: 'ok' }),
      } as any
    }) as typeof fetch

    const result = await jsonFetch<{ payload: string }>('/api/test?foo=bar', {
      bustCache: false,
      noStore: false,
      cache: 'force-cache',
      headers: {
        Authorization: 'Bearer token',
      },
    })

    assert.deepEqual(result, { payload: 'ok' })
    assert.ok(calls.length === 1)

    const [url, options] = calls[0]
    assert.equal(url, '/api/test?foo=bar')
    assert.equal(options?.cache, 'force-cache')
    const headers = options?.headers as any
    const acceptHeader = headers?.['Accept'] ?? headers?.get?.('Accept')
    const authHeader = headers?.['Authorization'] ?? headers?.get?.('Authorization')
    assert.equal(acceptHeader, 'application/json')
    assert.equal(authHeader, 'Bearer token')
  })

  it('surfaces API error messages', async () => {
    global.fetch = (async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Boom' }),
    })) as unknown as typeof fetch

    await assert.rejects(() => jsonFetch('/api/error'), /Boom/)
  })
})
