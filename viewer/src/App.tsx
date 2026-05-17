// @purpose Root - holds entry buffer + filter state, switches between Stream and Graph views.
// Entries are persisted to IndexedDB so a tab cold-kill or reload restores the live view.
// Heartbeat detects suspension gaps - on a long gap we soft-reset (live events only, no replay).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Header } from './components/Header'
import { Filters } from './components/Filters'
import { Stream } from './components/Stream'
import { Graph } from './components/Graph'
import { GapNotice } from './components/GapNotice'
import { useStream } from './hooks/useStream'
import { useHeartbeat } from './hooks/useHeartbeat'
import { useViewportClass } from './hooks/useViewportClass'
import { useSemanticColors } from './useSemanticColors'
import { formatArgs } from './utils/format'
import { clearEntries, getAllEntries, putEntries } from './storage/entriesDb'
import type { ViewKey } from './components/ViewSwitch'
import type { StreamItem } from './types'

const MAX_ENTRIES = 2000
const LAST_SEEN_ID_KEY = 'devlogger:lastSeenId'

function readPersistedLastSeenId(): number {
  try { return Number(localStorage.getItem(LAST_SEEN_ID_KEY) ?? 0) || 0 } catch { return 0 }
}

export function App() {
  useSemanticColors()
  useViewportClass()

  const [entries, setEntries] = useState<StreamItem[]>([])
  const [apps, setApps] = useState<string[]>([])

  const lastSeenIdRef = useRef<number>(readPersistedLastSeenId())
  const seenIdsRef = useRef<Set<number>>(new Set())
  const replayTimersRef = useRef<number[]>([])

  const [search, setSearch] = useState('')
  const [appFilter, setAppFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [view, setView] = useState<ViewKey>('stream')

  const [gapMs, setGapMs] = useState<number | null>(null)
  const [gapLastBeatAt, setGapLastBeatAt] = useState<number | null>(null)

  const injectItems = useCallback((fresh: StreamItem[]) => {
    if (fresh.length === 0) return
    setEntries((prev) => {
      const next = prev.concat(fresh)
      if (next.length > MAX_ENTRIES) next.splice(0, next.length - MAX_ENTRIES)
      return next
    })
    setApps((prev) => {
      const seen = new Set(prev)
      let changed = false
      for (const item of fresh) {
        if (item.appId && !seen.has(item.appId)) { seen.add(item.appId); changed = true }
      }
      return changed ? [...seen].sort() : prev
    })
    void putEntries(fresh)
  }, [])

  const onBatch = useCallback((items: StreamItem[], opts: { isReplay: boolean }) => {
    // Dedup by broker-assigned id. Legacy items without id pass through unchanged.
    const fresh: StreamItem[] = []
    for (const it of items) {
      if (it.id == null) { fresh.push(it); continue }
      if (seenIdsRef.current.has(it.id)) continue
      seenIdsRef.current.add(it.id)
      if (it.id > lastSeenIdRef.current) lastSeenIdRef.current = it.id
      fresh.push(it)
    }
    if (fresh.length === 0) return
    try { localStorage.setItem(LAST_SEEN_ID_KEY, String(lastSeenIdRef.current)) } catch { /* ignore */ }

    if (!opts.isReplay) { injectItems(fresh); return }

    // Replay mode: dispatch entries one at a time with delays clamped to original timing.
    // Cap per-gap at MAX_GAP so long pauses (e.g. test was idle 60s) don't stall the animation.
    // Floor at MIN_GAP so bursts don't all land in the same frame.
    const MIN_GAP = 40
    const MAX_GAP = 1200
    const sorted = [...fresh].sort((a, b) => a.entry.timestamp - b.entry.timestamp)
    // Clear any in-flight replay timers (subsequent Resend cancels previous).
    for (const id of replayTimersRef.current) window.clearTimeout(id)
    replayTimersRef.current = []
    let cumDelay = 0
    let prevTs = sorted[0].entry.timestamp
    for (let i = 0; i < sorted.length; i++) {
      const it = sorted[i]
      const rawGap = it.entry.timestamp - prevTs
      const gap = i === 0 ? 0 : Math.max(MIN_GAP, Math.min(MAX_GAP, rawGap))
      cumDelay += gap
      prevTs = it.entry.timestamp
      const tid = window.setTimeout(() => injectItems([it]), cumDelay)
      replayTimersRef.current.push(tid)
    }
  }, [injectItems])

  const { isConnected, resend } = useStream(onBatch, { getLastSeenId: () => lastSeenIdRef.current })

  useEffect(() => {
    return () => {
      for (const id of replayTimersRef.current) window.clearTimeout(id)
      replayTimersRef.current = []
    }
  }, [])

  const handleGap = useCallback((ms: number, lastBeatAt: number) => {
    setEntries([])
    setApps([])
    void clearEntries()
    setGapMs(ms)
    setGapLastBeatAt(lastBeatAt)
  }, [])
  const { initialChecked } = useHeartbeat({ onGap: handleGap })

  // Hydrate from IDB AFTER cold-start gap check finished. Merges with whatever
  // live entries already arrived so a fast WS connect doesn't get overwritten.
  useEffect(() => {
    if (!initialChecked) return
    let cancelled = false
    void getAllEntries().then((stored) => {
      if (cancelled || stored.length === 0) return
      setEntries((current) => {
        const merged = stored.concat(current)
        if (merged.length > MAX_ENTRIES) merged.splice(0, merged.length - MAX_ENTRIES)
        return merged
      })
      setApps((current) => {
        const seen = new Set(current)
        let changed = false
        for (const it of stored) if (it.appId && !seen.has(it.appId)) { seen.add(it.appId); changed = true }
        return changed ? [...seen].sort() : current
      })
    })
    return () => { cancelled = true }
  }, [initialChecked])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((item) => {
      if (levelFilter && item.entry.level !== levelFilter) return false
      if (appFilter && item.appId !== appFilter) return false
      if (!q) return true
      const hay = `${item.appId} ${item.entry.scope ?? ''} ${formatArgs(item.entry.args)}`.toLowerCase()
      return hay.includes(q)
    })
  }, [entries, search, appFilter, levelFilter])

  const handleClear = useCallback(() => {
    setEntries([])
    seenIdsRef.current = new Set()
    lastSeenIdRef.current = 0
    try { localStorage.removeItem(LAST_SEEN_ID_KEY) } catch { /* ignore */ }
    void clearEntries()
  }, [])

  const handleResend = useCallback(() => {
    for (const id of replayTimersRef.current) window.clearTimeout(id)
    replayTimersRef.current = []
    setEntries([])
    seenIdsRef.current = new Set()
    lastSeenIdRef.current = 0
    try { localStorage.removeItem(LAST_SEEN_ID_KEY) } catch { /* ignore */ }
    void clearEntries()
    resend()
  }, [resend])

  const dismissGap = useCallback(() => {
    setGapMs(null)
    setGapLastBeatAt(null)
  }, [])

  const isGraph = view === 'graph'

  return (
    <div className="App">
      <Header
        isConnected={isConnected}
        visibleCount={visible.length}
        totalCount={entries.length}
        onClear={handleClear}
        onResend={handleResend}
        view={view}
        onViewChange={setView}
      />
      {!isGraph && (
        <Filters
          search={search}
          appFilter={appFilter}
          levelFilter={levelFilter}
          apps={apps}
          onSearchChange={setSearch}
          onAppChange={setAppFilter}
          onLevelChange={setLevelFilter}
        />
      )}
      {isGraph ? <Graph entries={entries} /> : <Stream items={visible} />}
      <GapNotice gapMs={gapMs} lastBeatAt={gapLastBeatAt} onDismiss={dismissGap} />
    </div>
  )
}
