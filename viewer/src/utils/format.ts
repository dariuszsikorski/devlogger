// @purpose Display helpers - timestamp and args formatting.
export function formatTime(ts: number): string {
  const d = new Date(ts)
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${d.toTimeString().slice(0, 8)}.${ms}`
}

export function formatArgs(args: unknown[]): string {
  return args.map((a) => {
    if (typeof a === 'string') return a
    try { return JSON.stringify(a) } catch { return String(a) }
  }).join(' ')
}

/** Compact human-readable gap label (e.g. "5.2s", "1m 12s", "1h 03m"). */
export function formatGap(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`
  const m = Math.floor(s / 60)
  const remS = Math.floor(s - m * 60)
  if (m < 60) return `${m}m ${String(remS).padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  const remM = m - h * 60
  return `${h}h ${String(remM).padStart(2, '0')}m`
}
