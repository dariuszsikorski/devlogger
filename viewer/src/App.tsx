// @purpose Root - holds entry buffer + filter state, switches between Stream and Graph views.
import { useCallback, useMemo, useState } from 'react'
import { Header } from './components/Header'
import { Filters } from './components/Filters'
import { Stream } from './components/Stream'
import { Graph } from './components/Graph'
import { useStream } from './hooks/useStream'
import { useSemanticColors } from './useSemanticColors'
import { formatArgs } from './utils/format'
import type { ViewKey } from './components/ViewSwitch'
import type { StreamItem } from './types'

const MAX_ENTRIES = 2000

export function App() {
  useSemanticColors()

  const [entries, setEntries] = useState<StreamItem[]>([])
  const [apps, setApps] = useState<string[]>([])

  const [search, setSearch] = useState('')
  const [appFilter, setAppFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [view, setView] = useState<ViewKey>('stream')

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
  }, [])

  const { isConnected } = useStream(onBatch)

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

  const handleClear = useCallback(() => setEntries([]), [])

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
    </div>
  )
}
