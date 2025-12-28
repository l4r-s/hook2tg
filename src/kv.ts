import { Context } from "hono"
import { WebhookEntry, OrgEntry } from "./types"

export async function getWebhookEntry(c: Context, webhookId: string): Promise<WebhookEntry | null> {
    const webhookRaw = await c.env.WEBHOOK_KV.get(`webhook:${webhookId}`)
    if (!webhookRaw) {
      return null
    }

    const webhookEntry = JSON.parse(webhookRaw) as WebhookEntry
    if (!webhookEntry || !webhookEntry.orgId) {
      return null
    }

    const orgRaw = await c.env.WEBHOOK_KV.get(`org:${webhookEntry.orgId}`)
    if (!orgRaw) {
      return null
    }

    const orgEntry = JSON.parse(orgRaw) as OrgEntry
    if (!orgEntry) {
      return null
    }

    return {
      ...webhookEntry,
      org: orgEntry
    }
  }