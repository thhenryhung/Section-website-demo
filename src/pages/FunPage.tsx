import { useMemo, useState } from 'react'
import { PersonPhoto } from '../components/PersonPhoto'
import { useSectionData } from '../gate/SectionData'
import type { Person, Region } from '../lib/types'

type Mode = 'portrait' | 'name-photo' | 'hometown' | 'employer'

type Question = {
  prompt: string
  person: Person
  answer: string
  options: string[]
  showsPortrait: boolean
  showsName: boolean
  photoOptions?: Person[]
}

const MODES: { mode: Mode; label: string }[] = [
  { mode: 'portrait', label: 'Guess who' },
  { mode: 'name-photo', label: 'Name → photo' },
  { mode: 'hometown', label: 'Name → hometown' },
  { mode: 'employer', label: 'Name → employer' },
]

function regionLabel(region?: Region): string | undefined {
  const value = region && [region.city, region.state, region.country].filter(Boolean).join(', ')
  return value || undefined
}

function hash(value: string): number {
  let result = 0
  for (let index = 0; index < value.length; index++) result = (result * 31 + value.charCodeAt(index)) >>> 0
  return result
}

function rotate<T>(items: T[], seed: string): T[] {
  if (items.length < 2) return items
  const offset = hash(seed) % items.length
  return [...items.slice(offset), ...items.slice(0, offset)]
}

function options(answer: string, possibilities: string[], seed: string): string[] {
  const alternatives = rotate([...new Set(possibilities)].filter((value) => value !== answer), `${seed}-answers`)
  return rotate([answer, ...alternatives.slice(0, 3)], `${seed}-order`)
}

function makeQuestion(mode: Mode, round: number, people: Person[]): Question | null {
  const seed = `${mode}-${round}`
  if (mode === 'name-photo') {
    const candidates = people.filter((person) => person.photoId)
    if (candidates.length < 4) return null
    const person = candidates[hash(seed) % candidates.length]
    const photoOptions = rotate(
      [person, ...rotate(candidates.filter((candidate) => candidate.id !== person.id), `${seed}-photos`).slice(0, 3)],
      `${seed}-order`,
    )
    return {
      prompt: `Which portrait belongs to ${person.displayName}?`,
      person,
      answer: person.id,
      options: photoOptions.map((candidate) => candidate.id),
      showsPortrait: false,
      showsName: false,
      photoOptions,
    }
  }

  if (mode === 'portrait') {
    const candidates = people.filter((person) => person.photoId)
    if (candidates.length < 4) return null
    const person = candidates[hash(seed) % candidates.length]
    return {
      prompt: 'Which fictional classmate is this?',
      person,
      answer: person.displayName,
      options: options(person.displayName, candidates.map((candidate) => candidate.displayName), seed),
      showsPortrait: true,
      showsName: false,
    }
  }

  if (mode === 'hometown') {
    const candidates = people.filter((person) => regionLabel(person.homeRegion))
    const person = candidates[hash(seed) % candidates.length]
    const answer = regionLabel(person.homeRegion)
    if (!person || !answer) return null
    return {
      prompt: "What's their hometown?",
      person,
      answer,
      options: options(answer, candidates.flatMap((candidate) => regionLabel(candidate.homeRegion) ?? []), seed),
      showsPortrait: false,
      showsName: true,
    }
  }

  const candidates = people.filter((person) => person.preMBA[0]?.company)
  const person = candidates[hash(seed) % candidates.length]
  const answer = person?.preMBA[0]?.company
  if (!person || !answer) return null
  return {
    prompt: 'Where did they work before their MBA?',
    person,
    answer,
    options: options(answer, candidates.flatMap((candidate) => candidate.preMBA[0]?.company ?? []), seed),
    showsPortrait: false,
    showsName: true,
  }
}

