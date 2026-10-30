const CACHE_NAME = 'jarvis-shell-v1'
const BUILD_MANIFEST_URL = '/build-manifest.json'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await cache.add('/')
    const response = await fetch(BUILD_MANIFEST_URL)
    if (!response.ok) throw new Error('No se pudo leer el manifiesto de recursos de la app.')
    const manifest = await response.json()
    const assets = new Set([BUILD_MANIFEST_URL])
    for (const entry of Object.values(manifest)) {
      for (const asset of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) {
        if (asset) assets.add(new URL(asset, self.location.origin).href)
      }
    }
    await cache.addAll([...assets])
  }).then(() => self.skipWaiting()))
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