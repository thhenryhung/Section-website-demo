/**
 * Cloudflare Email Worker — the receiving end of the listserve pipeline.
 *
 * Deploy target: Email Routing → Routing rules → a custom address bound to
 * "Send to a Worker" → this Worker (Cloudflare dashboard; see README.md).
 * Not a Pages Function — Pages doesn't support the `email` event, so this is
 * its own, separate Worker deploy from the main Pages project.
 *
 * Job: pull the forwarded message apart, and — only if it carries a real
 * calendar invite (.ics attachment) — POST that .ics text to the main app's
 * ingestion endpoint. Anything else (a reply-all with no attachment, a
 * non-invite forward) is silently dropped. That drop is the entire
 * spam/relevance filter for this pipeline, by design: see
 * functions/api/ingest/event.ts's header comment on the main app's side for
 * why free-text invites are out of scope rather than LLM-guessed at.
 */

import PostalMime from 'postal-mime'

export interface Env {
  INGEST_URL: string
  INGEST_SHARED_SECRET: string
}

function isCalendarAttachment(attachment: { mimeType: string; filename?: string | null }): boolean {
  return attachment.mimeType === 'text/calendar' || (attachment.filename?.toLowerCase().endsWith('.ics') ?? false)
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const raw = await new Response(message.raw).arrayBuffer()
    const parsed = await PostalMime.parse(raw)

    const invite = parsed.attachments.find(isCalendarAttachment)
    if (!invite) return

    const icsText = typeof invite.content === 'string' ? invite.content : new TextDecoder().decode(invite.content)

    const res = await fetch(env.INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/calendar',
        Authorization: `Bearer ${env.INGEST_SHARED_SECRET}`,
      },
      body: icsText,
    })

    if (!res.ok) {
      // Nobody watches this Worker's logs day-to-day — `wrangler tail` is how
      // a rejected message gets noticed, so at least put it there.
      console.error(`Ingestion rejected message from ${message.from}: ${res.status} ${await res.text()}`)
    }
  },
} satisfies ExportedHandler<Env>
