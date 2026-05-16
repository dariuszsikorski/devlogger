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
