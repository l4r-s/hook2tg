import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { redactionMiddleware } from '../src/middleware/redaction'

describe('Redaction Middleware', () => {
  let app: Hono
  let consoleOutput: string[]
  let originalConsoleLog: typeof console.log

  beforeEach(() => {
    app = new Hono()
    app.use('*', redactionMiddleware())
    
    // Capture console output
    consoleOutput = []
    originalConsoleLog = console.log
    console.log = (...args: any[]) => {
      consoleOutput.push(args.map(a => String(a)).join(' '))
    }
  })

  afterEach(() => {
    console.log = originalConsoleLog
  })

  it('should redact bot tokens from query parameters', async () => {
    app.get('/test', (c) => {
      console.log(`Request URL: ${c.req.url}`)
      return c.text('ok')
    })

    const req = new Request('http://localhost/test?botToken=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ1234567')
    await app.request(req)

    expect(consoleOutput[0]).toContain('botToken=***REDACTED***')
    expect(consoleOutput[0]).not.toContain('123456789:ABC')
  })

  it('should redact Telegram bot token format', async () => {
    app.get('/test', (c) => {
      console.log('Token: 987654321:XYZabcDEFghiJKLmnoPQRstuVWXyz12345')
      return c.text('ok')
    })

    const req = new Request('http://localhost/test')
    await app.request(req)

    expect(consoleOutput[0]).toContain('***REDACTED_BOT_TOKEN***')
    expect(consoleOutput[0]).not.toContain('987654321:XYZ')
  })

  it('should redact authorization headers', async () => {
    app.get('/test', (c) => {
      console.log('Authorization: Bearer secret-token-here')
      return c.text('ok')
    })

    const req = new Request('http://localhost/test')
    await app.request(req)

    expect(consoleOutput[0]).toContain('***REDACTED***')
    expect(consoleOutput[0]).not.toContain('secret-token-here')
  })

  it('should redact sensitive keys in objects', async () => {
    app.get('/test', (c) => {
      console.log({ token: 'secret123', botToken: 'bot456', data: 'public' })
      return c.text('ok')
    })

    const req = new Request('http://localhost/test')
    await app.request(req)

    const output = consoleOutput[0]
    // Objects are stringified, so check JSON format
    expect(output).toContain('"token":"***REDACTED***"')
    expect(output).toContain('"botToken":"***REDACTED***"')
    expect(output).not.toContain('secret123')
    expect(output).not.toContain('bot456')
    expect(output).toContain('public')
  })

  it('should handle nested objects', async () => {
    app.get('/test', (c) => {
      console.log({
        user: { name: 'John', password: 'secret' },
        config: { apiKey: 'key123', timeout: 5000 }
      })
      return c.text('ok')
    })

    const req = new Request('http://localhost/test')
    await app.request(req)

    const output = consoleOutput[0]
    // Check stringified JSON output
    expect(output).toContain('John')
    expect(output).toContain('5000')
    expect(output).toContain('"password":"***REDACTED***"')
    expect(output).toContain('"apiKey":"***REDACTED***"')
    expect(output).not.toContain('secret')
    expect(output).not.toContain('key123')
  })

  it('should handle arrays', async () => {
    app.get('/test', (c) => {
      console.log(['public', 'botToken=secret', 'more data'])
      return c.text('ok')
    })

    const req = new Request('http://localhost/test')
    await app.request(req)

    const output = consoleOutput[0]
    expect(output).toContain('public')
    expect(output).toContain('more data')
    expect(output).toContain('***REDACTED***')
    expect(output).not.toContain('botToken=secret')
  })

  it('should not affect non-sensitive data', async () => {
    app.get('/test', (c) => {
      console.log('Normal log message with no secrets')
      return c.text('ok')
    })

    const req = new Request('http://localhost/test')
    await app.request(req)

    expect(consoleOutput[0]).toBe('Normal log message with no secrets')
  })

  it('should restore console methods after request', async () => {
    app.get('/test', (c) => c.text('ok'))

    const testFn = console.log
    const req = new Request('http://localhost/test')
    await app.request(req)

    // After the request, console.log should still be our test mock (not changed by middleware)
    expect(console.log).toBe(testFn)
  })

  it('should handle multiple console methods', async () => {
    const outputs: Record<string, string[]> = {
      log: [],
      info: [],
      warn: [],
      error: []
    }

    const originalMethods = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error
    }

    console.log = (...args: any[]) => outputs.log.push(args.join(' '))
    console.info = (...args: any[]) => outputs.info.push(args.join(' '))
    console.warn = (...args: any[]) => outputs.warn.push(args.join(' '))
    console.error = (...args: any[]) => outputs.error.push(args.join(' '))

    app.get('/test', (c) => {
      console.log('Log: botToken=secret1')
      console.info('Info: botToken=secret2')
      console.warn('Warn: botToken=secret3')
      console.error('Error: botToken=secret4')
      return c.text('ok')
    })

    const req = new Request('http://localhost/test')
    await app.request(req)

    expect(outputs.log[0]).toContain('***REDACTED***')
    expect(outputs.info[0]).toContain('***REDACTED***')
    expect(outputs.warn[0]).toContain('***REDACTED***')
    expect(outputs.error[0]).toContain('***REDACTED***')

    // Restore
    console.log = originalMethods.log
    console.info = originalMethods.info
    console.warn = originalMethods.warn
    console.error = originalMethods.error
  })
})

