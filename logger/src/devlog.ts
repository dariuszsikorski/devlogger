// @purpose Main factory. createDevLog([scope]) returns a callable logger with console-like methods plus exec().
import type { ExecCall, ExecCallNoFn, ExecCallWithFn, LogLevel } from './types'
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
  success: (...args: unknown[]) => void
  group: (label?: unknown) => void
  groupEnd: () => void
  // With `fn`: returns fn's value (exec returns fn's result or throws).
  // Without `fn`: returns undefined.
  exec<TArgs extends unknown[], TReturn>(call: ExecCallWithFn<TArgs, TReturn>): TReturn
  exec<TArgs extends unknown[]>(call: ExecCallNoFn<TArgs>): undefined
  mute: () => void
  unmute: () => void
  readonly scope: string | null

  /** Native console.table, forwarded as-is. Honors `enabled` and scope mute. */
  table: (tabularData?: unknown, properties?: readonly string[]) => void
  /** Native console.dir, forwarded as-is. */
  dir: (item?: unknown, options?: unknown) => void
  /** Native console.trace, forwarded as-is. */
  trace: (...args: unknown[]) => void
  /** Native console.assert, forwarded as-is. Prints only when condition is falsy. */
  assert: (condition?: boolean, ...args: unknown[]) => void
  /** Native console.time, forwarded as-is. */
  time: (label?: string) => void
  /** Native console.timeEnd, forwarded as-is. */
  timeEnd: (label?: string) => void
  /** Native console.timeLog, forwarded as-is. */
  timeLog: (label?: string, ...data: unknown[]) => void
  /** Native console.count, forwarded as-is. */
  count: (label?: string) => void
  /** Native console.countReset, forwarded as-is. */
  countReset: (label?: string) => void
  /**
   * Full terminal wipe: clears the visible screen, scrollback buffer, and homes
   * the cursor (ANSI 2J + 3J + H). Falls back to native console.clear() in
   * non-TTY environments (pipes, CI, browser). Respects `enabled` and scope mute.
   */
  clear: () => void
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
  callable.success = (...args) => record('success', scopeName, args, emit)

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

  const execImpl = <TArgs extends unknown[], TReturn>(call: ExecCall<TArgs, TReturn>): TReturn | undefined => {
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
  callable.exec = execImpl as DevLog['exec']

  callable.mute = () => {
    if (scopeName) muteScope(scopeName)
  }

  callable.unmute = () => {
    if (scopeName) unmuteScope(scopeName)
  }

  // Passthrough for the rest of the console surface.
  // These respect `enabled` and per-scope mute so silencing a scope hides
  // every output from it, but they do NOT receive the [Scope] prefix or
  // throttle - they keep native console semantics (timer labels, table
  // rendering, assertion behavior etc.).
  const passthrough = (method: keyof Console) => {
    return (...args: unknown[]): void => {
      if (!isEnabled()) return
      if (isScopeMuted(scopeName)) return
      const consoleAny = console as unknown as Record<string, (...a: unknown[]) => void>
      const fn = consoleAny[method as string]
      if (typeof fn === 'function') fn.apply(console, args)
    }
  }

  callable.table = passthrough('table') as DevLog['table']
  callable.dir = passthrough('dir') as DevLog['dir']
  callable.trace = passthrough('trace') as DevLog['trace']
  callable.assert = passthrough('assert') as DevLog['assert']
  callable.time = passthrough('time') as DevLog['time']
  callable.timeEnd = passthrough('timeEnd') as DevLog['timeEnd']
  callable.timeLog = passthrough('timeLog') as DevLog['timeLog']
  callable.count = passthrough('count') as DevLog['count']
  callable.countReset = passthrough('countReset') as DevLog['countReset']

  // clear() is the only console.* method we override instead of forwarding.
  // Why: console.clear() only wipes the visible area in most terminals; users running
  // pipeline scripts expect scrollback to be wiped too (same behavior `cls`/`clear`
  // give from a shell). We send ANSI 2J (clear screen) + 3J (clear scrollback)
  // + H (home cursor). Non-TTY environments (pipes, CI, browser) fall back to
  // native console.clear() so behavior stays sane there.
  callable.clear = (): void => {
    if (!isEnabled()) return
    if (isScopeMuted(scopeName)) return
    const out = (process as unknown as { stdout?: { isTTY?: boolean; write?: (s: string) => void } })?.stdout
    if (out?.isTTY && typeof out.write === 'function') {
      out.write('\x1B[2J\x1B[3J\x1B[H')
      return
    }
    if (typeof console.clear === 'function') console.clear()
  }

  Object.defineProperty(callable, 'scope', {
    value: scopeName,
    writable: false,
    enumerable: true,
  })

  return callable
}
