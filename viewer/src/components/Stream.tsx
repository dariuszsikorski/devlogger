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

const DEMO_LEVELS: LogLevel[] = ['log', 'info', 'warn', 'error', 'debug', 'success']
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

// How close to the bottom (px) still counts as "stuck to bottom".
const NEAR_BOTTOM_PX = 60

export function Stream({ items }: StreamProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Whether new logs should keep pulling the view to the bottom. Flips to false
  // the moment the user scrolls up, back to true when they return to the bottom.
  const stickToBottomRef = useRef(true)
  // In-flight rAF id for the smooth scroll, and a flag so the scroll events our
  // own animation produces don't get mistaken for the user scrolling.
  const rafRef = useRef<number | null>(null)
  const autoScrollingRef = useRef(false)

  const isEmpty = items.length === 0
  const demoItems = useMemo(() => buildDemoItems(), [])
  const visible = isEmpty ? demoItems : items

  function cancelAuto() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    autoScrollingRef.current = false
  }

  // Manual rAF easing toward the bottom. We deliberately do NOT use
  // scrollTo({ behavior: 'smooth' }) or CSS scroll-behavior: smooth - browsers
  // turn those into instant jumps under prefers-reduced-motion. Stepping
  // scrollTop ourselves stays smooth regardless of that setting (by design,
  // per the request - this is a tiny, non-vestibular UI nudge).
  function animateToBottom() {
    const el = ref.current
    if (!el) return
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    autoScrollingRef.current = true

    const step = () => {
      const node = ref.current
      if (!node || !stickToBottomRef.current) { cancelAuto(); return }
      const target = node.scrollHeight - node.clientHeight
      const dist = target - node.scrollTop
      if (dist <= 1) {
        node.scrollTop = target
        rafRef.current = null
        autoScrollingRef.current = false
        return
      }
      // ease-out: cover a fraction of the remaining gap each frame, with a floor
      // so the last pixels don't crawl. Re-targets every frame, so logs arriving
      // mid-animation just extend the destination instead of stranding it.
      node.scrollTop = node.scrollTop + Math.max(dist * 0.22, 2)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }

  function handleScroll() {
    const el = ref.current
    if (!el) return
    // Ignore scroll events produced by our own animation - only real user
    // scrolling is allowed to change the sticky decision.
    if (autoScrollingRef.current) return
    stickToBottomRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - NEAR_BOTTOM_PX
  }

  // User scroll intent (wheel / touch / keys) must win over an in-flight
  // auto-scroll: cancel the animation so they can pull up freely. The scroll
  // event that follows then recomputes stickiness from the new position.
  function handleUserScrollIntent() {
    if (autoScrollingRef.current) cancelAuto()
  }

  useEffect(() => {
    if (stickToBottomRef.current) animateToBottom()
  }, [items])

  // Clean up any pending frame on unmount.
  useEffect(() => () => cancelAuto(), [])

  return (
    <main
      className="Stream"
      data-state={isEmpty ? 'empty' : 'live'}
      ref={ref}
      onScroll={handleScroll}
      onWheel={handleUserScrollIntent}
      onTouchMove={handleUserScrollIntent}
      onKeyDown={handleUserScrollIntent}
    >
      {visible.map((item, i) => {
        const prev = i > 0 ? visible[i - 1] : null
        const gapMs = prev ? item.entry.timestamp - prev.entry.timestamp : 0
        const showGap = !isEmpty && gapMs >= GAP_THRESHOLD_MS
        // Stable key: broker-assigned id for real items so the list survives
        // MAX_ENTRIES trim (which splices the head and would otherwise shift
        // every index, forcing React to remount every Entry). Demo items
        // have no id - fall back to index since they never get trimmed.
        const key = item.id != null ? `e-${item.id}` : `i-${i}`
        return (
          <Fragment key={key}>
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
