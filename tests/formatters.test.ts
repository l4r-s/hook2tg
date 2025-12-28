import { describe, it, expect } from 'vitest'
import { formatJsonPayload } from '../src/formatters'

describe('formatJsonPayload', () => {
  it('formats objects as JSON', () => {
    expect(formatJsonPayload({ a: 1 })).toBe(JSON.stringify({ a: 1 }, null, 2))
  })

  it('truncates long JSON', () => {
    const big = { x: 'a'.repeat(10000) }
    const out = formatJsonPayload(big)
    expect(out.length).toBeLessThanOrEqual(4000)
    expect(out.endsWith('...')).toBeTruthy()
  })
})
