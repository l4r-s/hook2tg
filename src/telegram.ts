export async function sendTelegram(
  token: string,
  chatId: string,
  text: string,
  parseMode?: 'MarkdownV2' | null
) {
  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`

  // Build request body
  const body: { chat_id: string; text: string; parse_mode?: string } = {
    chat_id: chatId,
    text
  }

  if (parseMode === 'MarkdownV2') {
    body.parse_mode = 'MarkdownV2'
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '<no body>')
    
    // If MarkdownV2 failed, retry as plain text
    if (parseMode === 'MarkdownV2' && res.status === 400) {
      const fallbackText = text + '\n\n⚠️ Formatting disabled due to invalid Markdown'
      const fallbackBody = {
        chat_id: chatId,
        text: fallbackText
      }

      const fallbackRes = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(fallbackBody)
      })

      if (!fallbackRes.ok) {
        const fallbackBodyText = await fallbackRes.text().catch(() => '<no body>')
        throw new Error(`Telegram API error ${fallbackRes.status}: ${fallbackBodyText}`)
      }

      return fallbackRes.json()
    }

    throw new Error(`Telegram API error ${res.status}: ${body}`)
  }

  return res.json()
}
