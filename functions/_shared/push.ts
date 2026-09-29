/**
 * Sends a Web Push notification to every subscribed browser.
 *
 * Uses Web Crypto (not Node's `crypto`), so it runs natively on Cloudflare's
 * Workers runtime — no polyfills, same pattern as src/lib/crypto.ts.
 */
import { buildPushPayload, type PushSubscription, type VapidKeys } from '@block65/webcrypto-web-push'

export interface PushEnv {
  PUSH_SUBSCRIPTIONS_KV: KVNamespace
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
}

export type PushMessage = {
  title: string
  body: string
  /** In-app path to open when the notification is tapped. Defaults to /calendar in sw.js. */
  url?: string
  /** Collapses a re-sent notification for the same thing instead of stacking a duplicate. */
  tag?: string
}

/**
 * Apple's push service (web.push.apple.com) validates the VAPID JWT `sub`
 * claim strictly and returns 403 BadJwtToken for anything but a real
 * mailto: or https: URI — confirmed the hard way against the push-poc
 * prototype, where the RFC 2606 ".invalid" fake-email convention used
 * elsewhere in this codebase does NOT work here. Firefox/Chrome's push
 * services are lenient and don't care, so this only bites on iPhones.
 */
const VAPID_SUBJECT = 'https://section-website-demo.pages.dev'

/** A subscription whose push service rejects it as gone (404/410) is stale — prune it. */
function isGone(status: number): boolean {
  return status === 404 || status === 410
}

export async function sendToAll(
  env: PushEnv,
  message: PushMessage,
): Promise<{ sent: number; pruned: number; failed: number }> {
  const vapid: VapidKeys = {
    subject: VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  }

  const list = await env.PUSH_SUBSCRIPTIONS_KV.list({ prefix: 'sub:' })
  let sent = 0
  let pruned = 0
  let failed = 0

  await Promise.all(
    list.keys.map(async (key) => {
      const raw = await env.PUSH_SUBSCRIPTIONS_KV.get(key.name)
      if (!raw) return
      const subscription = JSON.parse(raw) as PushSubscription
      try {
        const payload = await buildPushPayload({ data: JSON.stringify(message) }, subscription, vapid)
        const res = await fetch(subscription.endpoint, payload)
        if (res.ok) {
          sent++
        } else if (isGone(res.status)) {
          await env.PUSH_SUBSCRIPTIONS_KV.delete(key.name)
          pruned++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }),
  )

  return { sent, pruned, failed }
}
