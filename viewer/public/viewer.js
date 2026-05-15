// @purpose Minimal viewer - subscribes to /stream, renders entries as scrolling list with filters.

const els = {
  status: document.getElementById('status'),
  count: document.getElementById('count'),
  clear: document.getElementById('clear'),
  stream: document.getElementById('stream'),
  search: document.getElementById('search'),
  appFilter: document.getElementById('appFilter'),
  levelFilter: document.getElementById('levelFilter'),
}

const MAX_ENTRIES = 2000
const entries = []
const apps = new Set()

const wsUrl = `ws://${location.host}/stream`
let socket = null
let reconnectAttempt = 0

function setStatus(connected) {
  els.status.textContent = connected ? 'connected' : 'disconnected'
  els.status.className = 'Header_status ' + (connected ? 'is-connected' : 'is-disconnected')
}

function connect() {
  setStatus(false)
  socket = new WebSocket(wsUrl)

  socket.addEventListener('open', () => {
    reconnectAttempt = 0
    setStatus(true)
  })

  socket.addEventListener('close', () => {
    setStatus(false)
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 15000)
    reconnectAttempt += 1
    setTimeout(connect, delay)
  })

  socket.addEventListener('message', (ev) => {
    let msg = null
    try { msg = JSON.parse(ev.data) } catch { return }
    if (!msg || msg.type !== 'batch' || !Array.isArray(msg.items)) return
    for (const item of msg.items) ingest(item)
    render()
  })
}

function ingest(item) {
  entries.push(item)
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
  if (item.appId && !apps.has(item.appId)) {
    apps.add(item.appId)
    refreshAppFilter()
  }
}

function refreshAppFilter() {
  const current = els.appFilter.value
  els.appFilter.innerHTML = '<option value="">all apps</option>' +
    [...apps].sort().map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('')
  els.appFilter.value = current
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

function formatArgs(args) {
  return args.map((a) => {
    if (typeof a === 'string') return a
    try { return JSON.stringify(a) } catch { return String(a) }
  }).join(' ')
}

function passesFilter(item) {
  const lvl = els.levelFilter.value
  if (lvl && item.entry.level !== lvl) return false
  const app = els.appFilter.value
  if (app && item.appId !== app) return false
  const q = els.search.value.trim().toLowerCase()
  if (!q) return true
  const hay = `${item.appId} ${item.entry.scope ?? ''} ${formatArgs(item.entry.args)}`.toLowerCase()
  return hay.includes(q)
}

function render() {
  const visible = entries.filter(passesFilter)
  els.count.textContent = `${visible.length} / ${entries.length} entries`

  // simple full re-render (cheap enough for 2k rows)
  const html = visible.map((item) => {
    const e = item.entry
    const cls = `Entry is-${e.level}`
    const scope = e.scope ? `<span class="Entry_app_scope">[${escapeHtml(e.scope)}]</span>` : ''
    const countTag = e.count > 1 ? `<span class="Entry_count">(x${e.count})</span>` : ''
    return `<div class="${cls}">
      <span class="Entry_time">${formatTime(e.timestamp)}</span>
      <span class="Entry_level">${e.level}</span>
      <span class="Entry_app">${escapeHtml(item.appId)}${scope}</span>
      <span class="Entry_body">${escapeHtml(formatArgs(e.args))}${countTag}</span>
    </div>`
  }).join('')

  const wasNearBottom = els.stream.scrollTop + els.stream.clientHeight >= els.stream.scrollHeight - 50
  els.stream.innerHTML = html
  if (wasNearBottom) els.stream.scrollTop = els.stream.scrollHeight
}

els.clear.addEventListener('click', () => { entries.length = 0; render() })
els.search.addEventListener('input', render)
els.appFilter.addEventListener('change', render)
els.levelFilter.addEventListener('change', render)

connect()
