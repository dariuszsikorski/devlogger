// @purpose Root - holds entry buffer + filter state, switches between Stream and Graph views.
// Entries are persisted to IndexedDB so a tab cold-kill or reload restores the live view.
// Heartbeat detects suspension gaps - on a long gap we soft-reset (live events only, no replay).
import { useCallback, useEffect, useMemo, useState } from 'react'
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

export function App() {
  useSemanticColors()
  useViewportClass()

  const [entries, setEntries] = useState<StreamItem[]>([])
  const [apps, setApps] = useState<string[]>([])

  const [search, setSearch] = useState('')
  const [appFilter, setAppFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [view, setView] = useState<ViewKey>('stream')

  const [gapMs, setGapMs] = useState<number | null>(null)
  const [gapLastBeatAt, setGapLastBeatAt] = useState<number | null>(null)

  const onBatch = useCallback((items: StreamItem[]) => {
    setEntries((prev) => {
      const next = prev.concat(items)
      if (next.length > MAX_ENTRIES) next.splice(0, next.length - MAX_ENTRIES)
      return next
    })
    setApps((prev) => {
      const seen = new Set(prev)
      let changed = false
      for (const item of items) {
        if (item.appId && !seen.has(item.appId)) { seen.add(item.appId); changed = true }
      }
      return changed ? [...seen].sort() : prev
    })
    // Best-effort persistence - never blocks the live render.
    void putEntries(items)
  }, [])

  const { isConnected } = useStream(onBatch)

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
    void clearEntries()
  }, [])

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
