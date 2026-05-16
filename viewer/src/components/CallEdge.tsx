// @purpose Custom edge - bezier line + one animated payload glyph per recent fire.
// Packages stack with a deterministic offset at the destination after arrival so
// rapid bursts produce a visible pile instead of overwriting each other.
import { memo } from 'react'
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react'
import type { CallEdgeData } from '../hooks/useCallGraph'

type CallEdgeType = Edge<CallEdgeData, 'call'>

const PAYLOAD_FLIGHT_MS = 1100

// Deterministic small offset derived from the firedAt timestamp - produces a
// natural-looking pile when several packages land back-to-back.
function packageOffset(firedAt: number): { x: number; y: number } {
  const a = (firedAt % 13) - 6
  const b = (firedAt % 7) - 3
  return { x: a * 0.7, y: b * 0.9 }
}

function CallEdgeImpl({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps<CallEdgeType>) {
  const [path] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const hasArgs = data?.hasArgs ?? false
  const recentFires = data?.recentFires ?? []

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {hasArgs && recentFires.map((firedAt) => {
        const off = packageOffset(firedAt)
        return (
          // key on firedAt keeps each package stable across parent re-renders
          // so its animateMotion runs to completion exactly once.
          <g key={firedAt} className="CallEdge_payload">
            <g transform={`translate(${off.x.toFixed(2)} ${off.y.toFixed(2)})`}>
              <rect className="CallEdge_payloadShadow" x="-9" y="-7" width="18" height="14" rx="2.5" />
              <rect className="CallEdge_payloadBox"    x="-8" y="-6" width="16" height="12" rx="2" />
              <line className="CallEdge_payloadStrap"  x1="0"  y1="-6" x2="0" y2="6" />
              <line className="CallEdge_payloadTape"   x1="-8" y1="0"  x2="8" y2="0" />
            </g>
            <animateMotion
              dur={`${PAYLOAD_FLIGHT_MS}ms`}
              begin="0s"
              repeatCount="1"
              fill="freeze"
              path={path}
            />
          </g>
        )
      })}
    </>
  )
}

export const CallEdge = memo(CallEdgeImpl)
