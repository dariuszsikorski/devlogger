// @purpose Pub/sub for log entries - lets external panels render devlogger events.
import type { Listener, LogEntry } from './types'
import { push as transportPush } from './transport'

const listeners = new Set<Listener>()

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function unsubscribeAll(): void {
  listeners.clear()
}

export function listenerCount(): number {
  return listeners.size
}

export function notify(entry: LogEntry): void {
  // Always push to remote transport (no-op when disabled).
  try {
    transportPush(entry)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[devlogger] transport push threw:', err)
  }

  if (listeners.size === 0) return
  listeners.forEach((listener) => {
    try {
      listener(entry)
    } catch (err) {
      // Never let a bad subscriber break the host app.
      // eslint-disable-next-line no-console
      console.error('[devlogger] subscriber threw:', err)
    }
  })
}
