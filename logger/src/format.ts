// @purpose Build the prefix string for a log line - scope tag and optional emoji.
import type { LogLevel } from './types'
import { getConfig } from './config'

const EMOJI: Record<LogLevel, string> = {
  log: '[log]',
  info: '[info]',
  warn: '[warn]',
  error: '[error]',
  debug: '[debug]',
  success: '[success]',
}

/**
 * Build the leading tokens prepended to console output.
 * Returns an array of args so values keep their native console formatting
 * (objects stay inspectable, not stringified).
 */
export function buildPrefix(level: LogLevel, scope: string | null): unknown[] {
  const cfg = getConfig()
  const tokens: string[] = []
  if (cfg.emoji) tokens.push(EMOJI[level])
  if (scope && cfg.showScope) tokens.push(`[${scope}]`)
  return tokens.length > 0 ? [tokens.join(' ')] : []
}

/**
 * Cheap, structural hash of args used for throttle keying.
 * Same shape (same first string, same object key sets, same primitive types) -> same key.
 * Differs from JSON.stringify in that values inside objects can change without changing the hash.
 */
export function shapeKey(args: unknown[]): string {
  if (args.length === 0) return '<empty>'
  return args.map(shapeOf).join('|')
}

function shapeOf(arg: unknown): string {
  if (arg === null) return 'null'
  if (arg === undefined) return 'undefined'
  const t = typeof arg
  if (t === 'string') return `s:${arg as string}`
  if (t === 'number') return 'n'
  if (t === 'boolean') return 'b'
  if (t === 'function') return 'fn'
  if (Array.isArray(arg)) return `a:${arg.length}`
  if (t === 'object') {
    try {
      const keys = Object.keys(arg as Record<string, unknown>).sort()
      return `o:{${keys.join(',')}}`
    } catch {
      return 'o:?'
    }
  }
  return t
}
