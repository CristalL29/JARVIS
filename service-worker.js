const CACHE_NAME = 'jarvis-shell-v1'
const APP_SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.svg', '/icon-512.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith('jarvis-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const requestUrl = new URL(request.url)
  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return
  if (request.destination === 'audio' || request.destination === 'video' || request.headers.has('range')) return

  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok && response.type === 'basic' && !requestUrl.search) {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
      }
      return response
    }).catch(() => caches.match(request).then((cached) => cached || (request.mode === 'navigate' ? caches.match('/') : Response.error()))),
  )
})