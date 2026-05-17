// @purpose Registers the passive service worker after page load. Best-effort, silent on failure.
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  // Only register in production-like serving (skip Vite dev to avoid stale shell caching during iteration).
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[devlogger-viewer] SW registration failed:', err)
    })
  })
}
