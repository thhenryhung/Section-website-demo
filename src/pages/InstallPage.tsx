import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AndroidInstallStep, AndroidMenuStep, IosAddToHomeStep, IosShareStep } from '../components/InstallIllustrations'
import { PushSubscribeButton } from '../components/PushSubscribeButton'

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent)
}

export function InstallPage() {
  const platform = isIOS() ? 'ios' : isAndroid() ? 'android' : null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl text-ink-900 dark:text-ink-50">Get push notifications</h1>
        <p className="mt-1 text-sm text-ink-500">
          Push notifications only work once Section J is added to your Home Screen — that's an
          Apple/Google rule for every website, not something specific to this site. It takes
          about 10 seconds.
        </p>
      </div>

      <div className="card flex flex-col items-center gap-2 p-5 text-center">
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Already added to your Home Screen? Enable notifications here:
        </p>
        <PushSubscribeButton />
      </div>

      <Section
        title="On iPhone / iPad (Safari)"
        highlighted={platform === 'ios'}
        steps={[
          { illustration: <IosShareStep />, text: 'Open this site in Safari, then tap the Share icon in the toolbar.' },
          { illustration: <IosAddToHomeStep />, text: 'Scroll down and tap "Add to Home Screen", then confirm.' },
        ]}
        after='Open Section J from the new icon on your Home Screen (not from Safari), then come back to this page and tap the button above.'
      />

      <Section
        title="On Android (Chrome)"
        highlighted={platform === 'android'}
        steps={[
          { illustration: <AndroidMenuStep />, text: 'Open this site in Chrome, then tap the ⋮ menu in the top right.' },
          { illustration: <AndroidInstallStep />, text: 'Tap "Install app" and confirm.' },
        ]}
        after='Chrome may also offer this automatically as an "Install app" banner — either way works.'
      />

      <p className="text-sm text-ink-500">
        <Link to="/calendar" className="underline underline-offset-2 hover:text-ink-900 dark:hover:text-ink-100">
          ← Back to Jalendar
        </Link>
      </p>
    </div>
  )
}

function Section({
  title,
  highlighted,
  steps,
  after,
}: {
  title: string
  highlighted: boolean
  steps: { illustration: ReactNode; text: string }[]
  after: string
}) {
  return (
    <section className={`card p-5 ${highlighted ? 'border-green-400' : ''}`}>
      <h2 className="mb-4 font-serif text-lg text-ink-900 dark:text-ink-50">
        {title}
        {highlighted && (
          <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 align-middle text-xs font-sans font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
            Your device
          </span>
        )}
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {steps.map((step, i) => (
          <div key={i} className="flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-1.5 self-start">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-semibold text-white">
                {i + 1}
              </span>
            </div>
            {step.illustration}
            <p className="text-xs text-ink-500">{step.text}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-ink-400">{after}</p>
    </section>
  )
}
