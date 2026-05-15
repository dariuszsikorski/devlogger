// @purpose Devlogger broker - one WS endpoint for producers (/ingest), one for consumers (/stream), serves static viewer at /.
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import staticPlugin from '@fastify/static'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'

const HOST = process.env.DEVLOGGER_HOST ?? '127.0.0.1'
const PORT = Number(process.env.DEVLOGGER_PORT ?? 9777)
const NO_OPEN = process.env.DEVLOGGER_NO_OPEN === '1'

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

interface IngestMessage {
  v: 1
  type: 'batch'
  items: Array<{ v: 1; appId: string; entry: unknown }>
}

const consumers = new Set<WebSocket>()
let totalRelayed = 0

const app = Fastify({ logger: false })

await app.register(websocket, {
  options: { maxPayload: 1 * 1024 * 1024 },
})

await app.register(staticPlugin, {
  root: join(__dirname, 'public'),
  prefix: '/',
  index: ['index.html'],
})

app.get('/health', async () => ({
  ok: true,
  consumers: consumers.size,
  totalRelayed,
}))

app.get('/ingest', { websocket: true }, (socket /* WebSocket */, _req) => {
  socket.on('message', (raw) => {
    let parsed: IngestMessage | null = null
    try {
      parsed = JSON.parse(raw.toString()) as IngestMessage
    } catch {
      return
    }
    if (!parsed || parsed.type !== 'batch' || !Array.isArray(parsed.items)) return

    totalRelayed += parsed.items.length
    const payload = JSON.stringify({ v: 1, type: 'batch', items: parsed.items })
    for (const c of consumers) {
      try { c.send(payload) } catch { /* ignore */ }
    }
  })

  socket.on('close', () => { /* noop */ })
})

app.get('/stream', { websocket: true }, (socket /* WebSocket */, _req) => {
  consumers.add(socket as unknown as WebSocket)
  try {
    socket.send(JSON.stringify({ v: 1, type: 'hello', totalRelayed }))
  } catch { /* ignore */ }

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
  openBrowser(url)
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[devlogger-viewer] failed to start:', err)
  process.exit(1)
}
