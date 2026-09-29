/**
 * POST /subscribe — save a browser's push subscription.
 * DELETE /subscribe — remove one, by endpoint (called from src/lib/push.ts's
 * unsubscribeFromPush()).
 *
 * No auth: subscribing to push doesn't grant access to anything — it's the
 * same trust level as the existing GET /api/events endpoint. What matters is
 * kept out of this store entirely (no names, no passphrase, just an opaque
 * push endpoint + its encryption keys).
 *
 * Keyed by a hash of the endpoint (not a random id) so subscribing twice from
 * the same device overwrites in place instead of piling up duplicates, and a
 * DELETE can find the right entry without the client needing to remember an id.
 */
interface Env {
  PUSH_SUBSCRIPTIONS_KV: KVNamespace
}

async function keyFor(endpoint: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  const hex = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `sub:${hex}`
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON body.', { status: 400 })
  }
  const endpoint = (body as { endpoint?: unknown } | null)?.endpoint
  if (typeof endpoint !== 'string' || !endpoint) {
    return new Response('Missing endpoint.', { status: 400 })
  }

  await env.PUSH_SUBSCRIPTIONS_KV.put(await keyFor(endpoint), JSON.stringify(body))
  return new Response(null, { status: 204 })
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON body.', { status: 400 })
  }
  const endpoint = (body as { endpoint?: unknown } | null)?.endpoint
  if (typeof endpoint !== 'string' || !endpoint) {
    return new Response('Missing endpoint.', { status: 400 })
  }

  await env.PUSH_SUBSCRIPTIONS_KV.delete(await keyFor(endpoint))
  return new Response(null, { status: 204 })
}
