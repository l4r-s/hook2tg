export async function sendTelegram(token: string, chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '<no body>')
    throw new Error(`Telegram API error ${res.status}: ${body}`)
  }

  return res.json()
}
