// @purpose Main factory. createDevLog([scope]) returns a callable logger with console-like methods plus exec().
import type { ExecCall, LogLevel } from './types'
import { isEnabled } from './config'
import { isLevelMuted, isScopeMuted, muteScope, unmuteScope } from './mute'
import { buildPrefix } from './format'
import { record } from './throttle'
import { execCall } from './exec'

export interface DevLog {
  (...args: unknown[]): void
  log: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
  group: (label?: unknown) => void
  groupEnd: () => void
  exec: <TArgs extends unknown[], TReturn>(call: ExecCall<TArgs, TReturn>) => TReturn | undefined
  mute: () => void
  unmute: () => void
  readonly scope: string | null
}

/**
 * Create a logger scoped to `scope` (or unscoped when omitted).
 * The returned value is both callable and has methods - calling it with no method
 * is equivalent to calling `.log()`.
 */
export function createDevLog(scope?: string | null): DevLog {
  const scopeName = scope ?? null

  const emit = (level: LogLevel, sc: string | null, args: unknown[], suffix?: string): void => {
    if (!isEnabled()) return
    if (isScopeMuted(sc)) return
    if (isLevelMuted(level)) return
    const prefix = buildPrefix(level, sc)
    const final = suffix ? [...prefix, ...args, suffix] : [...prefix, ...args]
    // Route to the matching console method so DevTools color-codes correctly.
    // Falls back to console.log when an environment lacks a specific method.
    const consoleAny = console as unknown as Record<string, (...a: unknown[]) => void>
    const target: (...a: unknown[]) => void =
      typeof consoleAny[level] === 'function' ? consoleAny[level] : console.log
    target(...final)
  }

  const callable = ((...args: unknown[]): void => {
    record('log', scopeName, args, emit)
  }) as DevLog

  callable.log = (...args) => record('log', scopeName, args, emit)
  callable.info = (...args) => record('info', scopeName, args, emit)
  callable.warn = (...args) => record('warn', scopeName, args, emit)
  callable.error = (...args) => record('error', scopeName, args, emit)
  callable.debug = (...args) => record('debug', scopeName, args, emit)

  callable.group = (label?: unknown) => {
    if (!isEnabled() || isScopeMuted(scopeName)) return
    const prefix = buildPrefix('log', scopeName)
    if (label !== undefined) console.group(...prefix, label)
    else console.group(...prefix)
  }

  callable.groupEnd = () => {
    if (!isEnabled() || isScopeMuted(scopeName)) return
    console.groupEnd()
  }

  callable.exec = <TArgs extends unknown[], TReturn>(call: ExecCall<TArgs, TReturn>) => {
    if (!isEnabled()) {
      // still execute the wrapped fn so program flow is unchanged
      if (typeof call.fn === 'function') {
        const fnArgs = (Array.isArray(call.args) ? call.args : []) as TArgs
        return call.ctx !== undefined ? call.fn.apply(call.ctx, fnArgs) : call.fn(...fnArgs)
      }
      return undefined
    }
    return execCall(call, scopeName, emit)
  }

  callable.mute = () => {
    if (scopeName) muteScope(scopeName)
  }

  callable.unmute = () => {
    if (scopeName) unmuteScope(scopeName)
  }

  Object.defineProperty(callable, 'scope', {
    value: scopeName,
    writable: false,
    enumerable: true,
  })

  return callable
}
