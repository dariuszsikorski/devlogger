// @purpose Custom React Flow node - shows function name + scope + counters, pulses on fire.
import { memo, useEffect, useRef } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { CallNodeData } from '../hooks/useCallGraph'

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
      el.animate(
        [
          { boxShadow: '0 0 0 0 var(--pulse-color), 0 0 16px 4px var(--pulse-color)', borderColor: 'var(--pulse-color)' },
          { boxShadow: '0 0 0 8px transparent, 0 0 0 0 transparent', borderColor: 'var(--node-border)' },
        ],
        { duration: 3000, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
      )
    } catch {
      /* WAAPI may be unsupported in tests */
    }
  }, [data.firedAt])

  const counts = data.counts
  const hasWarn  = counts.warn  > 0
  const hasError = counts.error > 0
  const hasInfo  = counts.info  > 0
  const hasDebug = counts.debug > 0

  const kind     = data.isFnNode ? 'fn' : 'scope'
  const lastLevel = data.lastLevel || undefined

  return (
    <div className="CallNode" ref={ref} data-kind={kind} data-last={lastLevel}>
      <Handle type="target" position={Position.Top}    className="CallNode_handle" />
      <Handle type="source" position={Position.Bottom} className="CallNode_handle" />

      {data.callCount > 0 && (
        <div className="CallNode_header">
          <span className="CallNode_callCount" title={`called ${data.callCount}x`}>
            x{data.callCount}
          </span>
        </div>
      )}

      <div className="CallNode_label" title={data.full}>
        {data.label}
      </div>

      {(hasWarn || hasError || hasInfo || hasDebug) && (
        <div className="CallNode_counters">
          {hasError && <span className="CallNode_chip" data-variant="error" title="errors">err {counts.error}</span>}
          {hasWarn  && <span className="CallNode_chip" data-variant="warn"  title="warnings">warn {counts.warn}</span>}
          {hasInfo  && <span className="CallNode_chip" data-variant="info"  title="info">info {counts.info}</span>}
          {hasDebug && <span className="CallNode_chip" data-variant="debug" title="debug">dbg {counts.debug}</span>}
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
