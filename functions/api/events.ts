/**
 * GET /api/events — public, no auth. This is what makes a plain visitor's
 * calendar update live: events are already public/non-sensitive (git-tracked
 * in data/events.json today), so this endpoint sits outside the
 * SECTION_PASSPHRASE gate entirely, same trust level as the existing static
 * import it's replacing.
 */

import { readEvents } from '../_shared/eventWrite'

interface Env {
  EVENTS_KV: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const merged = await readEvents(env.EVENTS_KV)

  return new Response(JSON.stringify(merged), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  })
}
