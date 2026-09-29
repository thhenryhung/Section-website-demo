/**
 * GET/POST/DELETE /api/admin/events — authed CRUD on section calendar events.
 *
 * Every request independently re-verifies the signed session cookie (see
 * _shared/session.ts) — this endpoint must never trust a client-side "I'm an
 * admin" flag, which is exactly what made the old in-browser AdminPanel
 * (removed in commit 058a06e) unsafe to reintroduce as-is.
 *
 * The actual write path (KV overlay + GitHub commit + push) lives in
 * _shared/eventWrite.ts, shared with the automated listserve ingestion
 * endpoint (functions/api/ingest/event.ts) so the two can't drift.
 */

import { requireAdminSession } from '../../_shared/session'
import {
  deleteEvent,
  isValidEvent,
  readEvents,
  writeEvent,
  type EventWriteEnv,
} from '../../_shared/eventWrite'

interface Env extends EventWriteEnv {
  ADMIN_SESSION_SECRET: string
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

async function requireAuth(request: Request, env: Env): Promise<Response | null> {
  const ok = await requireAdminSession(request, env.ADMIN_SESSION_SECRET)
  return ok ? null : json({ error: 'Not authorized.' }, 401)
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const unauthorized = await requireAuth(request, env)
  if (unauthorized) return unauthorized
  return json(await readEvents(env.EVENTS_KV))
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const unauthorized = await requireAuth(request, env)
  if (unauthorized) return unauthorized

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }
  if (typeof rawBody !== 'object' || rawBody === null) return json({ error: 'Invalid event.' }, 400)
  // `notify` is the admin's checkbox choice, not part of the event itself —
  // pulled out before validation so it never ends up persisted in events.json.
  const { notify, ...eventCandidate } = rawBody as Record<string, unknown> & { notify?: unknown }
  if (!isValidEvent(eventCandidate)) return json({ error: 'Invalid event.' }, 400)
  const event = eventCandidate
  const shouldNotify = notify !== false

  const { events, commitWarning } = await writeEvent(
    env,
    event,
    shouldNotify,
    waitUntil,
    `Admin: add/update event "${event.title}"`,
  )
  return json({ events, commitWarning })
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const unauthorized = await requireAuth(request, env)
  if (unauthorized) return unauthorized

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }
  const id = (body as { id?: unknown } | null)?.id
  if (typeof id !== 'string' || !id) return json({ error: 'Missing event id.' }, 400)

  const { events, commitWarning } = await deleteEvent(env, id)
  return json({ events, commitWarning })
}
