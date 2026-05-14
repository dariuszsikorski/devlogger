// @purpose exec() - log a call with required-field enforcement, optionally execute the wrapped fn.
import type { ExecCall, ExecField, LogLevel } from './types'
import { getConfig } from './config'
import { record } from './throttle'

type Emit = (level: LogLevel, scope: string | null, args: unknown[], suffix?: string) => void

/**
 * Log a call descriptor with enforcement of fields listed in `config.exec.required`.
 *
 * Behavior:
 *   - Validates required fields. If any are missing, emits a console.error
 *     explaining which fields are missing, skips the log, and (when no fn is
 *     provided) returns undefined. When a fn is provided, it is still executed
 *     so app flow does not break.
 *   - When valid, formats as `by -> target | msg { ...args }` and routes through
 *     the throttle pipeline like any other log.
 *   - When a fn is supplied, it is called with the args array (or with no args
 *     if args is an object), and the return value is returned through.
 *   - Exceptions from fn are logged as console.error and re-thrown.
 */
export function execCall<TArgs extends unknown[], TReturn>(
  call: ExecCall<TArgs, TReturn>,
  scope: string | null,
  emit: Emit,
): TReturn | undefined {
  const required = getConfig().exec.required
  const missing = findMissing(call, required)
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[devlogger]${scope ? ` [${scope}]` : ''} exec() missing required field(s): ${missing.join(', ')}`,
    )
    if (typeof call.fn !== 'function') return undefined
    // fall through to execute fn anyway so host code keeps running
  } else {
    const args = describe(call)
    record('log', scope, args, emit)
  }

  if (typeof call.fn !== 'function') return undefined

  const fnArgs: TArgs = Array.isArray(call.args) ? (call.args as TArgs) : ([] as unknown as TArgs)
  try {
    return call.ctx !== undefined
      ? call.fn.apply(call.ctx, fnArgs)
      : call.fn(...fnArgs)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    // eslint-disable-next-line no-console
    console.error(
      `[devlogger]${scope ? ` [${scope}]` : ''} exec() ${call.target ?? 'anonymous'} threw: ${errorMsg}`,
    )
    throw err
  }
}

function findMissing(call: ExecCall, required: ExecField[]): ExecField[] {
  if (required.length === 0) return []
  const missing: ExecField[] = []
  for (const field of required) {
    const value = call[field]
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.length === 0) ||
      (Array.isArray(value) && value.length === 0)
    if (isEmpty) missing.push(field)
  }
  return missing
}

function describe(call: ExecCall): unknown[] {
  const parts: string[] = []
  if (call.by) parts.push(`${call.by} ->`)
  if (call.target) parts.push(call.target)
  if (call.msg) parts.push(`| ${call.msg}`)
  const header = parts.join(' ').trim() || '<exec>'
  return call.args !== undefined ? [header, call.args] : [header]
}
