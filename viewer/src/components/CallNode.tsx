// @purpose Custom React Flow node - shows function name + scope + counters, pulses on fire.
// Per-level icon + persistent border tint (driven by `data.lastLevel`) so user sees scope status at a glance.
import { memo, useEffect, useRef } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { CheckCircle2, AlertTriangle, XCircle, Info, Bug, Circle, type LucideIcon } from 'lucide-react'
import type { LogLevel } from '../types'
import type { CallNodeData } from '../hooks/useCallGraph'

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

  // Replay border pulse via Web Animations API whenever firedAt advances.
  useEffect(() => {
    if (!ref.current) return
    if (!data.firedAt || data.firedAt === lastFiredAt.current) return
    lastFiredAt.current = data.firedAt

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
