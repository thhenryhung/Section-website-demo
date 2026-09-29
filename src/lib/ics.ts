/**
 * Minimal RFC 5545 VEVENT parser — just enough to turn a calendar invite
 * forwarded from the section listserve into a SectionEvent. Not a general
 * ICS library: no recurrence rules, no VALARM/VTIMEZONE, and a DTSTART/DTEND's
 * digits are read as section-local wall-clock time regardless of a TZID
 * parameter or trailing Z. Forwarded Outlook invites are one-off meetings
 * already addressed to this section (America/New_York in practice), so this
 * deliberately skips pulling in a timezone database just to read five fields.
 */

export type ParsedICSEvent = {
  uid: string
  summary: string
  /** ISO date, YYYY-MM-DD. */
  date: string
  /** HH:MM, only present for a timed (non all-day) event. */
  startTime?: string
  endTime?: string
  location?: string
  description?: string
}

type Line = { name: string; value: string }

/** RFC 5545 line folding: a line starting with a space or tab continues the previous one. */
function unfold(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1)
    } else if (line.length > 0) {
      out.push(line)
    }
  }
  return out
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

/** "DTSTART;TZID=America/New_York:20261008T180000" -> { name: 'DTSTART', value: '20261008T180000' } — parameters are dropped, only the property name and value matter here. */
function parseLine(line: string): Line {
  const colonIndex = line.indexOf(':')
  if (colonIndex === -1) return { name: line.toUpperCase(), value: '' }
  const name = line.slice(0, colonIndex).split(';')[0].toUpperCase()
  return { name, value: line.slice(colonIndex + 1) }
}

function toDateAndTime(value: string): { date: string; time?: string } {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})\d{2}Z?)?$/)
  if (!match) return { date: value }
  const [, y, m, d, hh, mm] = match
  return hh ? { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` } : { date: `${y}-${m}-${d}` }
}

/**
 * Parses every VEVENT in a raw .ics file. A forwarded single-meeting invite
 * has exactly one; this still returns an array so a multi-event invite (rare,
 * but real — e.g. a recurring series expanded into instances) doesn't
 * silently drop all but the first.
 */
export function parseICS(raw: string): ParsedICSEvent[] {
  const lines = unfold(raw).map(parseLine)
  const events: ParsedICSEvent[] = []
  let current: Record<string, string> | null = null

  for (const line of lines) {
    if (line.name === 'BEGIN' && line.value === 'VEVENT') {
      current = {}
    } else if (line.name === 'END' && line.value === 'VEVENT') {
      if (current?.SUMMARY && current?.DTSTART && current?.UID) {
        const start = toDateAndTime(current.DTSTART)
        const end = current.DTEND ? toDateAndTime(current.DTEND) : undefined
        events.push({
          uid: current.UID,
          summary: unescapeText(current.SUMMARY),
          date: start.date,
          startTime: start.time,
          endTime: end?.time,
          location: current.LOCATION ? unescapeText(current.LOCATION) : undefined,
          description: current.DESCRIPTION ? unescapeText(current.DESCRIPTION) : undefined,
        })
      }
      current = null
    } else if (current && !(line.name in current)) {
      // First occurrence wins — nothing this parser reads is a property VEVENT repeats.
      current[line.name] = line.value
    }
  }

  return events
}

/**
 * A short, deterministic, filesystem/URL-safe id derived from an ICS UID —
 * so re-forwarding the same invite (a resend, a delivery retry) produces the
 * same SectionEvent id instead of a duplicate, and isNewEvent-gated behavior
 * (see functions/_shared/eventWrite.ts) works exactly as it does for a
 * manually-entered event.
 */
export async function idFromUid(uid: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uid))
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `listserve-${hex.slice(0, 12)}`
}
