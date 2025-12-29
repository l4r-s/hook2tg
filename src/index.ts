import { Hono } from 'hono'
import { formatJsonPayload, formatTextPayload } from './formatters'
import { sendTelegram } from './telegram'
import { checkRateLimit } from './limiter'
import { redactionMiddleware } from './middleware/redaction'
import { getWebhookEntry } from './kv'

// Export Durable Object class for Wrangler
export { RateLimiter } from './durable/RateLimiter'

interface Env {
  WEBHOOK_KV: KVNamespace
  RATE_LIMITER: DurableObjectNamespace
  ENCRYPTION_KEY?: string
}

const app = new Hono<{ Bindings: Env }>()

// Apply redaction middleware globally to sanitize logs
app.use('*', redactionMiddleware())

app.get('/', (c) => c.redirect('https://hook2tg.com'))

app.post('/:webhookId', async (c) => {
  const webhookId = c.req.param('webhookId')

  if (!webhookId) return c.json({ error: 'Missing webhookId' }, 401)

  // Get webhook entry from KV (includes org data)
  const webhookEntry = await getWebhookEntry(c, webhookId)
  if (!webhookEntry) {
    return c.json({ error: 'Webhook not registered' }, 401)
  }

  // Org data is required for rate limiting
  if (!webhookEntry.org) {
    return c.json({ error: 'Organization data not found' }, 500)
  }

  // Ask durable object for allowance
  try {
    await checkRateLimit(c.env.RATE_LIMITER, webhookEntry.orgId, webhookEntry.org.rateLimit)
  } catch (err: any) {
    // If limiter rejects, forward appropriate status
    return c.json({ error: 'Rate limited', details: err.message }, 429)
  }

  // Get Content-Type header for format detection
  const contentType = c.req.header('content-type')

  // Get payload (try JSON first, fallback to text)
  let payload: unknown
  try {
    payload = await c.req.json()
  } catch {
    // If JSON parsing fails, try as text
    payload = await c.req.text().catch(() => null)
  }

  let text: string
  let parseMode: 'MarkdownV2' | null | undefined

  // Route based on format
  if (webhookEntry.format === 'json') {
    text = formatJsonPayload(payload)
    parseMode = 'MarkdownV2'
  } else if (webhookEntry.format === 'text') {
    const result = formatTextPayload(payload, contentType)
    text = result.text
    parseMode = result.parseMode
  } else {
    return c.json({ error: 'Unsupported format' }, 400)
  }

  try {
    await sendTelegram(webhookEntry.botToken, webhookEntry.chatId, text, parseMode)
  } catch (err: any) {
    return c.json({ error: 'Telegram send failed', details: err.message }, 502)
  }

  return c.json({ ok: true })
})

export default app
