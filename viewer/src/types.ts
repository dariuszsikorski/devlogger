// @purpose Shared types for the viewer - mirrors broker payload contract.
export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

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
}

export interface BatchMessage {
  v: 1
  type: 'batch'
  items: StreamItem[]
}
