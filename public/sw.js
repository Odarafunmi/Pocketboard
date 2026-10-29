const CACHE = 'pocketboard-v16'
const CORE = ['/', '/manifest.webmanifest', '/favicon.svg', '/editorial-chair.jpg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  // Always prefer the latest app shell when online so installed clients receive
  // new interaction fixes; retain the cached shell for offline use.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(async (response) => {
      if (response.ok) {
        try {
          const cache = await caches.open(CACHE)
          await cache.put(event.request, response.clone())
        } catch { /* A cache failure should not prevent an online navigation. */ }
      }
      return response
    }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))))
    return
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          }
          return response
        })
        .catch(() => cached || caches.match('/'))
      return cached || network
    }),
  )
})
