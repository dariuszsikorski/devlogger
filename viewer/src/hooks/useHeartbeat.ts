// @purpose Liveness tracking - periodic heartbeat to IDB + gap detection on resume.
// Reports a gap event when the elapsed time since the last beat exceeds GAP_THRESHOLD_MS,
// which covers both "tab was suspended" and "tab was cold-killed" cases (IDB survives both).
// Exposes `initialChecked` so callers can gate IDB hydration until cold-start cleanup
// (clearEntries on gap) has finished - prevents restoring entries that we just wiped.
import { useEffect, useRef, useState } from 'react'
import { clearEntries, getMeta, setMeta } from '../storage/entriesDb'

const META_KEY = 'lastHeartbeat'
const BEAT_INTERVAL_MS = 30_000
const GAP_THRESHOLD_MS = 60_000

interface UseHeartbeatOpts {
  /** Fired once per detected gap >= GAP_THRESHOLD_MS. */
  onGap: (gapMs: number, lastBeatAt: number) => void
}

interface UseHeartbeatResult {
  /** Becomes true once the cold-start gap check (and any cleanup) has completed. */
  initialChecked: boolean
}

export function useHeartbeat({ onGap }: UseHeartbeatOpts): UseHeartbeatResult {
  const onGapRef = useRef(onGap)
  onGapRef.current = onGap

  const [initialChecked, setInitialChecked] = useState(false)

  useEffect(() => {
    let disposed = false
    let inMemoryLastBeat = Date.now()

    function writeBeat(): void {
      const now = Date.now()
      inMemoryLastBeat = now
      void setMeta(META_KEY, now)
    }

    function checkGap(referenceBeat: number, label: string): void {
      const gap = Date.now() - referenceBeat
      if (gap > GAP_THRESHOLD_MS) {
        // eslint-disable-next-line no-console
        console.info(`[devlogger-viewer] gap detected (${label}): ${Math.round(gap / 1000)}s`)
        onGapRef.current(gap, referenceBeat)
      }
    }

    // Cold-start path: read the last heartbeat persisted across reloads/kills.
    // This is the ONLY path that sees a real "tab was killed" gap, because
    // in-memory state was wiped by the cold restart.
    // On gap we wipe IDB BEFORE flipping `initialChecked` so the App-side
    // hydration effect can't race-load entries that belong to the previous session.
    async function hydrateAndCheck() {
      const persisted = await getMeta<number>(META_KEY)
      if (disposed) return
      if (typeof persisted === 'number') {
        const gap = Date.now() - persisted
        if (gap > GAP_THRESHOLD_MS) {
          await clearEntries()
          if (disposed) return
          // eslint-disable-next-line no-console
          console.info(`[devlogger-viewer] gap detected (cold-start): ${Math.round(gap / 1000)}s`)
          onGapRef.current(gap, persisted)
        }
      }
      writeBeat()
      setInitialChecked(true)
    }
    void hydrateAndCheck()

    const intervalId = window.setInterval(writeBeat, BEAT_INTERVAL_MS)

    // Suspend path: timers stop or throttle when hidden, so an interval may not
    // fire for minutes. visibilitychange (-> visible) is our reliable trigger
    // to compare wall-clock against the in-memory beat.
    function onVisibility(): void {
      if (document.visibilityState !== 'visible') {
        // Refresh the marker right before sleep so a short flicker isn't seen as a gap.
        inMemoryLastBeat = Date.now()
        void setMeta(META_KEY, inMemoryLastBeat)
        return
      }
      checkGap(inMemoryLastBeat, 'resume')
      writeBeat()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return { initialChecked }
}
