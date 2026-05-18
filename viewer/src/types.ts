// @purpose Shared types for the viewer - mirrors broker payload contract.
export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'success'

export interface LogEntry {
  level: LogLevel
  scope?: string
  args: unknown[]
  timestamp: number
  count: number
}

export interface StreamItem {
  v: 1
  appId: string
  entry: LogEntry
  /** Broker-assigned monotonic id, used for dedup + resume cursor. Missing on legacy persisted items. */
  id?: number
  /** Wall-clock time at which a replayed item was injected into the live view.
   *  Graph animation timing keys off this so resend re-plays edge packages
   *  identically to fresh traffic; Stream view still shows entry.timestamp. */
  replayedAt?: number
}

export interface BatchMessage {
  v: 1
  type: 'batch'
  items: StreamItem[]
  /** True when this batch is the broker replaying buffered items (resume / Resend button). */
  replayed?: boolean
}
