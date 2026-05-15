// @purpose Fire-and-forget WebSocket transport - streams LogEntry events to an external broker (devlogger-viewer).
import type { LogEntry } from './types'
import { getConfig } from './config'

interface TransportState {
  socket: WebSocket | null
  status: 'idle' | 'connecting' | 'open' | 'closed'
  buffer: OutgoingEntry[]
  reconnectAttempt: number
  reconnectTimer: ReturnType<typeof setTimeout> | null
  flushTimer: ReturnType<typeof setTimeout> | null
  warnedNoCtor: boolean
}

interface OutgoingEntry {
  v: 1
  appId: string
  entry: LogEntry
}

const MAX_BUFFER = 500
const FLUSH_MS = 16
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]

const state: TransportState = {
  socket: null,
  status: 'idle',
  buffer: [],
  reconnectAttempt: 0,
  reconnectTimer: null,
  flushTimer: null,
  warnedNoCtor: false,
}

function getWsCtor(): typeof WebSocket | null {
  const g = globalThis as { WebSocket?: typeof WebSocket }
  return typeof g.WebSocket === 'function' ? g.WebSocket : null
}

function getAppId(): string {
  const fromCfg = getConfig().transport.appId
  if (fromCfg && fromCfg.length > 0) return fromCfg

  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  const envName = proc?.env?.npm_package_name
  if (envName && envName.length > 0) return envName

  return 'unknown-app'
}

function connect(): void {
  const cfg = getConfig().transport
  if (!cfg.enabled) return
  if (!cfg.url) return

  const Ctor = getWsCtor()
  if (!Ctor) {
    if (!state.warnedNoCtor) {
      state.warnedNoCtor = true
      // eslint-disable-next-line no-console
      console.warn('[devlogger] transport disabled - no global WebSocket (need Node 22+ or a browser)')
    }
    return
  }

  if (state.status === 'connecting' || state.status === 'open') return

  state.status = 'connecting'
  try {
    const sock = new Ctor(cfg.url)
    state.socket = sock

    sock.addEventListener('open', () => {
      state.status = 'open'
      state.reconnectAttempt = 0
      scheduleFlush()
    })

    sock.addEventListener('close', () => {
      state.status = 'closed'
      state.socket = null
      scheduleReconnect()
    })

    sock.addEventListener('error', () => {
      // close will follow; do not log noisily
      try { sock.close() } catch { /* ignore */ }
    })
  } catch {
    state.status = 'closed'
    state.socket = null
    scheduleReconnect()
  }
}

function scheduleReconnect(): void {
  if (state.reconnectTimer) return
  const delay = RECONNECT_DELAYS[Math.min(state.reconnectAttempt, RECONNECT_DELAYS.length - 1)]
  state.reconnectAttempt += 1
  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null
    connect()
  }, delay)
}

function scheduleFlush(): void {
  if (state.flushTimer) return
  state.flushTimer = setTimeout(() => {
    state.flushTimer = null
    flush()
  }, FLUSH_MS)
}

function flush(): void {
  const sock = state.socket
  if (!sock || state.status !== 'open') return
  if (state.buffer.length === 0) return

  const batch = state.buffer.splice(0, state.buffer.length)
  try {
    sock.send(JSON.stringify({ v: 1, type: 'batch', items: batch }))
  } catch {
    // re-queue on send failure (drop newest if overflow)
    const merged = batch.concat(state.buffer)
    state.buffer = merged.slice(-MAX_BUFFER)
  }
}

/** Public: enqueue a log entry for shipping. Called from notify(). Safe to invoke before connect. */
export function push(entry: LogEntry): void {
  const cfg = getConfig().transport
  if (!cfg.enabled || !cfg.url) return

  const item: OutgoingEntry = { v: 1, appId: getAppId(), entry }

  if (state.buffer.length >= MAX_BUFFER) {
    state.buffer.shift() // drop oldest
  }
  state.buffer.push(item)

  if (state.status === 'idle' || state.status === 'closed') connect()
  if (state.status === 'open') scheduleFlush()
}

/** Public: explicit init - safe to call multiple times; idempotent. */
export function initTransport(): void {
  connect()
}

/** Public: tear down for tests / shutdown. */
export function stopTransport(): void {
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer)
    state.reconnectTimer = null
  }
  if (state.flushTimer) {
    clearTimeout(state.flushTimer)
    state.flushTimer = null
  }
  if (state.socket) {
    try { state.socket.close() } catch { /* ignore */ }
    state.socket = null
  }
  state.status = 'idle'
  state.buffer = []
  state.reconnectAttempt = 0
}

/** Public: state for diagnostics. */
export function transportStatus(): TransportState['status'] {
  return state.status
}
