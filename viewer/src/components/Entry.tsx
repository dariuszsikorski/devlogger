// @purpose Single log row - colored by level via data-level attribute.
import { formatTime, formatArgs } from '../utils/format'
import type { StreamItem } from '../types'

interface EntryProps {
  item: StreamItem
}

export function Entry({ item }: EntryProps) {
  const e = item.entry
  const hasCount = e.count > 1

  return (
    <div className="Entry" data-level={e.level}>
      <span className="Entry_time">{formatTime(e.timestamp)}</span>
      <span className="Entry_level">{e.level}</span>
      <span className="Entry_app">
        {item.appId}
        {e.scope ? <span className="Entry_scope"> [{e.scope}]</span> : null}
      </span>
      <span className="Entry_body">
        {formatArgs(e.args)}
        {hasCount ? <span className="Entry_count"> (x{e.count})</span> : null}
      </span>
    </div>
  )
}
