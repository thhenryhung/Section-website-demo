/**
 * POST /api/ingest/event — automated intake for calendar invites forwarded
 * from the section listserve.
 *
 * Authenticated by a bearer-token shared secret, not the admin passphrase
 * session: nothing human is logging in here. The caller is the Email Worker
 * in email-worker/ reacting to a listserve message that carried a .ics
 * calendar attachment — see that directory's README for the mail side of
 * this pipeline (Outlook forwarding rule → Cloudflare Email Routing →
 * Worker → here). Deliberately a separate, narrower credential than
 * ADMIN_SESSION_SECRET: this token can only ever create/update calendar
 * events, nothing else.
 *
 * The body is the raw .ics text, not a pre-parsed JSON event — parsing stays
 * server-side (src/lib/ics.ts) so the Email Worker can stay a dumb MIME
 * extractor and this is the one place "what counts as a valid event" lives,
 * shared with the admin panel via _shared/eventWrite.ts.
 *
 * There is deliberately no human review step before this publishes and
 * pushes — by design, so a garbled parse of a real invite still goes out
 * live. The .ics-only requirement (see parseICS) is the filter: a listserve
 * message with no calendar attachment is silently ignored rather than
 * guessed at from free text.
 */

import { idFromUid, parseICS } from '../../../src/lib/ics'
import { isValidEvent, writeEvent, type EventWriteEnv } from '../../_shared/eventWrite'
import type { SectionEvent } from '../../../src/lib/types'

interface Env extends EventWriteEnv {
  INGEST_SHARED_SECRET: string
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Listserve-sourced events default to "social" — student-posted, not official
 *  section programming. An admin can still recategorize afterward in the
 *  panel like any other event. */
const CATEGORY = 'social' as const

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const expected = `Bearer ${env.INGEST_SHARED_SECRET}`
  const authHeader = request.headers.get('Authorization')
  if (!env.INGEST_SHARED_SECRET || authHeader !== expected) {
    return json({ error: 'Not authorized.' }, 401)
  }

  const icsText = await request.text()
  if (!icsText.trim()) return json({ error: 'Empty body.' }, 400)

  const parsed = parseICS(icsText)
  if (parsed.length === 0) return json({ error: 'No VEVENT found in the calendar invite.' }, 400)

  const created: SectionEvent[] = []
  const skipped: string[] = []

  for (const item of parsed) {
    const event: SectionEvent = {
      id: await idFromUid(item.uid),
      title: item.summary,
      category: CATEGORY,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      location: item.location,
      description: item.description,
    }
    if (!isValidEvent(event)) {
      skipped.push(item.uid)
      continue
    }
    await writeEvent(env, event, true, waitUntil, `Listserve: add event "${event.title}"`)
    created.push(event)
  }

  if (created.length === 0) return json({ error: 'Calendar invite did not produce a valid event.', skipped }, 400)
  return json({ created, skipped })
}
