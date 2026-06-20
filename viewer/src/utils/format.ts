// @purpose Display helpers - timestamp and args formatting.
export function formatTime(ts: number): string {
  const d = new Date(ts)
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${d.toTimeString().slice(0, 8)}.${ms}`
}

// Render a value as compact, readable text instead of raw JSON. Top-level objects
// become flat `key=value` pairs (no braces/quotes); nested ones get `{...}`. Depth
// is capped so deep/circular structures can't blow up the inline row - the full
// object is still available in the detail dialog's JsonTree on click.
export function formatValue(v: unknown, depth: number): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  const t = typeof v
  if (t === 'string') return v as string
  if (t === 'number' || t === 'boolean' || t === 'bigint') return String(v)
  if (t === 'function') return 'fn'
  if (Array.isArray(v)) {
    if (depth >= 2) return '[...]'
    return '[' + v.map((x) => formatValue(x, depth + 1)).join(', ') + ']'
  }
  if (t === 'object') {
    if (depth >= 2) return '{...}'
    const obj = v as Record<string, unknown>
    const inner = Object.keys(obj).map((k) => `${k}=${formatValue(obj[k], depth + 1)}`).join(' ')
    return depth === 0 ? inner : `{${inner}}`
  }
  return String(v)
}

export function formatArgs(args: unknown[]): string {
  return args.map((a) => {
    if (typeof a === 'string') return a
    try { return formatValue(a, 0) } catch { return String(a) }
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
