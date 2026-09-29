/**
 * Shared write path for a calendar event: KV overlay + best-effort GitHub
 * commit + push-on-genuinely-new-event. Used by both the interactive admin
 * panel (functions/api/admin/events.ts) and the automated listserve
 * ingestion endpoint (functions/api/ingest/event.ts) — one write path, so the
 * two can never drift on what counts as "new" or how a push gets formatted.
 */

import { siteConfig } from '../../src/lib/siteConfig'
import { formatShortDate } from '../../src/lib/calendar'
import { mergeEvents, type EventOverlayEntry } from '../../src/lib/events'
import type { SectionEvent } from '../../src/lib/types'
import { GitHubConflictError, getJSONFile, putJSONFile } from './github'
import { sendToAll, type PushEnv } from './push'
import rawEvents from '../../data/events.json'

export interface EventWriteEnv extends PushEnv {
  EVENTS_KV: KVNamespace
  GITHUB_ADMIN_TOKEN: string
}

const OVERLAY_KEY = 'events-overlay'
const EVENTS_PATH = 'data/events.json'
export const CATEGORIES = new Set(['section', 'social', 'deadline'])
const baseline = rawEvents as SectionEvent[]

export function isValidEvent(body: unknown): body is SectionEvent {
  if (typeof body !== 'object' || body === null) return false
  const e = body as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.title === 'string' &&
    e.title.length > 0 &&
    typeof e.category === 'string' &&
    CATEGORIES.has(e.category) &&
    typeof e.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
    (e.startTime === undefined || typeof e.startTime === 'string') &&
    (e.endTime === undefined || typeof e.endTime === 'string') &&
    (e.location === undefined || typeof e.location === 'string') &&
    (e.description === undefined || typeof e.description === 'string') &&
    (e.url === undefined || typeof e.url === 'string')
  )
}

/** Leads with the event's own name — the part most likely to survive a phone's
 *  notification-shade truncation — rather than a generic "New Event:" prefix.
 *  The body carries the "new event" flag plus date/time/location using the
 *  same short-date format the calendar itself renders. `tag` lets the service
 *  worker collapse a re-sent notification for the same event instead of
 *  stacking a duplicate. */
export function formatEventPush(event: SectionEvent): { title: string; body: string; url: string; tag: string } {
  const timePart = event.startTime
    ? event.endTime
      ? `${event.startTime}-${event.endTime}`
      : event.startTime
    : ''
  const details = [formatShortDate(event.date), timePart, event.location].filter(Boolean).join(' · ')

  return {
    title: event.title,
    body: `New event · ${details}`,
    url: `/calendar?event=${encodeURIComponent(event.id)}`,
    tag: `event-${event.id}`,
  }
}

export async function getOverlay(kv: KVNamespace): Promise<EventOverlayEntry[]> {
  const raw = await kv.get(OVERLAY_KEY)
  return raw ? (JSON.parse(raw) as EventOverlayEntry[]) : []
}

/**
 * Writes `event` into the KV overlay, pushes iff it's genuinely new and the
 * caller asked for it, and best-effort commits the merged baseline to GitHub.
 * A commit failure doesn't undo the instant KV write — the caller sees a
 * warning but the change is still live.
 */
export async function writeEvent(
  env: EventWriteEnv,
  event: SectionEvent,
  notify: boolean,
  waitUntil: (promise: Promise<unknown>) => void,
  commitMessage: string,
): Promise<{ events: SectionEvent[]; commitWarning?: string }> {
  const overlay = await getOverlay(env.EVENTS_KV)
  const isNewEvent = !mergeEvents(baseline, overlay).some((e) => e.id === event.id)
  const nextOverlay = [...overlay.filter((e) => e.id !== event.id), event]
  await env.EVENTS_KV.put(OVERLAY_KEY, JSON.stringify(nextOverlay))

  // Push only on a genuinely new event (not every edit to an existing one),
  // and only if the caller left it on. waitUntil, not a bare call — the
  // Function's invocation can be torn down the instant the response is
  // returned, which would silently kill an un-awaited fetch mid-flight.
  if (isNewEvent && notify) {
    waitUntil(sendToAll(env, formatEventPush(event)))
  }

  let commitWarning: string | undefined
  try {
    const { owner, repo } = siteConfig.github
    const { data: current, sha } = await getJSONFile<SectionEvent[]>(owner, repo, EVENTS_PATH, env.GITHUB_ADMIN_TOKEN)
    const merged = mergeEvents(current, [event])
    await putJSONFile(owner, repo, EVENTS_PATH, merged, sha, env.GITHUB_ADMIN_TOKEN, commitMessage)
  } catch (caught) {
    commitWarning =
      caught instanceof GitHubConflictError
        ? caught.message
        : 'Change is live, but committing it to GitHub failed — it may be lost on the next rebuild.'
  }

  return { events: mergeEvents(baseline, nextOverlay), commitWarning }
}

export async function deleteEvent(
  env: EventWriteEnv,
  id: string,
): Promise<{ events: SectionEvent[]; commitWarning?: string }> {
  const overlay = await getOverlay(env.EVENTS_KV)
  const nextOverlay: EventOverlayEntry[] = [...overlay.filter((e) => e.id !== id), { id, deleted: true }]
  await env.EVENTS_KV.put(OVERLAY_KEY, JSON.stringify(nextOverlay))

  let commitWarning: string | undefined
  try {
    const { owner, repo } = siteConfig.github
    const { data: current, sha } = await getJSONFile<SectionEvent[]>(owner, repo, EVENTS_PATH, env.GITHUB_ADMIN_TOKEN)
    const merged = current.filter((e) => e.id !== id)
    await putJSONFile(owner, repo, EVENTS_PATH, merged, sha, env.GITHUB_ADMIN_TOKEN, `Admin: remove event ${id}`)
  } catch (caught) {
    commitWarning =
      caught instanceof GitHubConflictError
        ? caught.message
        : 'Change is live, but committing it to GitHub failed — it may be lost on the next rebuild.'
  }

  return { events: mergeEvents(baseline, nextOverlay), commitWarning }
}

export async function readEvents(kv: KVNamespace): Promise<SectionEvent[]> {
  return mergeEvents(baseline, await getOverlay(kv))
}
