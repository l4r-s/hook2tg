export async function checkRateLimit(namespace: DurableObjectNamespace, botId: string, premium: boolean) {
  const id = namespace.idFromName(botId)
  const stub = namespace.get(id)

  const resp = await stub.fetch('http://do/allow', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ botId, premium })
  })

  if (!resp.ok) {
    if (resp.status === 429) {
      const data = await resp.json().catch(() => ({})) as { retryAfter?: number }
      const retryAfter = data.retryAfter || 1
      const e: any = new Error('Rate limit exceeded')
      e.retryAfter = retryAfter
      throw e
    }
    throw new Error(`Limiter error: ${resp.status}`)
  }

  const data = await resp.json() as { allow?: boolean; retryAfter?: number }
  if (!data.allow) {
    const e: any = new Error('Rate limit denied')
    e.retryAfter = data.retryAfter || 1
    throw e
  }
}
