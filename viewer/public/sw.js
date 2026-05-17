// @purpose Passive service worker - cache shell for offline-resilience + PWA installability.
// Event-driven only (no setInterval - SW sleeps anyway when not handling events).
// Bypasses WS / live endpoints so the stream is never cached.

const CACHE_NAME = 'devlogger-viewer-v1'
const SHELL = ['/', '/index.html']
const BYPASS_PREFIXES = ['/stream', '/ingest', '/health']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)).catch(() => { /* ignore */ })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return

  let url
  try { url = new URL(req.url) } catch { return }
  if (url.origin !== self.location.origin) return
  if (BYPASS_PREFIXES.some((p) => url.pathname.startsWith(p))) return

  // Network-first - keeps dev iteration snappy; cache is a fallback for offline / cold-start.
  e.respondWith(
    fetch(req)
      .then((resp) => {
        const copy = resp.clone()
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => { /* ignore */ })
        return resp
      })
      .catch(() => caches.match(req).then((cached) => cached || Response.error()))
  )
})
