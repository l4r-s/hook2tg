export class RateLimiter {
  state: DurableObjectState

  constructor(state: DurableObjectState, env: any) {
    this.state = state
  }

  // Simple per-second limiter + monthly counter (durable but minimal)
  async fetch(req: Request) {
    const url = new URL(req.url)
    if (url.pathname !== '/allow' || req.method !== 'POST') {
      return new Response('Not found', { status: 404 })
    }

    const body = await req.json().catch(() => ({})) as { botId: string; premium: boolean }
    const { botId, premium } = body

    const now = Date.now()
    const secondKey = `s:${Math.floor(now / 1000)}`
    const monthKey = `m:${new Date(now).toISOString().slice(0, 7)}` // YYYY-MM

    const perSecondLimit = premium ? 10 : 1
    const monthlyLimit = premium ? 100000 : 30

    // Read counters
    const [secCount = 0, monthCount = 0] = await Promise.all([
      this.state.storage.get<number>(secondKey),
      this.state.storage.get<number>(monthKey)
    ])

    if ((secCount || 0) >= perSecondLimit) {
      return new Response(JSON.stringify({ allow: false, retryAfter: 1 }), { status: 429 })
    }

    if ((monthCount || 0) >= monthlyLimit) {
      return new Response(JSON.stringify({ allow: false, retryAfter: 60 }), { status: 429 })
    }

    // Increment counters
    await Promise.all([
      this.state.storage.put(secondKey, (secCount || 0) + 1),
      this.state.storage.put(monthKey, (monthCount || 0) + 1)
    ])

    // Set a short-lived alarm/expiration by using a separate TTL key is more complex — keep minimal

    return new Response(JSON.stringify({ allow: true }))
  }
}
