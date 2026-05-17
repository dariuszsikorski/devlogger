// @purpose Devlogger broker - one WS endpoint for producers (/ingest), one for consumers (/stream),
// serves static viewer at /. Keeps a ring buffer of recent items so reconnecting consumers can resume
// (send {type:'resume', sinceId?}) and viewers can manually replay (send {type:'resume', sinceId: 0}).
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import staticPlugin from '@fastify/static'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

const HOST = process.env.DEVLOGGER_HOST ?? '127.0.0.1'
const PORT = Number(process.env.DEVLOGGER_PORT ?? 9777)
const NO_OPEN = process.env.DEVLOGGER_NO_OPEN === '1'
const BUFFER_CAP = Number(process.env.DEVLOGGER_BUFFER_CAP ?? 500)
const REPLAY_DEFAULT = Number(process.env.DEVLOGGER_REPLAY_DEFAULT ?? 200)

function openBrowser(url: string): void {
  if (NO_OPEN) return
  const platform = process.platform
  try {
    if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref()
    } else if (platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
    }
  } catch {
    // best-effort; ignore
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))

interface BufferedItem {
  v: 1
  appId: string
  entry: unknown
  id: number
}

interface IngestMessage {
  v: 1
  type: 'batch'
  items: Array<{ v: 1; appId: string; entry: unknown }>
}

interface ConsumerMessage {
  type?: string
  sinceId?: number | null
}

const consumers = new Set<WebSocket>()
const buffer: BufferedItem[] = []
let nextId = 0
let totalRelayed = 0

const app = Fastify({ logger: false })

await app.register(websocket, {
  options: { maxPayload: 1 * 1024 * 1024 },
})

const distDir = join(__dirname, 'dist')
if (!existsSync(distDir)) {
  // eslint-disable-next-line no-console
  console.error('[devlogger-viewer] viewer/dist missing. Run: pnpm viewer:build')
  process.exit(1)
}

await app.register(staticPlugin, {
  root: distDir,
  prefix: '/',
  index: ['index.html'],
})

app.get('/health', async () => ({
  ok: true,
  consumers: consumers.size,
  totalRelayed,
  buffered: buffer.length,
  bufferCap: BUFFER_CAP,
  oldestId: buffer.length > 0 ? buffer[0].id : null,
  newestId: nextId,
}))

function handleResumeRequest(socket: WebSocket, sinceIdRaw: number | null | undefined): void {
  const hasCursor = typeof sinceIdRaw === 'number' && sinceIdRaw > 0
  const toSend = hasCursor
    ? buffer.filter((it) => it.id > (sinceIdRaw as number))
    : buffer.slice(-REPLAY_DEFAULT)
  if (toSend.length === 0) return
  try {
    socket.send(JSON.stringify({ v: 1, type: 'batch', items: toSend, replayed: true }))
  } catch { /* ignore */ }
}

app.get('/ingest', { websocket: true }, (socket /* WebSocket */, _req) => {
  socket.on('message', (raw) => {
    let parsed: IngestMessage | null = null
    try { parsed = JSON.parse(raw.toString()) as IngestMessage } catch { return }
    if (!parsed || parsed.type !== 'batch' || !Array.isArray(parsed.items)) return

    const stamped: BufferedItem[] = []
    for (const raw of parsed.items) {
      const item: BufferedItem = {
        v: 1,
        appId: raw.appId,
        entry: raw.entry,
        id: ++nextId,
      }
      buffer.push(item)
      if (buffer.length > BUFFER_CAP) buffer.shift()
      stamped.push(item)
    }
    totalRelayed += stamped.length
    const payload = JSON.stringify({ v: 1, type: 'batch', items: stamped })
    for (const c of consumers) {
      try { c.send(payload) } catch { /* ignore */ }
    }
  })

  socket.on('close', () => { /* noop */ })
})

app.get('/stream', { websocket: true }, (socket /* WebSocket */, _req) => {
  consumers.add(socket as unknown as WebSocket)
  try {
    socket.send(JSON.stringify({ v: 1, type: 'hello', totalRelayed, bufferedNewestId: nextId }))
  } catch { /* ignore */ }

  socket.on('message', (raw) => {
    let msg: ConsumerMessage | null = null
    try { msg = JSON.parse(raw.toString()) as ConsumerMessage } catch { return }
    if (!msg || msg.type !== 'resume') return
    handleResumeRequest(socket as unknown as WebSocket, msg.sinceId ?? null)
  })

  socket.on('close', () => {
    consumers.delete(socket as unknown as WebSocket)
  })
})

try {
  await app.listen({ host: HOST, port: PORT })
  const url = `http://${HOST}:${PORT}`
  // eslint-disable-next-line no-console
  console.log(`[devlogger-viewer] listening ${url}`)
  // eslint-disable-next-line no-console
  console.log(`[devlogger-viewer] producers connect to ws://${HOST}:${PORT}/ingest`)
  // eslint-disable-next-line no-console
  console.log(`[devlogger-viewer] ring buffer cap=${BUFFER_CAP}, default replay=${REPLAY_DEFAULT}`)
  openBrowser(url)
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[devlogger-viewer] failed to start:', err)
  process.exit(1)
}
