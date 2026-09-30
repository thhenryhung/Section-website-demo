import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSectionData } from '../gate/SectionData'
import {
  DAY_NAMES,
  MONTH_NAMES,
  birthdayEntries,
  eventEntries,
  formatLongDate,
  formatShortDate,
  fromISODate,
  groupByDate,
  monthGrid,
  sortEntries,
  toICS,
  toISODate,
} from '../lib/calendar'
import type { CalendarEntry, EventCategory, SectionEvent } from '../lib/types'
import rawEvents from '../../data/events.json'
import rawDemoEvents from '../../data/events.demo.json'

const EVENTS_POLL_MS = 45_000

/**
 * "section" gets the section's own green — deliberately not "emerald", which
 * would sit too close to it and blur two different categories into one color
 * at calendar-dot size. "social" moved to rose to keep categories unambiguous
 * at a glance. "course" and "deadline" stay in the type (a stray event with
 * either category would still render, just with no toggle chip) but are
 * dropped from the section's actual calendar — see ALL_CATEGORIES below.
 */
const CATEGORY_STYLE: Record<EventCategory, string> = {
  section: 'bg-green-600 text-white',
  social: 'bg-rose-500 text-white',
  course: 'bg-sky-700 text-white',
  deadline: 'bg-amber-600 text-white',
  birthday: 'bg-purple-600 text-white',
}

const CATEGORY_DOT: Record<EventCategory, string> = {
  section: 'bg-green-600',
  social: 'bg-rose-500',
  course: 'bg-sky-700',
  deadline: 'bg-amber-600',
  birthday: 'bg-purple-600',
}

const CATEGORY_BORDER: Record<EventCategory, string> = {
  section: 'border-green-600',
  social: 'border-rose-500',
  course: 'border-sky-700',
  deadline: 'border-amber-600',
  birthday: 'border-purple-600',
}

const ALL_CATEGORIES: EventCategory[] = ['section', 'social', 'birthday']

