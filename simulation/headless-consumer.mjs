// @purpose Headless consumer - mimics the browser viewer; subscribes to /stream, counts received entries, writes summary.
import fs from 'node:fs'

const url = process.env.STREAM_URL ?? 'ws://127.0.0.1:9777/stream'
const reportPath = process.env.REPORT_PATH ?? 'simulation/consumer.report.json'
const lifeMs = Number(process.env.LIFE_MS ?? 8000)

const ws = new WebSocket(url)

let helloRelayedAtStart = null
let entriesReceived = 0
const byScope = {}
const byLevel = {}
const byAppId = {}

ws.addEventListener('open', () => {
  process.stdout.write('[consumer] connected\n')
})

ws.addEventListener('message', (ev) => {
  let msg = null
  try { msg = JSON.parse(ev.data) } catch { return }
  if (msg.type === 'hello') {
    helloRelayedAtStart = msg.totalRelayed
    return
  }
  if (msg.type === 'batch' && Array.isArray(msg.items)) {
    for (const item of msg.items) {
      entriesReceived += 1
      const sc = item.entry.scope ?? '(none)'
      byScope[sc] = (byScope[sc] ?? 0) + 1
      byLevel[item.entry.level] = (byLevel[item.entry.level] ?? 0) + 1
      byAppId[item.appId] = (byAppId[item.appId] ?? 0) + 1
    }
  }
})

ws.addEventListener('close', () => {
  process.stdout.write('[consumer] socket closed\n')
})

setTimeout(() => {
  const report = {
    url,
    lifeMs,
    helloRelayedAtStart,
    entriesReceived,
    byScope,
    byLevel,
    byAppId,
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  process.stdout.write(`[consumer] wrote ${reportPath} (received=${entriesReceived})\n`)
  try { ws.close() } catch { /* ignore */ }
  setTimeout(() => process.exit(0), 100).unref()
}, lifeMs).unref()
