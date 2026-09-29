/**
 * GET /calendar.ics?passphrase=… — a subscribable feed for calendar apps.
 *
 * Unlike the rest of the site, this endpoint has no session/cookie gate: a
 * subscribed calendar is re-fetched unattended, on the calendar provider's own
 * schedule, with no human present to type a passphrase into the unlock screen.
 * So the passphrase has to travel in the URL itself, and that makes this URL a
 * bearer secret — anyone who has it can read the roster's birthdays without
 * ever seeing the app. Treat it exactly like the section passphrase (don't
 * paste it anywhere public), and know that once subscribed, this URL is
 * stored by your calendar provider (Apple/Google/Outlook) and fetched
 * periodically from their servers, not just your own device.
 *
 * Reuses the same decryption (src/lib/crypto.ts) and assembly (src/lib/
 * calendar.ts) code the browser uses, so the feed can never drift from what
 * the site itself shows after unlock.
 */

import { decryptJSON } from '../src/lib/crypto'
import { birthdayEntries, eventEntries, sortEntries, toICS, toISODate } from '../src/lib/calendar'
import { mergeEvents, type EventOverlayEntry } from '../src/lib/events'
import type { Roster, SectionEvent } from '../src/lib/types'
import rawEvents from '../data/events.json'

interface Env {
  ASSETS: Fetcher
  EVENTS_KV: KVNamespace
}

const OVERLAY_KEY = 'events-overlay'
const baseline = rawEvents as SectionEvent[]

/** Birthdays repeat annually, so a subscribed feed needs a window, not a snapshot. */
const YEARS_AHEAD = 3

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const passphrase = url.searchParams.get('passphrase')
  if (!passphrase) {
    return new Response('Missing ?passphrase= — this feed URL is personal, get it from the Jalendar tab.', {
      status: 401,
    })
  }

  const rosterRes = await env.ASSETS.fetch(new URL('/data/roster.enc', url))
  if (!rosterRes.ok) {
    return new Response('Roster data not available.', { status: 500 })
  }
  const rosterBytes = new Uint8Array(await rosterRes.arrayBuffer())

  let roster: Roster
  try {
    roster = await decryptJSON<Roster>(rosterBytes, passphrase)
  } catch {
    return new Response('That passphrase is not right.', { status: 403 })
  }

  const raw = await env.EVENTS_KV.get(OVERLAY_KEY)
  const overlay = raw ? (JSON.parse(raw) as EventOverlayEntry[]) : []
  const events = mergeEvents(baseline, overlay)

  const thisYear = new Date(toISODate(new Date())).getUTCFullYear()
  const birthdays = Array.from({ length: YEARS_AHEAD }, (_, i) => thisYear + i).flatMap((year) =>
    birthdayEntries(roster.people, year),
  )

  const entries = sortEntries([...eventEntries(events), ...birthdays])
  const ics = toICS(entries, roster.section || 'Section J', url.origin)

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Content-Disposition': 'inline; filename="section-j.ics"',
    },
  })
}
