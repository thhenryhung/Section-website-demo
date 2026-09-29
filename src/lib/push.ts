/**
 * Client-side push subscription helper.
 *
 * Framework-free like the rest of src/lib/, so it can be unit-tested or reused
 * outside React if this ever needs it. Mirrors the server side in
 * functions/_shared/push.ts and functions/subscribe.ts.
 */

import { siteConfig } from './siteConfig'

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

/** iOS only allows push from a Home-Screen install, never from a normal Safari tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // Safari's own (non-standard, pre-standalone-media-query) flag on iOS.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

/** Registers the service worker (idempotent), requests permission, and subscribes. */
export async function subscribeToPush(): Promise<void> {
  if (!pushSupported()) throw new Error('Push is not supported in this browser.')

  await navigator.serviceWorker.register('/sw.js')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')

  const ready = await navigator.serviceWorker.ready
  const subscription = await ready.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(siteConfig.vapidPublicKey) as BufferSource,
  })

  const res = await fetch('/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  })
  if (!res.ok) throw new Error('Could not save the subscription — try again in a moment.')
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getExistingSubscription()
  if (!subscription) return
  await fetch('/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })
  await subscription.unsubscribe()
}
