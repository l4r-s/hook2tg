import { MiddlewareHandler } from 'hono'

/**
 * Redaction middleware to sanitize sensitive data from logs
 * 
 * This middleware intercepts console methods and redacts:
 * - Bot tokens in query parameters (botToken=...)
 * - Bot tokens in URLs
 * - Telegram bot tokens (format: 1234567890:ABC...)
 * - Authorization headers
 */
export const redactionMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    // Store original console methods
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    }

    // Redaction patterns
    const redactPatterns = [
      // Bot token query parameter
      { pattern: /botToken=[^&\s]+/gi, replacement: 'botToken=***REDACTED***' },
      // Telegram bot token format (digits:alphanumeric) - more flexible length
      { pattern: /\b\d{8,10}:[A-Za-z0-9_-]{30,50}\b/g, replacement: '***REDACTED_BOT_TOKEN***' },
      // Authorization header values
      { pattern: /authorization[:\s]+bearer\s+[^\s]+/gi, replacement: 'Authorization: Bearer ***REDACTED***' },
      // Generic token-like patterns in URLs
      { pattern: /([?&]token=)[^&\s]+/gi, replacement: '$1***REDACTED***' },
    ]

    /**
     * Sanitize a value by applying all redaction patterns
     */
    const sanitize = (value: any): any => {
      if (typeof value === 'string') {
        let sanitized = value
        for (const { pattern, replacement } of redactPatterns) {
          sanitized = sanitized.replace(pattern, replacement)
        }
        return sanitized
      }
      
      if (typeof value === 'object' && value !== null) {
        // Handle objects and arrays recursively
        if (Array.isArray(value)) {
          return value.map(sanitize)
        }
        
        const sanitized: any = {}
        for (const [key, val] of Object.entries(value)) {
          // Redact sensitive keys
          if (/token|authorization|password|secret|key/i.test(key)) {
            sanitized[key] = '***REDACTED***'
          } else {
            sanitized[key] = sanitize(val)
          }
        }
        return sanitized
      }
      
      return value
    }

    /**
     * Create a wrapped console method that sanitizes all arguments
     */
    const createSanitizedMethod = (originalMethod: (...args: any[]) => void) => {
      return (...args: any[]) => {
        const sanitizedArgs = args.map(arg => {
          // Sanitize objects/arrays first, then stringify for logging
          if (typeof arg === 'object' && arg !== null) {
            try {
              const sanitizedObj = sanitize(arg)
              return JSON.stringify(sanitizedObj)
            } catch {
              return sanitize(String(arg))
            }
          }
          return sanitize(arg)
        })
        originalMethod.apply(console, sanitizedArgs)
      }
    }

    // Override console methods with sanitized versions
    console.log = createSanitizedMethod(originalConsole.log)
    console.info = createSanitizedMethod(originalConsole.info)
    console.warn = createSanitizedMethod(originalConsole.warn)
    console.error = createSanitizedMethod(originalConsole.error)
    console.debug = createSanitizedMethod(originalConsole.debug)

    try {
      await next()
    } finally {
      // Restore original console methods
      console.log = originalConsole.log
      console.info = originalConsole.info
      console.warn = originalConsole.warn
      console.error = originalConsole.error
      console.debug = originalConsole.debug
    }
  }
}

