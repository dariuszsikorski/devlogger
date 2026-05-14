// @purpose Shared type definitions for the entire devlogger surface.

export type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug'

export interface LogEntry {
  level: LogLevel
  scope: string | null
  args: unknown[]
  timestamp: number
  /** Number of times this entry was emitted within the throttle window. 1 for first emission. */
  count: number
}

export type ExecField = 'by' | 'target' | 'args' | 'msg'

export interface ExecCall<TArgs extends unknown[] = unknown[], TReturn = unknown> {
  /** Caller name (who is calling). */
  by?: string
  /** Target function/method name (what is being called). */
  target?: string
  /** Optional inline args to display. */
  args?: TArgs | Record<string, unknown>
  /** Optional short message. */
  msg?: string
  /** Optional function to execute under logging. Return value is returned through. */
  fn?: (...args: TArgs) => TReturn
  /** Optional `this` context for fn.apply. */
  ctx?: unknown
}

export interface Config {
  /** When false, all output is suppressed. Auto-detected by default. */
  enabled: boolean
  /** Throttle window in ms. 0 disables throttling entirely. */
  throttleMs: number
  /** When true, prefix each log line with a level emoji. */
  emoji: boolean
  /** When true (default), prefix each log line with the registered scope `[Scope]`. */
  showScope: boolean
  /** Which fields exec() refuses to log without. */
  exec: { required: ExecField[] }
  /** Scopes that are globally silenced. */
  mutedScopes: Set<string>
  /** Levels that are globally silenced. */
  mutedLevels: Set<LogLevel>
}

export type Listener = (entry: LogEntry) => void
