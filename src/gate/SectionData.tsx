/**
 * The unlock gate and the single source of section data for the whole app.
 *
 * Nothing below this provider can see a name, a number, or a face until a correct
 * passphrase has been supplied. The encrypted payloads are fetched only after an
 * unlock is attempted, so a visitor who never gets past the gate never even pulls
 * the ciphertext down.
 *
 * Passphrase storage:
 *   - session only (default)  → sessionStorage, gone when the tab closes
 *   - remember on this device → localStorage, plus an IndexedDB plaintext cache
 *     so reloads skip the ~0.6s key derivation
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { DecryptError, decryptJSON } from '../lib/crypto'
import { idbClear, idbGet, idbSet } from '../lib/idb'
import type { MeetupHistory, Person, Roster } from '../lib/types'

const STORAGE_KEY = 'section-j.passphrase'
const REMEMBER_KEY = 'section-j.remember'

type Status = 'locked' | 'unlocking' | 'unlocked' | 'error'

type SectionDataValue = {
  status: Status
  error: string | null
  roster: Roster | null
  meetups: MeetupHistory
  /** Convenience: people sorted by first name, which is how everything displays them. */
  people: Person[]
  byId: Map<string, Person>
  isSampleBuild: boolean
  /** Kept in memory (never persisted beyond what unlock() itself already does) so the
   *  calendar subscribe link can be built without asking a second time. */
  passphrase: string | null
  unlock: (passphrase: string, remember: boolean) => Promise<void>
  lock: () => void
  /**
   * Replace the in-memory meetup history after generating a round on the admin
   * page. Deliberately does not persist: the generated JSON is downloaded,
   * reviewed, and committed to the private repo, so a bad round can never
   * silently become the section's history.
   */
  setMeetups: (history: MeetupHistory) => void
}

const EMPTY_HISTORY: MeetupHistory = { version: 1, rounds: [] }

const SectionDataContext = createContext<SectionDataValue | null>(null)

type Manifest = { version: number; generatedAt: string; sample?: boolean }

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error(
      `Could not load ${url} (${response.status}). Run \`npm run data:encrypt\` to generate it.`,
    )
  }
  return new Uint8Array(await response.arrayBuffer())
}

export function SectionDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('locked')
  const [error, setError] = useState<string | null>(null)
  const [roster, setRoster] = useState<Roster | null>(null)
  const [meetups, setMeetups] = useState<MeetupHistory>(EMPTY_HISTORY)
  const [isSampleBuild, setIsSampleBuild] = useState(false)
  const [passphrase, setPassphrase] = useState<string | null>(null)

  /** Guards against a second unlock racing the first (e.g. the auto-unlock). */
  const inFlight = useRef(false)

  const unlock = useCallback(async (passphrase: string, remember: boolean) => {
    if (inFlight.current) return
    inFlight.current = true
    setStatus('unlocking')
    setError(null)

    try {
      const manifest = (await (await fetch('/data/manifest.json', { cache: 'no-cache' })).json()) as Manifest
      setIsSampleBuild(Boolean(manifest.sample))

      // Cache key includes the build stamp, so a redeploy invalidates it for free.
      const cacheKey = `payload:${manifest.generatedAt}`
      const cached = remember
        ? await idbGet<{ roster: Roster; meetups: MeetupHistory }>(cacheKey)
        : undefined

      let nextRoster: Roster
      let nextMeetups: MeetupHistory

      if (cached) {
        nextRoster = cached.roster
        nextMeetups = cached.meetups ?? EMPTY_HISTORY
      } else {
        const [rosterBytes, meetupBytes] = await Promise.all([
          fetchBytes('/data/roster.enc'),
          fetchBytes('/data/meetups.enc'),
        ])
        nextRoster = await decryptJSON<Roster>(rosterBytes, passphrase)
        nextMeetups = await decryptJSON<MeetupHistory>(meetupBytes, passphrase)
        if (remember) {
          await idbSet(cacheKey, {
            roster: nextRoster,
            meetups: nextMeetups,
          })
        }
      }

      setRoster(nextRoster)
      setMeetups(nextMeetups)
      setPassphrase(passphrase)
      setStatus('unlocked')

      const store = remember ? localStorage : sessionStorage
      store.setItem(STORAGE_KEY, passphrase)
      localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
    } catch (caught) {
      // A bad passphrase must not leave a stale passphrase behind to retry with.
      sessionStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(STORAGE_KEY)
      setStatus('error')
      setError(
        caught instanceof DecryptError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'Something went wrong while unlocking.',
      )
    } finally {
      inFlight.current = false
    }
  }, [])

  const lock = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(REMEMBER_KEY)
    void idbClear()
    setRoster(null)
    setMeetups(EMPTY_HISTORY)
    setPassphrase(null)
    setStatus('locked')
    setError(null)
  }, [])

  // Restore a previous session on load, if one was stored.
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY)
    if (stored) void unlock(stored, localStorage.getItem(REMEMBER_KEY) === '1')
  }, [unlock])

  const people = useMemo(
    () =>
      [...(roster?.people ?? [])].sort(
        (a, b) =>
          a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName),
      ),
    [roster],
  )

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  const value = useMemo<SectionDataValue>(
    () => ({
      status,
      error,
      roster,
      meetups,
      people,
      byId,
      isSampleBuild,
      passphrase,
      unlock,
      lock,
      setMeetups,
    }),
    [status, error, roster, meetups, people, byId, isSampleBuild, passphrase, unlock, lock],
  )

  return <SectionDataContext.Provider value={value}>{children}</SectionDataContext.Provider>
}

export function useSectionData(): SectionDataValue {
  const value = useContext(SectionDataContext)
  if (!value) throw new Error('useSectionData must be used inside <SectionDataProvider>')
  return value
}
