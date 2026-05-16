// @purpose WS subscriber - exponential reconnect, batches forwarded to caller.
import { useEffect, useRef, useState } from 'react'
import type { BatchMessage, StreamItem } from '../types'

export function useStream(onBatch: (items: StreamItem[]) => void) {
  const [isConnected, setIsConnected] = useState(false)
  const onBatchRef = useRef(onBatch)
  onBatchRef.current = onBatch

  useEffect(() => {
    let socket: WebSocket | null = null
    let reconnectAttempt = 0
    let reconnectTimer: number | null = null
    let disposed = false

    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${wsProtocol}//${location.host}/stream`

    function connect() {
      if (disposed) return
      setIsConnected(false)
      socket = new WebSocket(wsUrl)

      socket.addEventListener('open', () => {
        reconnectAttempt = 0
        setIsConnected(true)
      })

      socket.addEventListener('close', () => {
        setIsConnected(false)
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 15000)
        reconnectAttempt += 1
        reconnectTimer = window.setTimeout(connect, delay)
      })

      socket.addEventListener('message', (ev) => {
        let parsed: BatchMessage | null = null
        try { parsed = JSON.parse(ev.data as string) as BatchMessage } catch { return }
        const isValidBatch = parsed && parsed.type === 'batch' && Array.isArray(parsed.items)
        if (!isValidBatch) return
        onBatchRef.current(parsed!.items)
      })
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      try { socket?.close() } catch { /* ignore */ }
    }
  }, [])

  return { isConnected }
}