export function CalendarPage() {
  const { people, passphrase, isSampleBuild } = useSectionData()

  // The public demo is intentionally isolated: it starts from its fabricated
  // event file and never fetches the real site's mutable KV-backed event API.
  // Real builds retain the static source plus live overlay behavior below.
  const [events, setEvents] = useState<SectionEvent[]>([])

  useEffect(() => {
    if (isSampleBuild) {
      setEvents(rawDemoEvents as SectionEvent[])
      return
    }

    // Polling (not just fetch-on-mount) so an admin's edit reaches a tab that's
    // already open on the Calendar, not just a fresh navigation to it.
    setEvents(rawEvents as SectionEvent[])
    let cancelled = false
    const load = () =>
      fetch('/api/events', { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data: SectionEvent[]) => {
          if (!cancelled) setEvents(data)
        })
        .catch(() => {}) // keep whatever we already have — never block the calendar on this
    load()
    const interval = setInterval(load, EVENTS_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isSampleBuild])

  const today = toISODate(new Date())
  const [cursor, setCursor] = useState(() => {
    const now = fromISODate(today)
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
  })
  const [view, setView] = useState<'calendar' | 'timetable'>('timetable')
  const [hidden, setHidden] = useState<Set<EventCategory>>(new Set())
  const [scrollTarget, setScrollTarget] = useState<string | null>(null)
  const [eventScrollTarget, setEventScrollTarget] = useState<string | null>(null)
  const [glanceExpanded, setGlanceExpanded] = useState(false)
  const timetableRefs = useRef(new Map<string, HTMLDivElement>())
  const eventRefs = useRef(new Map<string, HTMLDivElement>())
  const [searchParams, setSearchParams] = useSearchParams()

  /**
   * Birthdays are generated for the year on screen and the next one, so scrolling
   * from December into January does not fall off the end of the data.
   */
  const allEntries = useMemo(
    () =>
      sortEntries([
        ...eventEntries(events),
        ...birthdayEntries(people, cursor.year),
        ...birthdayEntries(people, cursor.year + 1),
      ]),
    [events, people, cursor.year],
  )

  const visible = useMemo(
    () => allEntries.filter((entry) => !hidden.has(entry.category)),
    [allEntries, hidden],
  )

  const byDate = useMemo(() => groupByDate(visible), [visible])
  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])

  const upcoming = useMemo(
    () => visible.filter((entry) => entry.date >= today).slice(0, 60),
    [visible, today],
  )

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const month = prev.month + delta
      if (month < 1) return { year: prev.year - 1, month: 12 }
      if (month > 12) return { year: prev.year + 1, month: 1 }
      return { ...prev, month }
    })
  }

  function toggleCategory(category: EventCategory) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  /** Jump from a day in the month grid to that same day in the timetable. */
  function goToDate(date: string) {
    setView('timetable')
    setScrollTarget(date)
  }

  // Only fires once the timetable's own rows exist to scroll to.
  useEffect(() => {
    if (view !== 'timetable' || !scrollTarget) return
    timetableRefs.current.get(scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setScrollTarget(null)
  }, [view, scrollTarget])

  // Same idea, but keyed by a specific event's id rather than its date — a
  // date can hold more than one entry, so "jump to this exact event" (a push
  // notification tap, or an "At a glance" row) needs finer targeting than
  // goToDate's "jump to this day" (a month-grid cell, which has no single
  // event in mind) does.
  useEffect(() => {
    if (view !== 'timetable' || !eventScrollTarget) return
    eventRefs.current.get(eventScrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setEventScrollTarget(null)
  }, [view, eventScrollTarget])

  // Deep link from a push notification: /calendar?event=<id>. A cold load
  // renders the static events.json seed first, before the live /api/events
  // fetch resolves — so this deliberately keeps re-checking as allEntries
  // updates, rather than consuming the param on the first (possibly stale)
  // render, which could silently drop a link to an event created moments ago.
  useEffect(() => {
    const id = searchParams.get('event')
    if (!id) return
    const entry = allEntries.find((e) => e.id === id)
    if (!entry) return // not loaded yet — try again once events/allEntries update

    setHidden((prev) => {
      if (!prev.has(entry.category)) return prev
      const next = new Set(prev)
      next.delete(entry.category)
      return next
    })
    setView('timetable')
    setEventScrollTarget(id)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('event')
        return next
      },
      { replace: true },
    )
  }, [allEntries, searchParams, setSearchParams])

  /**
   * A subscribed feed (functions/calendar.ics.ts) re-fetches unattended, on the
   * calendar provider's own schedule, so it always reflects the site's current
   * events and roster — not a one-time snapshot. That endpoint has no
   * session/cookie gate (nothing can type a passphrase into it), so the
   * passphrase travels in the URL instead, making this link a bearer secret.
   * Built only once unlocked, so it's never rendered before we actually have it.
   */
  const feedUrl = !isSampleBuild && passphrase
    ? `${window.location.origin}/calendar.ics?passphrase=${encodeURIComponent(passphrase)}`
    : null

  /** A single event is always public data (or a birthday already visible on screen), so unlike
   *  the section-wide feed this needs no passphrase — a plain one-off download is fine. */
  function downloadEntryICS(entry: CalendarEntry) {
    const blob = new Blob([toICS([entry], 'Section J', window.location.origin)], {
      type: 'text/calendar;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${entry.id}.ics`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="rounded-lg px-2.5 py-1.5 text-ink-500 hover:bg-ink-200 dark:hover:bg-ink-800"
          >
            ←
          </button>
          <h2 className="min-w-44 text-center font-serif text-xl">
            {MONTH_NAMES[cursor.month - 1]} {cursor.year}
          </h2>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="rounded-lg px-2.5 py-1.5 text-ink-500 hover:bg-ink-200 dark:hover:bg-ink-800"
          >
            →
          </button>
        </div>

        <div className="flex rounded-lg border border-ink-300 dark:border-ink-700">
          {(['timetable', 'calendar'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              className={`px-3 py-1.5 text-sm capitalize first:rounded-l-lg last:rounded-r-lg ${
                view === mode ? 'bg-green-600 text-white' : 'text-ink-500'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {feedUrl && (
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg border border-ink-300 px-3 py-1.5 text-sm dark:border-ink-700">
              Subscribe to section calendar
            </summary>
            <div className="card absolute right-0 z-20 mt-2 w-80 p-4 text-sm">
              <a
                href={feedUrl.replace(/^https?:/, 'webcal:')}
                className="block rounded-lg bg-green-600 px-3 py-2 text-center font-medium text-white transition hover:bg-green-700"
              >
                Open in Calendar app
              </a>
              <p className="mt-3 text-xs text-ink-500">
                Or paste this URL into Google Calendar / Outlook's "subscribe from URL":
              </p>
              <input
                readOnly
                value={feedUrl}
                onClick={(e) => e.currentTarget.select()}
                className="mt-1 w-full rounded-lg border border-ink-300 bg-ink-50 px-2 py-1.5 text-xs dark:border-ink-700 dark:bg-ink-900"
              />
              <p className="mt-3 text-xs text-ink-400">
                This link includes the section passphrase and keeps working even
                after you log out here — don't share it outside the section.
                Your calendar app re-fetches it on its own schedule, so it always
                shows the site's current events.
              </p>
            </div>
          </details>
        )}
      </div>

      {view === 'timetable' && upcoming.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">At a glance</p>
            {upcoming.length > 5 && (
              <button
                onClick={() => setGlanceExpanded((v) => !v)}
                className="text-xs text-green-700 underline underline-offset-2 dark:text-green-400"
              >
                {glanceExpanded ? 'Show fewer' : `Show ${Math.min(upcoming.length, 15) - 5} more`}
              </button>
            )}
          </div>
          <ul className="divide-y divide-ink-100 dark:divide-ink-900">
            {(glanceExpanded ? upcoming.slice(0, 15) : upcoming.slice(0, 5)).map((entry) => (
              <li key={entry.id}>
                <button
                  onClick={() => {
                    setView('timetable')
                    setEventScrollTarget(entry.id)
                  }}
                  className="flex w-full items-center gap-3 py-1.5 text-left transition hover:text-green-700 dark:hover:text-green-400"
                >
                  <span className={`size-1.5 shrink-0 rounded-full ${CATEGORY_DOT[entry.category]}`} />
                  <span className="w-24 shrink-0 text-xs text-ink-400">{formatShortDate(entry.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{entry.title}</span>
                  {entry.startTime && (
                    <span className="shrink-0 text-xs text-ink-400">{entry.startTime}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {ALL_CATEGORIES.map((category) => {
          const on = !hidden.has(category)
          return (
            <button
              key={category}
              onClick={() => toggleCategory(category)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs capitalize transition ${
                on
                  ? 'bg-ink-200 text-ink-700 dark:bg-ink-800 dark:text-ink-200'
                  : 'bg-transparent text-ink-400 line-through'
              }`}
            >
              <span className={`size-2 rounded-full ${CATEGORY_DOT[category]} ${on ? '' : 'opacity-30'}`} />
              {category}
            </button>
          )
        })}
      </div>

      {view === 'calendar' ? (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-ink-200 dark:border-ink-800">
            {DAY_NAMES.map((day) => (
              <div key={day} className="px-2 py-1.5 text-center text-xs font-semibold text-ink-400">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {grid.map((date) => {
              const inMonth = fromISODate(date).getUTCMonth() + 1 === cursor.month
              const entries = byDate.get(date) ?? []
              const isToday = date === today

              const hasEntries = entries.length > 0

              return (
                <div
                  key={date}
                  onClick={hasEntries ? () => goToDate(date) : undefined}
                  onKeyDown={
                    hasEntries
                      ? (e) => {
                          if (e.target !== e.currentTarget) return
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            goToDate(date)
                          }
                        }
                      : undefined
                  }
                  role={hasEntries ? 'button' : undefined}
                  tabIndex={hasEntries ? 0 : undefined}
                  aria-label={hasEntries ? `See ${formatLongDate(date)} in the timetable` : undefined}
                  className={`min-h-24 border-b border-r border-ink-200 p-1 text-left last:border-r-0 dark:border-ink-800 ${
                    inMonth ? '' : 'bg-ink-100/60 dark:bg-ink-900/40'
                  } ${hasEntries ? 'cursor-pointer transition hover:bg-green-50 dark:hover:bg-green-950/40' : ''}`}
                >
                  <div
                    className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs ${
                      isToday ? 'bg-green-600 font-semibold text-white' : 'text-ink-400'
                    }`}
                  >
                    {fromISODate(date).getUTCDate()}
                  </div>

                  <ul className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                    {entries.slice(0, 3).map((entry) => (
                      <li key={entry.id}>
                        <EntryChip entry={entry} />
                      </li>
                    ))}
                    {entries.length > 3 && (
                      <li className="px-1 text-[10px] text-ink-400">+{entries.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {upcoming.length === 0 && (
            <p className="card p-8 text-center text-sm text-ink-400">
              Nothing coming up in the visible categories.
            </p>
          )}
          {upcoming.map((entry) => (
            <div
              key={entry.id}
              ref={(el) => {
                if (el) {
                  timetableRefs.current.set(entry.date, el)
                  eventRefs.current.set(entry.id, el)
                } else {
                  timetableRefs.current.delete(entry.date)
                  eventRefs.current.delete(entry.id)
                }
              }}
              className={`card flex scroll-mt-20 gap-4 border-l-4 p-4 ${CATEGORY_BORDER[entry.category]}`}
            >
              <div className="w-14 shrink-0 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  {DAY_NAMES[fromISODate(entry.date).getUTCDay()]}
                </p>
                <p className="font-serif text-2xl text-ink-900 dark:text-ink-50">
                  {fromISODate(entry.date).getUTCDate()}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-ink-400">
                  {MONTH_NAMES[fromISODate(entry.date).getUTCMonth()].slice(0, 3)}
                </p>
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-serif text-base text-ink-900 dark:text-ink-50">{entry.title}</p>
                {(entry.startTime || entry.location) && (
                  <p className="text-xs text-ink-400">
                    {entry.startTime}
                    {entry.startTime && entry.location ? ' · ' : ''}
                    {entry.location}
                  </p>
                )}
                {entry.description && <p className="mt-1 text-sm text-ink-500">{entry.description}</p>}

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-ink-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-400 dark:border-ink-800">
                    {entry.category}
                  </span>
                  {entry.url &&
                    (entry.url.startsWith('/') ? (
                      <Link
                        to={entry.url}
                        className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-green-700"
                      >
                        RSVP / Info
                      </Link>
                    ) : (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-green-700"
                      >
                        RSVP / Info ↗
                      </a>
                    ))}
                  <button
                    onClick={() => downloadEntryICS(entry)}
                    className="rounded-lg border border-ink-300 px-3 py-1 text-xs dark:border-ink-700"
                  >
                    Add to calendar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-400">
        {isSampleBuild ? (
          <>This public demo uses only the fabricated events in <code className="rounded bg-ink-100 px-1 dark:bg-ink-800">data/events.demo.json</code>.</>
        ) : (
          <>
            Something missing? An admin can add it instantly from{' '}
            <Link to="/admin" className="underline underline-offset-2">
              the admin panel
            </Link>
            , or open a pull request against{' '}
            <code className="rounded bg-ink-100 px-1 dark:bg-ink-800">data/events.json</code> for a
            change that goes through review first.
          </>
        )}
      </p>

    </div>
  )
}

function EntryChip({ entry }: { entry: CalendarEntry }) {
  const className = `block w-full truncate rounded px-1 py-0.5 text-left text-[10px] ${CATEGORY_STYLE[entry.category]}`
  return (
    <span className={className} title={entry.title}>
      {entry.title}
    </span>
  )
}
