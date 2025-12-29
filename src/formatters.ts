import { stringify } from 'yaml'

/**
 * Escape backticks for MarkdownV2 code blocks
 */
function escapeBackticks(text: string): string {
  return text.replace(/`/g, '\\`')
}

/**
 * Format JSON payload as code block with MarkdownV2
 */
export function formatJsonPayload(payload: unknown): string {
  try {
    const text = JSON.stringify(payload === undefined ? null : payload, null, 2)
    const max = 4000 // Telegram limit ~4096, keep margin for safety
    const truncated = text.length > max ? text.slice(0, max - 3) + '...' : text
    // Escape backticks inside JSON for MarkdownV2
    const escaped = escapeBackticks(truncated)
    // Wrap in code block
    return '```\n' + escaped + '\n```'
  } catch (e) {
    // Fallback to string
    const str = String(payload)
    const truncated = str.length > 4000 ? str.slice(0, 3997) + '...' : str
    const escaped = escapeBackticks(truncated)
    return '```\n' + escaped + '\n```'
  }
}

/**
 * Escape MarkdownV2 special characters
 * Characters to escape: _ * [ ] ( ) ~ ` > # + - = | { } . !
 */
function escapeMarkdownV2(text: string): string {
  // Escape all MarkdownV2 special characters
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1')
}

/**
 * Detect URLs in text (but don't wrap them)
 * Returns array of { url: string, index: number, length: number }
 */
function findUrls(text: string): Array<{ url: string; start: number; end: number }> {
  const urlRegex = /https?:\/\/[^\s]+/g
  const urls: Array<{ url: string; start: number; end: number }> = []
  let match

  while ((match = urlRegex.exec(text)) !== null) {
    urls.push({
      url: match[0],
      start: match.index,
      end: match.index + match[0].length
    })
  }

  return urls
}

/**
 * Apply MarkdownV2 escaping while preserving URLs
 */
function escapeMarkdownV2PreservingUrls(text: string): string {
  const urls = findUrls(text)
  if (urls.length === 0) {
    return escapeMarkdownV2(text)
  }

  // Build escaped string, preserving URLs
  let result = ''
  let lastIndex = 0

  for (const url of urls) {
    // Escape text before URL
    result += escapeMarkdownV2(text.slice(lastIndex, url.start))
    // Add URL as-is (Telegram will auto-link it)
    result += url.url
    lastIndex = url.end
  }

  // Escape remaining text
  result += escapeMarkdownV2(text.slice(lastIndex))

  return result
}

export type FormatTextResult = {
  text: string
  parseMode: 'MarkdownV2' | null
}

/**
 * Format text payload with YAML conversion and MarkdownV2 support
 */
export function formatTextPayload(
  payload: unknown,
  contentType?: string | null
): FormatTextResult {
  let text: string

  // If payload is an object, convert to YAML
  // (Content-Type check is mainly for documentation/clarity, but we convert objects regardless)
  if (typeof payload === 'object' && payload !== null) {
    // Convert JSON to YAML
    try {
      text = stringify(payload, { indent: 2 })
    } catch (e) {
      // Fallback to JSON stringify if YAML conversion fails
      text = JSON.stringify(payload, null, 2)
    }
  } else if (typeof payload === 'string') {
    // Pass through string as-is
    text = payload
  } else {
    // Convert to string
    text = String(payload)
  }

  // Truncate if needed (leave room for potential error message)
  const max = 3900 // Leave room for fallback message
  if (text.length > max) {
    text = text.slice(0, max - 3) + '...'
  }

  // Apply MarkdownV2 escaping while preserving URLs
  try {
    const escaped = escapeMarkdownV2PreservingUrls(text)
    return { text: escaped, parseMode: 'MarkdownV2' }
  } catch (e) {
    // If escaping fails, return as plain text
    return { text, parseMode: null }
  }
}
