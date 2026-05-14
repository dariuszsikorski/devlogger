// @purpose Intelligent throttle - merges identical-shape logs within a window,
// emits a single line with a (xN) counter, keeps differing logs separate.
import type { LogLevel, LogEntry } from './types'
import { getConfig } from './config'
import { shapeKey } from './format'
import { notify } from './subscribe'

interface Pending {
  level: LogLevel
  scope: string | null
  latestArgs: unknown[]
  count: number
  timer: ReturnType<typeof setTimeout>
}

const pending = new Map<string, Pending>()

type Emit = (level: LogLevel, scope: string | null, args: unknown[], suffix?: string) => void

/**
 * Record one log occurrence. If throttling is enabled and a matching entry is
 * already pending within the window, increment its counter. Otherwise emit
 * immediately and open a window during which further matches will batch.
 *
 * The window uses "first-immediate, then-batch":
 *   - First call: emitted now, window scheduled.
 *   - Calls within window with same shape: buffered (count++, latest args saved).
 *   - On window expiry: if count>1, emit a summary "(xN)" line with the latest args.
 *
 * Different-shape logs bypass batching entirely - they always emit immediately.
 */
export function record(
  level: LogLevel,
  scope: string | null,
  args: unknown[],
  emit: Emit,
): void {
  const cfg = getConfig()
  const throttleDisabled = cfg.throttleMs <= 0

  if (throttleDisabled) {
    emit(level, scope, args)
    publish(level, scope, args, 1)
    return
  }

  const key = `${level}|${scope ?? ''}|${shapeKey(args)}`
  const existing = pending.get(key)

  if (existing) {
    existing.count += 1
    existing.latestArgs = args
    return
  }

  emit(level, scope, args)
  publish(level, scope, args, 1)

  const timer = setTimeout(() => flush(key, emit), cfg.throttleMs)
  pending.set(key, { level, scope, latestArgs: args, count: 1, timer })
}

function flush(key: string, emit: Emit): void {
  const entry = pending.get(key)
  if (!entry) return
  pending.delete(key)

  // count includes the first (already-emitted) call. If nothing piled up, skip the summary.
  if (entry.count <= 1) return

  const extra = entry.count - 1
  emit(entry.level, entry.scope, entry.latestArgs, `(x${entry.count})`)
  publish(entry.level, entry.scope, entry.latestArgs, entry.count)
  void extra
}

function publish(level: LogLevel, scope: string | null, args: unknown[], count: number): void {
  const entry: LogEntry = { level, scope, args, timestamp: Date.now(), count }
  notify(entry)
}

/** Flush all pending throttled logs immediately. Useful before process exit. */
export function flushAll(emit: Emit): void {
  Array.from(pending.keys()).forEach((key) => flush(key, emit))
}

/** For tests: drop all pending state without emitting. */
export function resetThrottle(): void {
  pending.forEach((p) => clearTimeout(p.timer))
  pending.clear()
}
