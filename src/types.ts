export type OrgEntry = {
  id: string
  rateLimit: {
    per15Min: number
    monthly: number
  }
}

export type WebhookEntry = {
  botToken: string
  orgId: string
  chatId: string
  format: 'json' | 'text'
  org: OrgEntry | null
}
