// @purpose Custom React Flow node - shows function name + scope + counters, pulses on fire.
// Per-level icon + persistent border tint (driven by `data.lastLevel`) so user sees scope status at a glance.
import { memo, useEffect, useMemo, useRef } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { CheckCircle2, AlertTriangle, XCircle, Info, Bug, Circle, type LucideIcon } from 'lucide-react'
import type { LogLevel } from '../types'
import type { CallNodeData } from '../hooks/useCallGraph'
import { useEdgeSelection } from './EdgeSelectionContext'

// FNV-1a hash -> deterministic pile arrangement per edge id, so the same
// node always paints the boxes in the same wobble. Matches the algorithm
// previously used by the standalone pile so the visual is identical.
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const LEVEL_ICON: Record<LogLevel, LucideIcon> = {
  success: CheckCircle2,
  error:   XCircle,
  warn:    AlertTriangle,
  info:    Info,
  debug:   Bug,
  log:     Circle,
}

type CallNodeType = Node<CallNodeData, 'call'>

function CallNodeImpl({ data }: NodeProps<CallNodeType>) {
  const ref = useRef<HTMLDivElement | null>(null)
  const lastFiredAt = useRef<number>(0)
  // Wall-clock of the last pulse start - throttles WAAPI restarts so rapid
  // back-to-back fires (recursion, hot loops, replay drip) don't kill the
  // 3500ms fade by cancelling it every 50ms. See PULSE_THROTTLE_MS below.
  const lastPulseStartRef = useRef<number>(0)
  const { selectedEdgeId, selectEdge } = useEdgeSelection()

  // Pile composition is deterministic per latestEdgeId so the boxes don't
  // re-shuffle on every render tick.
  const pile = data.incomingPile
  const pileBoxes = useMemo(() => {
    if (!pile || pile.count <= 0) return []
    const h = hashString(pile.latestEdgeId || 'node-pile')
    // Pile grows with actual deliveries: 1 -> 1 box, 2 -> 2, 3 -> 3, 4+ -> 4.
    // Count here is ARRIVED-only (in-flight excluded in useCallGraph), so
    // boxes materialise in sync with each package's arrival animation.
    const want = Math.min(4, pile.count)
    const out: Array<{ x: number; y: number; rot: number }> = []
    for (let i = 0; i < want; i++) {
      const sx = ((h ^ (i * 73856093)) >>> 0) % 17
      const sy = (((h >>> 4) ^ (i * 19349663)) >>> 0) % 13
      const sr = (((h >>> 8) ^ (i * 83492791)) >>> 0) % 21
      out.push({
        x: (sx - 8) * 0.7,
        y: (sy - 6) * 0.6,
        rot: (sr - 10) * 0.7,
      })
    }
    return out
  }, [pile])

  // Replay border pulse via Web Animations API when firedAt advances - but
  // throttle restarts so back-to-back fires don't cancel an already-running
  // pulse mid-fade. The pulse decays over 3500ms; if a new fire arrives
  // sooner than PULSE_THROTTLE_MS we let the in-flight animation finish
  // its decay rather than snap back to full colour. Tracking firedAt still
  // marks "we saw this fire" so we don't re-trigger for the same value.
  useEffect(() => {
    if (!ref.current) return
    if (!data.firedAt || data.firedAt === lastFiredAt.current) return
    lastFiredAt.current = data.firedAt

    // Min gap between visible pulse restarts. Picked at ~40% of the 3500ms
    // decay so by the time we restart, the previous pulse has visibly faded
    // most of the way back to base - the restart reads as a fresh "hit"
    // rather than a glitch.
    const PULSE_THROTTLE_MS = 1500
    const now = performance.now()
    if (now - lastPulseStartRef.current < PULSE_THROTTLE_MS) return
    lastPulseStartRef.current = now

    const el = ref.current
    try {
      el.getAnimations().forEach((a) => a.cancel())
    } catch {
      /* ignore */
    }
    try {
      // Subtle border-only pulse. The old version added a 16px outer glow on
      // the box that "flashed the whole node" - dropped to keep the body
      // surface calm and let only the border carry the activation cue.
      el.animate(
        [
          { borderColor: 'var(--pulse-color)' },
          { borderColor: 'var(--node-border)' },
        ],
        { duration: 3500, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
      )
    } catch {
      /* WAAPI may be unsupported in tests */
    }
  }, [data.firedAt])

  const counts = data.counts
  const hasWarn    = counts.warn    > 0
  const hasError   = counts.error   > 0
  const hasInfo    = counts.info    > 0
  const hasDebug   = counts.debug   > 0
  const hasSuccess = counts.success > 0

  const kind     = data.isFnNode ? 'fn' : 'scope'
  const lastLevel: LogLevel | undefined = (data.lastLevel || undefined) as LogLevel | undefined
  const Icon = lastLevel ? LEVEL_ICON[lastLevel] : null
  const isClickable = Array.isArray(data.lastArgs) && data.lastArgs.length > 0

  return (
    <div className="CallNode" ref={ref} data-kind={kind} data-last={lastLevel} data-clickable={isClickable || undefined}>
      <Handle type="target" position={Position.Top}    className="CallNode_handle" />
      <Handle type="source" position={Position.Bottom} className="CallNode_handle" />

      {pile && pile.count > 0 && (
        <button
          type="button"
          className="CallNode_pile"
          data-selected={selectedEdgeId === pile.latestEdgeId ? 'true' : 'false'}
          title={`${pile.count} payload${pile.count > 1 ? 's' : ''} delivered - click to inspect`}
          aria-label={`${pile.count} delivered payload${pile.count > 1 ? 's' : ''}`}
          onClick={(ev) => {
            ev.stopPropagation()
            selectEdge(pile.latestEdgeId)
          }}
        >
          <svg className="CallNode_pileSvg" width="32" height="32" viewBox="-16 -16 32 32">
            {pileBoxes.map((p, i) => (
              <g key={i} transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.rot.toFixed(1)})`}>
                <rect className="CallEdge_payloadShadow" x="-9" y="-7" width="18" height="14" rx="2.5" />
                <rect className="CallEdge_payloadBox"    x="-8" y="-6" width="16" height="12" rx="2" />
                <line className="CallEdge_payloadStrap"  x1="0"  y1="-6" x2="0" y2="6" />
                <line className="CallEdge_payloadTape"   x1="-8" y1="0"  x2="8" y2="0" />
              </g>
            ))}
          </svg>
        </button>
      )}

      {(data.callCount > 0 || Icon) && (
        <div className="CallNode_header">
          {Icon && (
            <Icon className="CallNode_levelIcon" size={12} aria-label={`last level: ${lastLevel}`} />
          )}
          {data.callCount > 0 && (
            <span className="CallNode_callCount" title={`called ${data.callCount}x`}>
              x{data.callCount}
            </span>
          )}
        </div>
      )}

      <div className="CallNode_label" title={data.full}>
        {data.label}
      </div>

      {(hasWarn || hasError || hasInfo || hasDebug || hasSuccess) && (
        <div className="CallNode_counters">
          {hasError   && <span className="CallNode_chip" data-variant="error"   title="errors">err {counts.error}</span>}
          {hasSuccess && <span className="CallNode_chip" data-variant="success" title="success">ok {counts.success}</span>}
          {hasWarn    && <span className="CallNode_chip" data-variant="warn"    title="warnings">warn {counts.warn}</span>}
          {hasInfo    && <span className="CallNode_chip" data-variant="info"    title="info">info {counts.info}</span>}
          {hasDebug   && <span className="CallNode_chip" data-variant="debug"   title="debug">dbg {counts.debug}</span>}
        </div>
      )}

      {!data.isFnNode && data.lastMessage && (
        <div className="CallNode_lastMessage" title={data.lastMessage}>
          {data.lastMessage}
        </div>
      )}
    </div>
  )
}

export const CallNode = memo(CallNodeImpl)
