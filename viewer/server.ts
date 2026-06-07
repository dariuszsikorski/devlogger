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

// Detect EADDRINUSE robustly. Different Node/Fastify versions surface it as a
// bare error with .code, a wrapped error with .cause.code, or (worst case) only
// in the message string - so we check all three. Anything addr-in-use must take
// the recovery path, never the hard-exit path.
function isAddrInUse(err: unknown): boolean {
  if (!err) return false
  const e = err as { code?: string; cause?: { code?: string }; message?: string }
  if (e.code === 'EADDRINUSE') return true
  if (e.cause?.code === 'EADDRINUSE') return true
  return /EADDRINUSE/.test(String(e.message ?? err))
}

// Probe whether the occupant of host:port is ALREADY a devlogger broker.
// /health returns a fixed shape ({ ok, consumers, bufferCap, ... }) that no
// other service would mimic, so we use it as the identity check. Retries a few
// times because a sibling broker that just grabbed the port may still be
// finishing startup (static plugin etc.) when we first probe.
async function isDevloggerBrokerAt(host: string, port: number): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`http://${host}:${port}/health`, { signal: AbortSignal.timeout(800) })
      if (res.ok) {
        const body = await res.json().catch(() => null) as { ok?: boolean; bufferCap?: unknown } | null
        if (body && body.ok === true && 'bufferCap' in body) return true
      }
    } catch {
      // fetch unavailable (very old node) or connection refused mid-startup
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 300))
  }
  return false
}

// The broker is a SINGLETON on a well-known port: producers connect to
// ws://HOST:PORT/ingest, the viewer page is served from HOST:PORT and connects
// back to /stream on its own origin. So the port must be DETERMINISTIC - moving
// to a random port would orphan every producer (they still target PORT) and
// break the viewer (its page lives on PORT). Bind logic:
//   1. Try the preferred port (DEVLOGGER_PORT / 9777).
//   2. Busy AND already a devlogger broker -> reuse it, exit 0 (no duplicate,
//      no crash). This is the normal case when the panel already spawned one.
//   3. Busy with a FOREIGN process -> we cannot honour the contract from any
//      other port, so report exactly what to do and exit. We never silently
//      relocate, because that is what made the viewer stop connecting.
async function startBroker(): Promise<void> {
  try {
    await app.listen({ host: HOST, port: PORT })
  } catch (err) {
    if (!isAddrInUse(err)) {
      // eslint-disable-next-line no-console
      console.error('[devlogger-viewer] failed to start:', err)
      process.exit(1)
    }
    if (await isDevloggerBrokerAt(HOST, PORT)) {
      const url = `http://${HOST}:${PORT}`
      // eslint-disable-next-line no-console
      console.log(`[devlogger-viewer] a devlogger broker is already running at ${url} - reusing it, not starting a second instance.`)
      openBrowser(url)
      try { await app.close() } catch { /* ignore */ }
      process.exit(0)
    }
    // eslint-disable-next-line no-console
    console.error(`[devlogger-viewer] port ${PORT} is held by a NON-devlogger process. The broker must use this exact port so producers (ws://${HOST}:${PORT}/ingest) and the viewer can reach it - it will NOT move to a random port.`)
    // eslint-disable-next-line no-console
    console.error(`[devlogger-viewer] free it:  lsof -nP -iTCP:${PORT} -sTCP:LISTEN   (then kill the PID)`)
    // eslint-disable-next-line no-console
    console.error(`[devlogger-viewer] or pick another port for the WHOLE stack:  DEVLOGGER_PORT=<port> (producers + viewer must use the same value).`)
    process.exit(1)
  }

  const url = `http://${HOST}:${PORT}`
  // eslint-disable-next-line no-console
  console.log(`[devlogger-viewer] listening ${url}`)
  // eslint-disable-next-line no-console
  console.log(`[devlogger-viewer] producers connect to ws://${HOST}:${PORT}/ingest`)
  // eslint-disable-next-line no-console
  console.log(`[devlogger-viewer] ring buffer cap=${BUFFER_CAP}, default replay=${REPLAY_DEFAULT}`)
  openBrowser(url)
}

await startBroker()
