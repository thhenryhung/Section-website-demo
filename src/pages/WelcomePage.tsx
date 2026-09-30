import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { PersonPhoto } from '../components/PersonPhoto'
import { useSectionData } from '../gate/SectionData'
import { siteConfig } from '../lib/siteConfig'

type Feature = {
  to: string
  name: string
  description: string
  icon: ReactElement
}

const ICON_PROPS = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const FEATURES: Feature[] = [
  {
    to: '/directory',
    name: 'Jirectory',
    description: 'Browse the section by hometown, pre-MBA background, and interests',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" />
        <path d="M16 7h5M16 11h5M16 15h4" />
      </svg>
    ),
  },
  {
    to: '/calendar',
    name: 'Jalendar',
    description: 'Section events, dinners, and birthdays, all in one place',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" />
        <path d="M7.5 13h2M11.5 13h2M15.5 13h2M7.5 17h2M11.5 17h2" />
      </svg>
    ),
  },
  {
    to: '/social',
    name: 'Jocial',
    description: 'Your dinner group and coffee chat pairing — new ones announced every 3 weeks',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="9" cy="8" r="3" />
        <circle cx="16" cy="9" r="2.5" />
        <path d="M4 20c0-2.8 2.2-5 5-5s5 2.2 5 5" />
        <path d="M13.5 15.2c2.3.3 4 2.2 4 4.8" />
      </svg>
    ),
  },
  {
    to: '/fun',
    name: 'Just for Fun',
    description: 'Quiz yourself on fictional classmates’ hometowns, employers, and faces',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.8-1.7 1.3-1.7 2.7" />
        <path d="M12 17h.01" />
      </svg>
    ),
  },
]

// A deliberately varied welcome strip. These remain fictional sample people;
// the complete roster appears with portraits in Jocial.
const FEATURED_SAMPLE_IDS = ['fmenon', 'aaziz', 'ipetrov', 'eduarte', 'gbianchi', 'ryusuf2']

/** The first thing anyone sees after unlocking — a quick orientation. */
export function WelcomePage() {
  const { people, isSampleBuild } = useSectionData()
  const featuredPeople = FEATURED_SAMPLE_IDS.map((id) => people.find((person) => person.id === id)).filter(
    (person): person is NonNullable<typeof person> => Boolean(person?.photoId),
  )

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-100 to-green-50 dark:from-green-700 dark:to-ink-950">
      <div className="absolute inset-0 dark:bg-ink-950/60" aria-hidden="true" />

      <div className="relative px-5 py-10 sm:px-8 sm:py-12">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl text-ink-900 dark:text-white">Welcome to {siteConfig.orgName}</h1>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-200">Your one-stop portal to the section</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Link
              key={feature.to}
              to={feature.to}
              className="card group flex flex-col gap-2 p-5 transition hover:border-green-400 hover:shadow-md"
            >
              <div className="text-green-600 dark:text-green-400">{feature.icon}</div>
              <p className="font-serif text-lg text-ink-900 group-hover:text-green-700 dark:text-ink-50 dark:group-hover:text-green-400">
                {feature.name}
              </p>
              <p className="text-sm text-ink-500 dark:text-ink-400">{feature.description}</p>
            </Link>
          ))}
        </div>

        {isSampleBuild && featuredPeople.length > 0 && (
          <section className="mt-7" aria-labelledby="sample-people-heading">
            <div className="mb-3 text-center">
              <h2 id="sample-people-heading" className="font-serif text-xl text-ink-900 dark:text-white">
                Meet the sample section
              </h2>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-300">
                A fictional, generated portrait collection for this public demo.
              </p>
            </div>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {featuredPeople.map((person) => (
                <li key={person.id} className="text-center">
                  <PersonPhoto person={person} className="mx-auto size-16 rounded-full border-2 border-white shadow-sm" />
                  <span className="mt-1 block truncate text-xs text-ink-700 dark:text-ink-100">
                    {person.firstName}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link
          to="/install"
          className="card group mt-4 flex items-center gap-3 p-4 transition hover:border-green-400 hover:shadow-md"
        >
          <span className="text-xl" aria-hidden="true">
            🔔
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-base text-ink-900 group-hover:text-green-700 dark:text-ink-50 dark:group-hover:text-green-400">
              Get push notifications
            </span>
            <span className="block text-xs text-ink-500 dark:text-ink-400">
              Add this site to your Home Screen so new events can notify you directly
            </span>
          </span>
          <span className="text-ink-400" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </div>
  )
}