/** A lighthearted, fabricated-only quiz that demonstrates the richer roster fields. */
export function FunPage() {
  const { people, isSampleBuild } = useSectionData()
  const [mode, setMode] = useState<Mode>('portrait')
  const [round, setRound] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [correct, setCorrect] = useState(0)
  const [answered, setAnswered] = useState(0)

  const question = useMemo(() => makeQuestion(mode, round, people), [mode, people, round])

  function changeMode(nextMode: Mode) {
    setMode(nextMode)
    setRound(0)
    setSelected(null)
    setCorrect(0)
    setAnswered(0)
  }

  function answer(value: string) {
    if (!question || selected) return
    setSelected(value)
    setAnswered((count) => count + 1)
    if (value === question.answer) setCorrect((count) => count + 1)
  }

  function next() {
    setRound((value) => value + 1)
    setSelected(null)
  }

  if (!isSampleBuild) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h1 className="font-serif text-2xl">Just for Fun is a demo-only feature</h1>
        <p className="mt-2 text-sm text-ink-500">It stays disabled for real section data to protect classmates’ privacy.</p>
      </div>
    )
  }

  if (!question) {
    return <div className="card p-8 text-center text-sm text-ink-500">There isn’t enough sample data to create a quiz question yet.</div>
  }

  const isCorrect = selected === question.answer
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
        Demo only — every question, answer, and portrait is fictional.
      </p>

      <div className="flex flex-wrap gap-2" aria-label="Quiz mode">
        {MODES.map((item) => (
          <button
            key={item.mode}
            type="button"
            onClick={() => changeMode(item.mode)}
            className={`rounded-lg px-3 py-2 text-sm ${mode === item.mode ? 'bg-green-600 text-white' : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-100 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="card overflow-hidden p-6 text-center sm:p-8" aria-live="polite">
        <p className="text-sm text-ink-500">{answered === 0 ? 'Question 1' : `${correct} correct / ${answered}`}</p>
        {question.showsPortrait ? (
          <PersonPhoto person={question.person} className="mx-auto mt-5 size-36 rounded-full border-4 border-green-100 shadow-md dark:border-green-900" />
        ) : question.showsName ? (
          <p className="mt-7 font-serif text-3xl text-green-700 dark:text-green-400">{question.person.displayName}</p>
        ) : null}
        <h1 className="mt-5 font-serif text-2xl">{question.prompt}</h1>

        <div className="mx-auto mt-6 grid max-w-lg gap-3 sm:grid-cols-2">
          {question.options.map((option, index) => {
            const state = selected
              ? option === question.answer
                ? 'border-green-600 bg-green-100 text-green-900 dark:bg-green-950/50 dark:text-green-100'
                : option === selected
                  ? 'border-crimson-600 bg-crimson-50 text-crimson-900 dark:bg-crimson-950/40 dark:text-crimson-100'
                  : 'border-ink-200 text-ink-400 dark:border-ink-800'
              : 'border-ink-200 bg-white hover:border-green-400 hover:bg-green-50 dark:border-ink-800 dark:bg-ink-900 dark:hover:bg-green-950/30'
            const optionPerson = question.photoOptions?.find((person) => person.id === option)
            return question.photoOptions && optionPerson ? (
              <button
                key={option}
                type="button"
                aria-label={`Portrait option ${index + 1}`}
                disabled={Boolean(selected)}
                onClick={() => answer(option)}
                className={`flex items-center justify-center rounded-lg border p-3 transition disabled:cursor-default ${state}`}
              >
                <PersonPhoto person={optionPerson} className="size-24 rounded-full shadow-sm" />
              </button>
            ) : (
              <button
                key={option}
                type="button"
                disabled={Boolean(selected)}
                onClick={() => answer(option)}
                className={`rounded-lg border px-4 py-3 text-sm font-medium transition disabled:cursor-default ${state}`}
              >
                {option}
              </button>
            )
          })}
        </div>

        {selected && (
          <div className="mt-6">
            <p className={`text-sm font-medium ${isCorrect ? 'text-green-700 dark:text-green-400' : 'text-crimson-700 dark:text-crimson-400'}`}>
              {isCorrect ? 'Correct!' : `Not quite — it was ${question.photoOptions ? question.person.displayName : question.answer}.`}
            </p>
            <button type="button" onClick={next} className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
