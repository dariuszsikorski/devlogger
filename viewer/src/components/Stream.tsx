// @purpose Scrollable list area - auto-sticks to bottom, shows demo samples when empty.
// Renderuje separator pomiedzy wpisami gdy odstep timestampow >= GAP_THRESHOLD_MS,
// zeby gole oko widzialo "tutaj cos sie dzialo, potem cisza, potem nowe logi".
import { Fragment, useEffect, useMemo, useRef } from 'react'
import { Entry } from './Entry'
import { formatGap } from '../utils/format'
import type { LogLevel, StreamItem } from '../types'

interface StreamProps {
  items: StreamItem[]
}

const DEMO_LEVELS: LogLevel[] = ['log', 'info', 'warn', 'error', 'debug']
const GAP_THRESHOLD_MS = 5000

function buildDemoItems(): StreamItem[] {
  const now = Date.now()
  return DEMO_LEVELS.map((level) => ({
    v: 1,
    appId: 'sample',
    entry: {
      level,
      scope: 'preview',
      args: [`${level} sample - waiting for live logs...`],
      timestamp: now,
      count: 1,
    },
  }))
}

export function Stream({ items }: StreamProps) {
  const ref = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  const isEmpty = items.length === 0
  const demoItems = useMemo(() => buildDemoItems(), [])
  const visible = isEmpty ? demoItems : items

  function handleScroll() {
    const el = ref.current
    if (!el) return
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 50
    stickToBottomRef.current = nearBottom
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (stickToBottomRef.current) el.scrollTop = el.scrollHeight
  }, [items])

  return (
    <main className="Stream" data-state={isEmpty ? 'empty' : 'live'} ref={ref} onScroll={handleScroll}>
      {visible.map((item, i) => {
        const prev = i > 0 ? visible[i - 1] : null
        const gapMs = prev ? item.entry.timestamp - prev.entry.timestamp : 0
        const showGap = !isEmpty && gapMs >= GAP_THRESHOLD_MS
        return (
          <Fragment key={i}>
            {showGap && (
              <div className="Stream_gap" role="separator" aria-label={`gap ${formatGap(gapMs)}`}>
                <span className="Stream_gapLabel">{formatGap(gapMs)} silence</span>
              </div>
            )}
            <Entry item={item} />
          </Fragment>
        )
      })}
    </main>
  )
}
