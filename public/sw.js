/**
 * Push notification service worker. Deliberately not a full offline/caching
 * service worker — this site's content is either public static data or
 * passphrase-encrypted, so there is nothing useful to cache-and-serve
 * offline. This worker exists solely to receive and show push notifications.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = { title: 'Section J', body: 'New activity on the section site.' }
  try {
    if (event.data) data = event.data.json()
  } catch {
    if (event.data) data.body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Same tag replaces an existing notification for the same event instead
      // of stacking a duplicate; renotify makes the replacement still alert.
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/calendar' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/calendar'

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clientsList) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(url)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
