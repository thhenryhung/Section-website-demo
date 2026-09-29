import { useEffect, useState } from 'react'
import { getExistingSubscription, isStandalone, pushSupported, subscribeToPush, unsubscribeFromPush } from '../lib/push'

/** iOS only allows push after "Add to Home Screen" — a plain Safari tab can't subscribe at all. */
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

type State = 'unknown' | 'unsubscribed' | 'subscribed' | 'needs-install' | 'unsupported' | 'busy'

export function PushSubscribeButton() {
  const [state, setState] = useState<State>('unknown')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pushSupported()) {
      setState('unsupported')
      return
    }
    if (isIOS() && !isStandalone()) {
      setState('needs-install')
      return
    }
    getExistingSubscription().then((sub) => setState(sub ? 'subscribed' : 'unsubscribed'))
  }, [])

  async function toggle() {
    const wasSubscribed = state === 'subscribed'
    setError(null)
    setState('busy')
    try {
      if (wasSubscribed) {
        await unsubscribeFromPush()
        setState('unsubscribed')
      } else {
        await subscribeToPush()
        setState('subscribed')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      setState(wasSubscribed ? 'subscribed' : 'unsubscribed')
    }
  }

  if (state === 'unsupported') return null

  if (state === 'needs-install') {
    return (
      <button
        disabled
        title="Add to Home Screen first, using the steps below"
        className="cursor-not-allowed rounded-lg border border-ink-300 px-3 py-1.5 text-sm text-ink-400 dark:border-ink-700"
      >
        🔔 Add to Home Screen first
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        disabled={state === 'busy' || state === 'unknown'}
        aria-pressed={state === 'subscribed'}
        className={`rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-60 ${
          state === 'subscribed'
            ? 'border-green-500 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200'
            : 'border-ink-300 dark:border-ink-700'
        }`}
      >
        {state === 'subscribed' ? '🔔 Notifications on' : '🔔 Get push notifications'}
      </button>
      {error && (
        <p className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-ink-200 bg-white p-2 text-xs text-red-700 shadow-lg dark:border-ink-800 dark:bg-ink-900 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
