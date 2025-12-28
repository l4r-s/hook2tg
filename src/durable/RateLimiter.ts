export class RateLimiter {
  state: DurableObjectState

  constructor(state: DurableObjectState, env: any) {
    this.state = state
  }

  // Simple per-15-minute limiter + monthly counter (durable but minimal)
  async fetch(req: Request) {
    const url = new URL(req.url)
    if (url.pathname !== '/allow' || req.method !== 'POST') {
      return new Response('Not found', { status: 404 })
    }

    const body = await req.json().catch(() => ({})) as { botId: string; premium: boolean }
    const { botId, premium } = body

    const now = Date.now()
    const fifteenMinInterval = Math.floor(now / (15 * 60 * 1000))
    const fifteenMinKey = `15m:${fifteenMinInterval}`
    const monthKey = `m:${new Date(now).toISOString().slice(0, 7)}` // YYYY-MM

    const per15MinLimit = premium ? 900 : 5
    const monthlyLimit = premium ? 100000 : 30

    // Read counters
    const [fifteenMinCount = 0, monthCount = 0] = await Promise.all([
      this.state.storage.get<number>(fifteenMinKey),
      this.state.storage.get<number>(monthKey)
    ])

    if ((fifteenMinCount || 0) >= per15MinLimit) {
      // Calculate seconds remaining until next 15-minute window
      const nextInterval = (fifteenMinInterval + 1) * 15 * 60 * 1000
      const retryAfter = Math.ceil((nextInterval - now) / 1000)
      return new Response(JSON.stringify({ allow: false, retryAfter }), { status: 429 })
    }

    if ((monthCount || 0) >= monthlyLimit) {
      return new Response(JSON.stringify({ allow: false, retryAfter: 60 }), { status: 429 })
    }

    // Increment counters
    await Promise.all([
      this.state.storage.put(fifteenMinKey, (fifteenMinCount || 0) + 1),
      this.state.storage.put(monthKey, (monthCount || 0) + 1)
    ])

    // Set a short-lived alarm/expiration by using a separate TTL key is more complex — keep minimal

    return new Response(JSON.stringify({ allow: true }))
  }
}
