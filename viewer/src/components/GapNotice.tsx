// @purpose Top-right toast - tells the user the session was paused and the graph was cleared.
import { Button } from 'react-aria-components'
import { X } from 'lucide-react'

interface GapNoticeProps {
  gapMs: number | null
  lastBeatAt: number | null
  onDismiss: () => void
}

function formatGap(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm === 0 ? `${h}h` : `${h}h ${rm}m`
}

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function GapNotice({ gapMs, lastBeatAt, onDismiss }: GapNoticeProps) {
  const visible = gapMs != null && lastBeatAt != null
  if (!visible) return null
  return (
    <div className="GapNotice" role="status" aria-live="polite" data-visible="true">
      <div className="GapNotice_title">Session resumed</div>
      <div className="GapNotice_body">
        Last activity at {formatClock(lastBeatAt!)}, gap of {formatGap(gapMs!)}.
        Graph was cleared because new events arrive only live - older ones can't be replayed.
        Listening again now.
      </div>
      <Button className="GapNotice_close" onPress={onDismiss} aria-label="dismiss">
        <X size={14} />
      </Button>
    </div>
  )
}
