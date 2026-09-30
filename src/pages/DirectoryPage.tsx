import { useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import { PersonPhoto } from '../components/PersonPhoto'
import { useSectionData } from '../gate/SectionData'
import type { Person, Region } from '../lib/types'

type View = 'table' | 'card'
type FilterKey = 'interest' | 'industry' | 'region' | 'university'

type Filters = Record<FilterKey, string[]>

const EMPTY_FILTERS: Filters = { interest: [], industry: [], region: [], university: [] }

function regionLabel(region?: Region): string {
  if (!region) return '—'
  return [region.city, region.state, region.country].filter(Boolean).join(', ') || '—'
}

function industries(person: Person): string[] {
  return [...new Set(person.preMBA.map((role) => role.industry).filter((industry): industry is string => Boolean(industry)))]
}

function universities(person: Person): string[] {
  return [...new Set(person.education.map((education) => education.school).filter((school): school is string => Boolean(school)))]
}

function matchesEveryFilter(person: Person, filters: Filters): boolean {
  const values: Record<FilterKey, string[]> = {
    interest: person.professionalInterests,
    industry: industries(person),
    region: person.homeRegion ? [regionLabel(person.homeRegion)] : [],
    university: universities(person),
  }

  return (Object.keys(filters) as FilterKey[]).every(
    (key) => filters[key].length === 0 || filters[key].some((value) => values[key].includes(value)),
  )
}

/** A searchable, filterable fictional roster for the public demo build. */
export function DirectoryPage() {
  const { people, isSampleBuild } = useSectionData()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('table')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)

  const sortedPeople = useMemo(
    () => [...people].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [people],
  )
  const fuse = useMemo(
    () =>
      new Fuse(sortedPeople, {
        keys: [
          'displayName',
          'currentCity',
          'homeRegion.city',
          'homeRegion.state',
          'homeRegion.country',
          'preMBA.company',
          'preMBA.title',
          'preMBA.industry',
          'professionalInterests',
          'education.school',
        ],
        threshold: 0.32,
        ignoreLocation: true,
      }),
    [sortedPeople],
  )

  const options = useMemo<Record<FilterKey, string[]>>(
    () => ({
      interest: unique(sortedPeople.flatMap((person) => person.professionalInterests)),
      industry: unique(sortedPeople.flatMap(industries)),
      region: unique(sortedPeople.map((person) => regionLabel(person.homeRegion)).filter((region) => region !== '—')),
      university: unique(sortedPeople.flatMap(universities)),
    }),
    [sortedPeople],
  )

  const filteredPeople = useMemo(() => {
    const searched = query.trim() ? fuse.search(query.trim()).map((result) => result.item) : sortedPeople
    return searched.filter((person) => matchesEveryFilter(person, filters))
  }, [filters, fuse, query, sortedPeople])

  function toggleFilter(key: FilterKey, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((selected) => selected !== value)
        : [...current[key], value],
    }))
  }

  return (
    <div className="flex flex-col gap-5">
      {isSampleBuild && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
          Demo roster only — every name, detail, and portrait below is fabricated.
        </p>
      )}

      <div className="card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <label className="sr-only" htmlFor="directory-search">
            Search the section
          </label>
          <input
            id="directory-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, employer, interest, city…"
            className="min-w-0 flex-1 rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-900"
          />
          <div className="flex items-center justify-between gap-3 lg:justify-end">
            <p className="whitespace-nowrap text-sm text-ink-500">
              <strong className="font-medium text-ink-800 dark:text-ink-100">{filteredPeople.length}</strong> of {people.length}
            </p>
            <div className="flex rounded-lg border border-ink-200 p-0.5 dark:border-ink-800" aria-label="Directory view">
              <ViewButton active={view === 'table'} onClick={() => setView('table')}>Table</ViewButton>
              <ViewButton active={view === 'card'} onClick={() => setView('card')}>Card</ViewButton>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <FilterMenu label="Professional interest" options={options.interest} selected={filters.interest} onToggle={(value) => toggleFilter('interest', value)} />
          <FilterMenu label="Pre-MBA industry" options={options.industry} selected={filters.industry} onToggle={(value) => toggleFilter('industry', value)} />
          <FilterMenu label="Home region" options={options.region} selected={filters.region} onToggle={(value) => toggleFilter('region', value)} />
          <FilterMenu label="University" options={options.university} selected={filters.university} onToggle={(value) => toggleFilter('university', value)} />
          {(Object.values(filters).some((selected) => selected.length > 0) || query) && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setFilters(EMPTY_FILTERS)
              }}
              className="px-2 py-1 text-sm text-ink-500 underline underline-offset-2 hover:text-green-700 dark:hover:text-green-400"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filteredPeople.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-500">No classmates match those filters.</div>
      ) : view === 'table' ? (
        <TableView people={filteredPeople} />
      ) : (
        <CardView people={filteredPeople} />
      )}
    </div>
  )
}

function ViewButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm ${active ? 'bg-green-600 text-white' : 'text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800'}`}
    >
      {children}
    </button>
  )
}

function FilterMenu({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={`rounded-lg border px-3 py-1.5 text-sm ${selected.length ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'border-ink-200 text-ink-600 hover:bg-ink-100 dark:border-ink-800 dark:text-ink-300 dark:hover:bg-ink-800'}`}
      >
        {label}{selected.length ? ` (${selected.length})` : ''} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-72 overflow-y-auto rounded-lg border border-ink-200 bg-white p-2 shadow-lg dark:border-ink-800 dark:bg-ink-900">
          {options.map((option) => (
            <label key={option} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-ink-100 dark:hover:bg-ink-800">
              <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} className="accent-green-600" />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function TableView({ people }: { people: Person[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Industry</th>
            <th className="px-4 py-3 font-medium">Professional interests</th>
            <th className="px-4 py-3 font-medium">Home region</th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id} className="border-b border-ink-100 last:border-0 dark:border-ink-800">
              <td className="px-4 py-3 font-medium">
                <span className="flex items-center gap-2">
                  <PersonPhoto person={person} className="size-9 rounded-full" />
                  {person.displayName}
                </span>
              </td>
              <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{industries(person).join(', ') || '—'}</td>
              <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{person.professionalInterests.join(', ') || '—'}</td>
              <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{regionLabel(person.homeRegion)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CardView({ people }: { people: Person[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {people.map((person) => {
        const latestRole = person.preMBA[0]
        return (
          <li key={person.id} className="card p-4">
            <div className="flex items-center gap-3">
              <PersonPhoto person={person} className="size-16 rounded-full" />
              <div className="min-w-0">
                <h2 className="font-serif text-xl">{person.displayName}</h2>
                <p className="truncate text-sm text-ink-500">{latestRole?.title || latestRole?.company || person.currentCity || regionLabel(person.homeRegion)}</p>
                {latestRole?.company && latestRole.title && <p className="truncate text-xs text-ink-400">{latestRole.company}</p>}
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div><dt className="text-xs uppercase tracking-wide text-ink-400">Home</dt><dd>{regionLabel(person.homeRegion)}</dd></div>
              {universities(person).length > 0 && <div><dt className="text-xs uppercase tracking-wide text-ink-400">University</dt><dd>{universities(person).join(', ')}</dd></div>}
            </dl>
            {person.professionalInterests.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {person.professionalInterests.map((interest) => <li key={interest} className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700 dark:bg-green-950/50 dark:text-green-400">{interest}</li>)}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}
