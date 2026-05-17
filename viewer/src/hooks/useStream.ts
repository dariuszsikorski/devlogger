// @purpose WS subscriber - exponential reconnect + visibility/online/watchdog liveness checks
// + resume protocol (sends {type:'resume', sinceId} on every open so reconnects auto-fill gaps).
// Mobile browsers freeze WebSockets on tab hide without firing `close`, leaving zombie sockets.
// We force-reconnect on visibilitychange/online when readyState != OPEN, and a 40s idle watchdog
// tears down silent sockets so the next reconnect actually happens.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { BatchMessage, StreamItem } from '../types'

const IDLE_TIMEOUT_MS = 40_000
const MAX_BACKOFF_MS = 15_000

interface UseStreamOpts {
  getLastSeenId: () => number
}

interface UseStreamResult {
  isConnected: boolean
  /** Ask broker to re-send last REPLAY_DEFAULT items (sinceId=0). Caller should clear local state first. */
  resend: () => void
}

export interface OnBatchOpts {
  /** True when this batch is the broker replaying buffered items (Resend / first connect). */
  isReplay: boolean
}

export function useStream(
  onBatch: (items: StreamItem[], opts: OnBatchOpts) => void,
  opts: UseStreamOpts,
): UseStreamResult {
  const [isConnected, setIsConnected] = useState(false)
  const onBatchRef = useRef(onBatch)
  onBatchRef.current = onBatch
  const getLastSeenIdRef = useRef(opts.getLastSeenId)
  getLastSeenIdRef.current = opts.getLastSeenId
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let reconnectAttempt = 0
    let reconnectTimer: number | null = null
    let idleTimer: number | null = null
    let disposed = false

    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${wsProtocol}//${location.host}/stream`

    function clearTimers() {
      if (reconnectTimer !== null) { window.clearTimeout(reconnectTimer); reconnectTimer = null }
      if (idleTimer !== null) { window.clearTimeout(idleTimer); idleTimer = null }
    }

    function armIdleWatchdog() {
      if (idleTimer !== null) window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => {
        // eslint-disable-next-line no-console
        console.info('[devlogger-viewer] idle watchdog fired, closing socket')
        try { socketRef.current?.close() } catch { /* ignore */ }
      }, IDLE_TIMEOUT_MS)
    }

    function scheduleReconnect() {
      if (disposed) return
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), MAX_BACKOFF_MS)
      reconnectAttempt += 1
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      reconnectTimer = window.setTimeout(connect, delay)
    }

    function forceReconnectNow() {
      if (disposed) return
      clearTimers()
      try { socketRef.current?.close() } catch { /* ignore */ }
      reconnectAttempt = 0
      connect()
    }

    function sendResume(sinceId: number) {
      const s = socketRef.current
      if (s?.readyState !== WebSocket.OPEN) return
      try { s.send(JSON.stringify({ type: 'resume', sinceId })) } catch { /* ignore */ }
    }

    function connect() {
      if (disposed) return
      reconnectTimer = null
      setIsConnected(false)
      const socket = new WebSocket(wsUrl)
      socketRef.current = socket

      socket.addEventListener('open', () => {
        reconnectAttempt = 0
        setIsConnected(true)
        armIdleWatchdog()
        // Ask broker for anything we missed while disconnected (or last REPLAY_DEFAULT on cold open).
        sendResume(getLastSeenIdRef.current())
      })

      socket.addEventListener('close', () => {
        setIsConnected(false)
        if (idleTimer !== null) { window.clearTimeout(idleTimer); idleTimer = null }
        scheduleReconnect()
      })

      socket.addEventListener('error', () => {
        try { socket.close() } catch { /* ignore */ }
      })

      socket.addEventListener('message', (ev) => {
        armIdleWatchdog()
        let parsed: BatchMessage | null = null
        try { parsed = JSON.parse(ev.data as string) as BatchMessage } catch { return }
        const isValidBatch = parsed && parsed.type === 'batch' && Array.isArray(parsed.items)
        if (!isValidBatch) return
        onBatchRef.current(parsed!.items, { isReplay: parsed!.replayed === true })
      })
    }

    function onVisibility() {
      if (document.visibilityState !== 'visible') return
      const isSocketAlive = socketRef.current?.readyState === WebSocket.OPEN
      if (!isSocketAlive) forceReconnectNow()
    }

    function onOnline() {
      forceReconnectNow()
    }

    connect()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onVisibility)

    return () => {
      disposed = true
      clearTimers()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', onVisibility)
      try { socketRef.current?.close() } catch { /* ignore */ }
    }
  }, [])

  const resend = useCallback(() => {
    const s = socketRef.current
    if (s?.readyState !== WebSocket.OPEN) return
    try { s.send(JSON.stringify({ type: 'resume', sinceId: 0 })) } catch { /* ignore */ }
  }, [])

  return { isConnected, resend }
}
