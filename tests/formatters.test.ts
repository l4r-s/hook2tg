import { describe, it, expect } from 'vitest'
import { formatJsonPayload, formatTextPayload } from '../src/formatters'

describe('formatJsonPayload', () => {
  it('formats objects as JSON in code block', () => {
    const result = formatJsonPayload({ a: 1 })
    expect(result).toContain('```')
    expect(result).toContain(JSON.stringify({ a: 1 }, null, 2))
    expect(result).toMatch(/^```[\s\S]*```$/)
    expect(result.startsWith('```')).toBe(true)
    expect(result.endsWith('```')).toBe(true)
  })

  it('escapes backticks in JSON', () => {
    const result = formatJsonPayload({ message: 'Hello `world`' })
    expect(result).toContain('\\`world\\`')
  })

  it('truncates long JSON', () => {
    const big = { x: 'a'.repeat(10000) }
    const out = formatJsonPayload(big)
    expect(out.length).toBeLessThanOrEqual(4010) // Code block adds some chars
    expect(out).toContain('...')
  })
})

describe('formatTextPayload', () => {
  it('converts JSON to YAML when Content-Type is application/json', () => {
    const payload = { event: 'deploy', status: 'success', url: 'https://example.com' }
    const result = formatTextPayload(payload, 'application/json')
    
    expect(result.parseMode).toBe('MarkdownV2')
    expect(result.text).toContain('event: deploy')
    expect(result.text).toContain('status: success')
    expect(result.text).toContain('url: https://example.com')
    // URLs should not be escaped
    expect(result.text).toContain('https://example.com')
    expect(result.text).not.toContain('\\https')
  })

  it('passes through string payloads', () => {
    const payload = 'Simple text message'
    const result = formatTextPayload(payload, 'text/plain')
    
    // Spaces don't need escaping in MarkdownV2, only special characters
    expect(result.text).toBe('Simple text message')
    expect(result.parseMode).toBe('MarkdownV2')
  })

  it('preserves URLs without wrapping in Markdown', () => {
    const payload = { message: 'Check https://example.com for details' }
    const result = formatTextPayload(payload, 'application/json')
    
    // URL should be present and not escaped
    expect(result.text).toContain('https://example.com')
    expect(result.text).not.toContain('\\https://example.com')
    // But other text should be escaped
    expect(result.text).toContain('Check')
  })

  it('escapes MarkdownV2 special characters', () => {
    const payload = { message: 'Test _italic_ *bold* [link](url)' }
    const result = formatTextPayload(payload, 'application/json')
    
    // Special characters should be escaped
    expect(result.text).toContain('\\_italic\\_')
    expect(result.text).toContain('\\*bold\\*')
    expect(result.text).toContain('\\[link\\]')
    expect(result.text).toContain('\\(')
  })

  it('handles non-JSON objects without Content-Type', () => {
    const payload = { key: 'value' }
    const result = formatTextPayload(payload, null)
    
    // Should convert to string
    expect(result.text).toBeTruthy()
  })

  it('truncates long text', () => {
    const big = { x: 'a'.repeat(10000) }
    const result = formatTextPayload(big, 'application/json')
    
    expect(result.text.length).toBeLessThanOrEqual(3906) // 3900 + '...' (dots may be escaped)
    // Dots in '...' get escaped to '\.\.\.' in MarkdownV2
    expect(result.text).toMatch(/\.\.\.|\\\.\\\.\\\./)
  })

  it('handles nested objects in YAML', () => {
    const payload = {
      event: 'deploy',
      config: {
        env: 'production',
        version: '1.0.0'
      }
    }
    const result = formatTextPayload(payload, 'application/json')
    
    expect(result.text).toContain('event: deploy')
    expect(result.text).toContain('config:')
    expect(result.text).toContain('env: production')
  })
})
