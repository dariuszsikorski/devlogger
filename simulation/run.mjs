// @purpose Sim runner - fires N simulated API requests, counts entries via local subscribe(), and compares with broker totalRelayed.
import {
  configure,
  subscribe,
  transportStatus,
  flushAll,
} from '../logger/dist/index.mjs'
import { handleGetProduct } from './handlers/apiRoute.mjs'

const REQUESTS = Number(process.env.SIM_REQUESTS ?? 10)
const BROKER_URL = process.env.DEVLOGGER_URL ?? 'ws://127.0.0.1:9777/ingest'
const BROKER_HEALTH = BROKER_URL.replace('ws://', 'http://').replace('/ingest', '/health')

configure({
  enabled: true,
  throttleMs: 0,
  transport: {
    enabled: true,
    url: BROKER_URL,
    appId: 'sim-runner',
  },
})

// Local subscriber - proves notify() fires for every log.
const collected = []
const unsubscribe = subscribe((entry) => {
  collected.push({
    level: entry.level,
    scope: entry.scope,
    head: typeof entry.args[0] === 'string' ? entry.args[0] : String(entry.args[0]),
  })
})

async function brokerStart() {
  try {
    const r = await fetch(BROKER_HEALTH)
    return await r.json()
  } catch {
    return null
  }
}

console.log(`[sim] REQUESTS=${REQUESTS} broker=${BROKER_URL}`)
const startHealth = await brokerStart()
if (!startHealth) {
  console.warn('[sim] WARN: broker not reachable at', BROKER_HEALTH)
  console.warn('[sim] -> transport will buffer/reconnect; local subscriber still tested')
} else {
  console.log('[sim] broker reachable. starting totalRelayed =', startHealth.totalRelayed, 'consumers =', startHealth.consumers)
}

// Wait briefly so WS opens before first request.
await new Promise((r) => setTimeout(r, 300))
console.log('[sim] transport status:', transportStatus())

// Fire N requests with staggered start so the viewer sees scrolling activity.
const tasks = []
for (let i = 0; i < REQUESTS; i++) {
  const delay = i * 500
  tasks.push(
    new Promise((resolve) => setTimeout(resolve, delay)).then(() =>
      handleGetProduct({
        params: { id: `SKU-${1000 + i}` },
        headers: { authorization: `Bearer tok-${i.toString().padStart(4, '0')}` },
      }),
    ),
  )
}

const results = await Promise.allSettled(tasks)
const ok = results.filter((r) => r.status === 'fulfilled').length
const fail = results.length - ok
console.log(`[sim] requests done: ok=${ok} failed=${fail}`)

// Force-flush throttle batches (no-op since throttleMs=0, but safe).
flushAll(() => { /* noop emit */ })

// Give the WS time to ship the final batch.
await new Promise((r) => setTimeout(r, 600))

const endHealth = await brokerStart()
const relayedDelta = endHealth && startHealth
  ? endHealth.totalRelayed - startHealth.totalRelayed
  : null

unsubscribe()

console.log('\n=== verification ===')
console.log('local subscriber received :', collected.length, 'entries')
console.log('broker relayed (delta)    :', relayedDelta ?? '(broker unavailable)')

const byScope = {}
for (const e of collected) {
  const key = e.scope ?? '(unscoped)'
  byScope[key] = (byScope[key] ?? 0) + 1
}
console.log('per-scope counts          :', byScope)

const byLevel = {}
for (const e of collected) {
  byLevel[e.level] = (byLevel[e.level] ?? 0) + 1
}
console.log('per-level counts          :', byLevel)

const localOk = collected.length > 0
const brokerOk = relayedDelta === null ? null : relayedDelta === collected.length

console.log('\n=== results ===')
console.log('local subscribe()         :', localOk ? 'PASS' : 'FAIL')
console.log('broker relay parity       :', brokerOk === null ? 'SKIPPED (no broker)' : (brokerOk ? 'PASS' : `FAIL (broker=${relayedDelta}, local=${collected.length})`))

// Hard-exit via SIGINT-style after a short delay so the WS handle drains cleanly on Windows.
const exitCode = localOk && brokerOk !== false ? 0 : 1
setTimeout(() => process.exit(exitCode), 200).unref()
