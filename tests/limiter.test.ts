import { describe, it, expect, beforeEach } from 'vitest'
import { RateLimiter } from '../src/durable/RateLimiter'

// Minimal mock for DurableObjectState.storage
class MockStorage {
  private map = new Map<string, any>()
  async get<T>(key: string) { return this.map.get(key) as T }
  async put(key: string, value: any) { this.map.set(key, value) }
}

class MockState {
  storage = new MockStorage()
}

describe('RateLimiter durable object', () => {
  it('allows requests under limit', async () => {
    const state = new MockState() as any
    const ro = new RateLimiter(state, null)
    const req = new Request('https://example.com/allow', { method: 'POST', body: JSON.stringify({ orgId: 'org1', rateLimit: { per15Min: 5, monthly: 30 } }) })
    const res1 = await ro.fetch(req)
    expect(res1.status).toBe(200)
    const json1 = await res1.json()
    expect(json1.allow).toBe(true)
  })

  it('enforces per-15-minute limit for free plan (5 requests)', async () => {
    const state = new MockState() as any
    const ro = new RateLimiter(state, null)

    // First 5 requests should succeed
    for (let i = 0; i < 5; i++) {
      const req = new Request('https://example.com/allow', { method: 'POST', body: JSON.stringify({ orgId: 'org1', rateLimit: { per15Min: 5, monthly: 30 } }) })
      const res = await ro.fetch(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.allow).toBe(true)
    }

    // 6th request should be rejected
    const req6 = new Request('https://example.com/allow', { method: 'POST', body: JSON.stringify({ orgId: 'org1', rateLimit: { per15Min: 5, monthly: 30 } }) })
    const res6 = await ro.fetch(req6)
    expect(res6.status).toBe(429)
    const json6 = await res6.json()
    expect(json6.allow).toBe(false)
    expect(json6.retryAfter).toBeGreaterThan(0)

    // 1st request for org1 should succeed
    const reqOrgAllow = new Request('https://example.com/allow', { method: 'POST', body: JSON.stringify({ orgId: 'orgAllow', rateLimit: { per15Min: 5, monthly: 30 } }) })
    const resOrgAllow = await ro.fetch(reqOrgAllow)
    expect(resOrgAllow.status).toBe(200)
    const jsonOrgAllow = await resOrgAllow.json()
    expect(jsonOrgAllow.allow).toBe(true)
  })

  it('enforces per-15-minute limit for premium plan (900 requests)', async () => {
    const state = new MockState() as any
    const ro = new RateLimiter(state, null)

    // First 900 requests should succeed
    for (let i = 0; i < 900; i++) {
      const req = new Request('https://example.com/allow', { method: 'POST', body: JSON.stringify({ orgId: 'org2', rateLimit: { per15Min: 900, monthly: 100000 } }) })
      const res = await ro.fetch(req)
      if (res.status !== 200) {
        const json = await res.json()
        throw new Error(`Request ${i + 1} failed with status ${res.status}: ${JSON.stringify(json)}`)
      }
      const json = await res.json()
      expect(json.allow).toBe(true)
    }

    // 901st request should be rejected
    const req901 = new Request('https://example.com/allow', { method: 'POST', body: JSON.stringify({ orgId: 'org2', rateLimit: { per15Min: 900, monthly: 100000 } }) })
    const res901 = await ro.fetch(req901)
    expect(res901.status).toBe(429)
    const json901 = await res901.json()
    expect(json901.allow).toBe(false)
    expect(json901.retryAfter).toBeGreaterThan(0)

    // 1st request for org1 should succeed
    const reqOrgAllow = new Request('https://example.com/allow', { method: 'POST', body: JSON.stringify({ orgId: 'orgAllow', rateLimit: { per15Min: 5, monthly: 30 } }) })
    const resOrgAllow = await ro.fetch(reqOrgAllow)
    expect(resOrgAllow.status).toBe(200)
    const jsonOrgAllow = await resOrgAllow.json()
    expect(jsonOrgAllow.allow).toBe(true)
  })
})
