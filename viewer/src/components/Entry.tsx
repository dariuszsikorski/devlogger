// @purpose Single log row - colored by level. Non-exec entries with long body are clickable
// and open LogDetailDialog showing full message + JsonTree for object args. Exec entries stay inline.
import { useState } from 'react'
import { formatTime, formatArgs, formatValue } from '../utils/format'
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

function isPlainObject(a: unknown): a is Record<string, unknown> {
  return a !== null && typeof a === 'object' && !Array.isArray(a)
}

function hasStructuredArg(item: StreamItem): boolean {
  return item.entry.args.some((a) => a !== null && typeof a === 'object')
}

// Render object args as styled key/value chips instead of a raw text blob, so the
// Stream row stays scannable. Strings stay plain text; arrays/primitives fall back
// to the compact formatter. The full structure is still one click away (JsonTree).
function StructuredBody({ args }: { args: unknown[] }) {
  return (
    <>
      {args.map((a, i) => {
        if (typeof a === 'string') return <span className="Entry_msg" key={i}>{a}</span>
        if (isPlainObject(a)) {
          return (
            <span className="Entry_kv" key={i}>
              {Object.entries(a).map(([k, v]) => (
                <span className="Entry_pair" key={k}>
                  <span className="Entry_k">{k}</span>
                  <span className="Entry_v">{formatValue(v, 1)}</span>
                </span>
              ))}
            </span>
          )
        }
        return <span className="Entry_msg" key={i}>{formatValue(a, 0)}</span>
      })}
    </>
  )
}

export function Entry({ item }: EntryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const e = item.entry
  const hasCount = e.count > 1
  const isExec = isExecEntry(item)
  const structured = hasStructuredArg(item)
  const formatted = formatArgs(e.args)
  const isLong = formatted.length > INLINE_BODY_MAX
  const isClickable = !isExec && (isLong || structured)
  // Plain-string bodies still truncate; structured bodies render as chips that wrap.
  const display = isLong && !structured ? formatted.slice(0, INLINE_BODY_MAX) + '...' : formatted
  const useChips = !isExec && structured

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
        <span className="Entry_body" data-chips={useChips || undefined}>
          {useChips ? <StructuredBody args={e.args} /> : display}
          {hasCount ? <span className="Entry_count"> (x{e.count})</span> : null}
        </span>
      </div>
      {isClickable && (
        <LogDetailDialog item={isOpen ? item : null} onClose={() => setIsOpen(false)} />
      )}
    </>
  )
}
