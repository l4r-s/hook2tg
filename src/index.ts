import { Hono } from 'hono'
import { formatJsonPayload } from './formatters'
import { sendTelegram } from './telegram'
import { checkRateLimit } from './limiter'
import { PremiumEntry } from './types'
import { redactionMiddleware } from './middleware/redaction'

// Export Durable Object class for Wrangler
export { RateLimiter } from './durable/RateLimiter'

interface Env {
  PREMIUM_KV: KVNamespace
  RATE_LIMITER: DurableObjectNamespace
}

const app = new Hono<{ Bindings: Env }>()

// Apply redaction middleware globally to sanitize logs
app.use('*', redactionMiddleware())

app.get('/', (c) => c.redirect('https://hook2tg.com'))

app.post('/:chatId/:format', async (c) => {
  const chatId = c.req.param('chatId')
  const format = c.req.param('format')
  const token = c.req.query('botToken')

  if (!token) return c.json({ error: 'Missing botToken' }, 401)

  const [botId] = token.split(':')
  if (!botId) return c.json({ error: 'Invalid token' }, 401)

  // Read premium status from KV
  const premiumRaw = await c.env.PREMIUM_KV.get(`premium:${botId}`)
  let premium: PremiumEntry | null = null
  if (premiumRaw) {
    try {
      const parsed = JSON.parse(premiumRaw)
      premium = (typeof parsed === 'object' && parsed !== null && typeof (parsed as any).expires === 'string')
        ? (parsed as PremiumEntry)
        : null
    } catch {
      premium = null
    }
  }

  // Ask durable object for allowance
  try {
    await checkRateLimit(c.env.RATE_LIMITER, botId, !!premium)
  } catch (err: any) {
    // If limiter rejects, forward appropriate status
    return c.json({ error: 'Rate limited', details: err.message }, 429)
  }

  // Only JSON format supported in this iteration
  if (format !== 'json') return c.json({ error: 'Unsupported format' }, 400)

  const payload = await c.req.json().catch(() => null)
  const text = formatJsonPayload(payload)

  try {
    await sendTelegram(token, chatId, text)
  } catch (err: any) {
    return c.json({ error: 'Telegram send failed', details: err.message }, 502)
  }

  return c.json({ ok: true })
})

export default app
