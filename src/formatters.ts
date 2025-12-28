export function formatJsonPayload(payload: unknown): string {
  try {
    const text = JSON.stringify(payload === undefined ? null : payload, null, 2)
    const max = 4000 // Telegram limit ~4096, keep margin for safety
    if (text.length > max) return text.slice(0, max - 3) + '...'
    return text
  } catch (e) {
    // Fallback to string
    const str = String(payload)
    return str.length > 4000 ? str.slice(0, 3997) + '...' : str
  }
}
