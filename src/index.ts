import { Hono } from 'hono'
import { formatJsonPayload } from './formatters'
import { sendTelegram } from './telegram'
import { checkRateLimit } from './limiter'
import { BotEntry } from './types'
import { redactionMiddleware } from './middleware/redaction'

// Export Durable Object class for Wrangler
export { RateLimiter } from './durable/RateLimiter'

interface Env {
  BOT_KV: KVNamespace
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

  // Check if bot is registered in KV (authentication)
  const botRaw = await c.env.BOT_KV.get(`bot:${botId}`)
  if (!botRaw) {
    return c.json({ error: 'Bot not registered' }, 401)
  }

  // Parse bot entry
  let botEntry: BotEntry | null = null
  try {
    const parsed = JSON.parse(botRaw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.isPremium === 'boolean' &&
      typeof parsed.premiumExpires === 'string'
    ) {
      botEntry = parsed as BotEntry
    }
  } catch {
    // Invalid entry format, treat as non-premium
  }

  // Compute active premium status
  let isPremiumActive = false
  if (botEntry) {
    const now = new Date()
    const expiresDate = new Date(botEntry.premiumExpires)
    isPremiumActive = botEntry.isPremium && expiresDate > now
  }

  // Ask durable object for allowance
  try {
    await checkRateLimit(c.env.RATE_LIMITER, botId, isPremiumActive)
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
