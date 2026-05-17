// @purpose Single log row - colored by level. Non-exec entries with long body are clickable
// and open LogDetailDialog showing full message + JsonTree for object args. Exec entries stay inline.
import { useState } from 'react'
import { formatTime, formatArgs } from '../utils/format'
import { LogDetailDialog } from './LogDetailDialog'
import type { StreamItem } from '../types'

interface EntryProps {
  item: StreamItem
}

const INLINE_BODY_MAX = 140

function isExecEntry(item: StreamItem): boolean {
  const a = item.entry.args
  if (a.length === 0) return false
  if (typeof a[0] !== 'string') return false
  return a[0].includes(' called ') || a[0].endsWith(' with args:')
}

function hasStructuredArg(item: StreamItem): boolean {
  return item.entry.args.some((a) => a !== null && typeof a === 'object')
}

export function Entry({ item }: EntryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const e = item.entry
  const hasCount = e.count > 1
  const isExec = isExecEntry(item)
  const formatted = formatArgs(e.args)
  const isLong = formatted.length > INLINE_BODY_MAX
  const isClickable = !isExec && (isLong || hasStructuredArg(item))
  const display = isLong ? formatted.slice(0, INLINE_BODY_MAX) + '...' : formatted

  const handleClick = () => { if (isClickable) setIsOpen(true) }
  const handleKey = (ev: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isClickable) return
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setIsOpen(true) }
  }

  return (
    <>
      <div
        className="Entry"
        data-level={e.level}
        data-clickable={isClickable || undefined}
        onClick={handleClick}
        onKeyDown={handleKey}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        aria-label={isClickable ? 'open log entry detail' : undefined}
      >
        <span className="Entry_time">{formatTime(e.timestamp)}</span>
        <span className="Entry_level">{e.level}</span>
        <span className="Entry_app">
          {item.appId}
          {e.scope ? <span className="Entry_scope"> [{e.scope}]</span> : null}
        </span>
        <span className="Entry_body">
          {display}
          {hasCount ? <span className="Entry_count"> (x{e.count})</span> : null}
        </span>
      </div>
      {isClickable && (
        <LogDetailDialog item={isOpen ? item : null} onClose={() => setIsOpen(false)} />
      )}
    </>
  )
}
