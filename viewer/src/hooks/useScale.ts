// @purpose UI scale rotator - ports phi/aria-kit/seller ScaleContext.
// Cycles through discrete scale steps and animates the swap with the View
// Transitions API (GPU bitmap cross-fade + transform:scale) instead of a
// CSS font-size transition (full-document layout per frame = single-digit FPS).
//
// Same SCALE_OPTIONS, same keyframes, same 378ms timing as the seller app so
// the experience is identical across phi/aria-kit, directiv panel, and this
// viewer.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

export type UIScale = 0.75 | 1.0 | 1.25 | 1.5 | 1.75 | 2.0

export const SCALE_OPTIONS: { value: UIScale; label: string }[] = [
  { value: 0.75, label: '75%' },
  { value: 1.0,  label: '100%' },
  { value: 1.25, label: '125%' },
  { value: 1.5,  label: '150%' },
  { value: 1.75, label: '175%' },
  { value: 2.0,  label: '200%' },
]

const BASE_FONT_SIZE = 16
const DESKTOP_BREAKPOINT_PX = 960

const STORAGE_KEY_DESKTOP = 'devlogger.viewer.scale:desktop'
const STORAGE_KEY_MOBILE  = 'devlogger.viewer.scale:mobile'

type ViewportMode = 'mobile' | 'desktop'

function detectMode(): ViewportMode {
  return window.innerWidth <= DESKTOP_BREAKPOINT_PX ? 'mobile' : 'desktop'
}

function storageKeyFor(mode: ViewportMode): string {
  return mode === 'mobile' ? STORAGE_KEY_MOBILE : STORAGE_KEY_DESKTOP
}

function readStoredScale(mode: ViewportMode): UIScale | null {
  try {
    const stored = localStorage.getItem(storageKeyFor(mode))
    if (stored) return parseFloat(stored) as UIScale
  } catch { /* ignore */ }
  return null
}

function resolveScaleForMode(mode: ViewportMode): UIScale {
  return readStoredScale(mode) ?? 1.0
}

function getInitialScale(): UIScale {
  if (typeof window === 'undefined') return 1.0
  return resolveScaleForMode(detectMode())
}

const styleTagBySlot = new Map<string, HTMLStyleElement>()
function injectHeadStyle(slotId: string, cssText: string) {
  let tag = styleTagBySlot.get(slotId)
  if (!tag) {
    // Adopt any tag already inserted by the index.html FOUC boot script so
    // we don't end up with two competing `:root { font-size }` rules.
    const existing = document.head.querySelector<HTMLStyleElement>(`style[data-slot="${slotId}"]`)
    if (existing) {
      tag = existing
    } else {
      tag = document.createElement('style')
      tag.setAttribute('data-slot', slotId)
      document.head.appendChild(tag)
    }
    styleTagBySlot.set(slotId, tag)
  }
  // Re-append so the rule wins source order against component CSS injected by Vite.
  document.head.appendChild(tag)
  tag.textContent = cssText
}

function applyScale(scale: UIScale) {
  const px = BASE_FONT_SIZE * scale
  injectHeadStyle('scale', `:root { font-size: ${px}px; }`)
  // useViewportClass listens for this so the 60rem desktop/mobile breakpoint
  // re-evaluates against the new root font-size.
  document.dispatchEvent(new CustomEvent('devlogger:fontsize', { detail: { size: px } }))
}

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => unknown }
function withViewTransition(mutate: () => void) {
  const doc = document as ViewTransitionDoc
  if (typeof doc.startViewTransition === 'function') {
    doc.startViewTransition(() => flushSync(mutate))
  } else {
    mutate()
  }
}

type ScrollAnchor = { element: Element; topBefore: number }
function captureScrollAnchor(): ScrollAnchor | null {
  const x = Math.max(window.innerWidth / 2, 1)
  const y = Math.min(window.innerHeight * 0.2, 200)
  const element = document.elementFromPoint(x, y)
  if (!element) return null
  return { element, topBefore: element.getBoundingClientRect().top }
}
function restoreScrollAnchor(anchor: ScrollAnchor) {
  const topAfter = anchor.element.getBoundingClientRect().top
  const delta = topAfter - anchor.topBefore
  if (delta === 0) return
  window.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior })
}

export interface UseScaleResult {
  scale: UIScale
  setScale: (s: UIScale) => void
  cycleScale: () => void
  scaleLabel: string
}

export function useScale(): UseScaleResult {
  const [scale, setScaleState] = useState<UIScale>(getInitialScale)
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  useEffect(() => { applyScale(scale) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const apply = useCallback((s: UIScale) => {
    const anchor = captureScrollAnchor()
    const oldFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || BASE_FONT_SIZE
    const newFontSize = BASE_FONT_SIZE * s
    const ratio = newFontSize / oldFontSize
    const OLD_GROWTH_FACTOR = 0.85
    const oldTo = 1 + (ratio - 1) * OLD_GROWTH_FACTOR
    document.documentElement.style.setProperty('--scale-vt-old-to', String(oldTo))
    document.documentElement.style.setProperty('--scale-vt-new-from', String(1 / ratio))
    withViewTransition(() => {
      setScaleState(s)
      applyScale(s)
      if (anchor) restoreScrollAnchor(anchor)
    })
  }, [])

  const commit = useCallback((s: UIScale) => {
    apply(s)
    try { localStorage.setItem(storageKeyFor(detectMode()), String(s)) } catch { /* ignore */ }
  }, [apply])

  const setScale = useCallback((s: UIScale) => commit(s), [commit])

  const cycleScale = useCallback(() => {
    const idx = SCALE_OPTIONS.findIndex(o => o.value === scaleRef.current)
    const next = SCALE_OPTIONS[(idx + 1) % SCALE_OPTIONS.length].value
    commit(next)
  }, [commit])

  useEffect(() => {
    let lastMode = detectMode()
    let rafId: number | null = null
    let lastTime = 0
    const THROTTLE_MS = 100

    const check = () => {
      const newMode = detectMode()
      if (newMode === lastMode) return
      lastMode = newMode
      const next = resolveScaleForMode(newMode)
      if (next === scaleRef.current) return
      apply(next)
    }

    const onResize = () => {
      const now = Date.now()
      if (now - lastTime < THROTTLE_MS) {
        if (rafId) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(onResize)
        return
      }
      lastTime = now
      rafId = null
      check()
    }

    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [apply])

  const scaleLabel = SCALE_OPTIONS.find(o => o.value === scale)?.label ?? '100%'
  return useMemo(() => ({ scale, setScale, cycleScale, scaleLabel }), [scale, setScale, cycleScale, scaleLabel])
}
