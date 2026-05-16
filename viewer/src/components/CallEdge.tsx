// @purpose Custom edge - metro-style path (straights + 45deg diagonals) with
// animated in-flight packages riding along it + a static "arrived" pile at
// the target end. In-flight packages snapshot their path so parent re-renders
// don't restart animations. Once a package arrives, the in-flight render is
// replaced by the pile composition (1 box for a single arrival, otherwise a
// symbolic 3-4 stacked-package cluster).
import { memo, useMemo, useRef } from 'react'
import {
  BaseEdge,
  Position,
  type EdgeProps,
  type Edge,
} from '@xyflow/react'
import type { CallEdgeData } from '../hooks/useCallGraph'

// Metro-style path: only 0deg / 90deg straights with 45deg diagonals.
// No bezier curves - looks technical like a transit map. Per-edge variance
// from edge id hash shifts the diagonal junctions so parallel routes between
// nearby nodes don't sit perfectly on top of each other.
const METRO_MIN_STRAIGHT = 16
const METRO_VARIANCE = 22

function getMetroPath(opts: {
  sourceX: number; sourceY: number; targetX: number; targetY: number;
  sourcePosition: Position; targetPosition: Position; edgeId: string;
}): [string, number, number] {
  const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty, sourcePosition, targetPosition, edgeId } = opts
  const dx = tx - sx
  const dy = ty - sy
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  const sgnX = (Math.sign(dx) || 1) as 1 | -1
  const sgnY = (Math.sign(dy) || 1) as 1 | -1

  const h = hashString(edgeId)
  const variance = (h % (METRO_VARIANCE * 2 + 1)) - METRO_VARIANCE

  const srcVertical = sourcePosition === Position.Top || sourcePosition === Position.Bottom
  const tgtVertical = targetPosition === Position.Top || targetPosition === Position.Bottom

  // Vertical flow: bottom -> top handles (or vice versa). Most common in the
  // grouped/tree layouts where nodes stack vertically inside scope groups.
  if (srcVertical && tgtVertical) {
    const diagLen = Math.min(adx, ady)
    const remY = ady - diagLen
    // Need room for initial + final straight segments before/after diagonal.
    if (remY < METRO_MIN_STRAIGHT * 2 || diagLen < 1) {
      // Not enough vertical headroom for a diagonal - degrade to a Z-step.
      const midY = sy + sgnY * (ady / 2)
      return [`M ${sx},${sy} L ${sx},${midY} L ${tx},${midY} L ${tx},${ty}`, (sx + tx) / 2, midY]
    }
    let initial = remY / 2 + variance
    initial = Math.max(METRO_MIN_STRAIGHT, Math.min(remY - METRO_MIN_STRAIGHT, initial))
    const p1y = sy + sgnY * initial
    const diagDx = sgnX * diagLen
    const diagDy = sgnY * diagLen
    const p2x = sx + diagDx
    const p2y = p1y + diagDy
    if (diagLen === adx) {
      // Diagonal closes the x gap entirely - one more vertical to target.
      return [`M ${sx},${sy} L ${sx},${p1y} L ${p2x},${p2y} L ${tx},${ty}`, p2x, p2y]
    }
    // Diagonal closes the y/limited side - need a horizontal stub before final vertical.
    return [`M ${sx},${sy} L ${sx},${p1y} L ${p2x},${p2y} L ${tx},${p2y} L ${tx},${ty}`, tx, p2y]
  }

  // Horizontal flow fallback (left/right handles).
  const diagLen = Math.min(adx, ady)
  const remX = adx - diagLen
  if (remX < METRO_MIN_STRAIGHT * 2 || diagLen < 1) {
    const midX = sx + sgnX * (adx / 2)
    return [`M ${sx},${sy} L ${midX},${sy} L ${midX},${ty} L ${tx},${ty}`, midX, (sy + ty) / 2]
  }
  let initial = remX / 2 + variance
  initial = Math.max(METRO_MIN_STRAIGHT, Math.min(remX - METRO_MIN_STRAIGHT, initial))
  const p1x = sx + sgnX * initial
  const p2x = p1x + sgnX * diagLen
  const p2y = sy + sgnY * diagLen
  if (diagLen === ady) {
    return [`M ${sx},${sy} L ${p1x},${sy} L ${p2x},${p2y} L ${tx},${ty}`, p2x, p2y]
  }
  return [`M ${sx},${sy} L ${p1x},${sy} L ${p2x},${p2y} L ${p2x},${ty} L ${tx},${ty}`, p2x, p2y]
}

type CallEdgeType = Edge<CallEdgeData, 'call'>

// Constant visual speed: duration scales linearly with path length so short
// and long edges feel the same speed. Halved from the previous calibration
// (was 0.25) to make packages crawl across the graph more deliberately.
const PIXELS_PER_MS = 0.125
const MIN_FLIGHT_MS = 400
const MAX_FLIGHT_MS = 8000

function packageOffset(firedAt: number): { x: number; y: number } {
  const a = (firedAt % 13) - 6
  const b = (firedAt % 7) - 3
  return { x: a * 0.7, y: b * 0.9 }
}

function measurePathLength(d: string): number {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  el.setAttribute('d', d)
  return el.getTotalLength()
}

function pathDuration(d: string): number {
  const length = measurePathLength(d)
  const raw = length / PIXELS_PER_MS
  return Math.min(MAX_FLIGHT_MS, Math.max(MIN_FLIGHT_MS, raw))
}

// FNV-1a hash - cheap, deterministic, decent dispersion for short strings.
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

interface PayloadPackageProps {
  firedAt: number
  currentPath: string
}

// Snapshots path + duration on mount so layout shifts don't restart SMIL.
function PayloadPackage({ firedAt, currentPath }: PayloadPackageProps) {
  const pathRef = useRef<string>(currentPath)
  const durationRef = useRef<number | null>(null)
  if (durationRef.current === null) {
    durationRef.current = pathDuration(pathRef.current)
  }
  const path = pathRef.current
  const duration = durationRef.current
  const off = packageOffset(firedAt)

  return (
    <g className="CallEdge_payload">
      <g transform={`translate(${off.x.toFixed(2)} ${off.y.toFixed(2)})`}>
        <rect className="CallEdge_payloadShadow" x="-9" y="-7" width="18" height="14" rx="2.5" />
        <rect className="CallEdge_payloadBox"    x="-8" y="-6" width="16" height="12" rx="2" />
        <line className="CallEdge_payloadStrap"  x1="0"  y1="-6" x2="0" y2="6" />
        <line className="CallEdge_payloadTape"   x1="-8" y1="0"  x2="8" y2="0" />
      </g>
      <animateMotion
        dur={`${duration}ms`}
        begin="0s"
        repeatCount="1"
        fill="freeze"
        path={path}
      />
    </g>
  )
}

interface ArrivedPileProps {
  edgeId: string
  isMulti: boolean
  x: number
  y: number
}

// Symbolic pile at the target end. 1 box for single arrival, 3-4 randomly
// stacked boxes for multi (capped - we never render more than 4 regardless
// of how many packages actually arrived).
function ArrivedPile({ edgeId, isMulti, x, y }: ArrivedPileProps) {
  const positions = useMemo(() => {
    const h = hashString(edgeId)
    const want = isMulti ? 3 + (h % 2) : 1
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
  }, [edgeId, isMulti])

  return (
    <g className="CallEdge_pile" transform={`translate(${x} ${y})`}>
      {positions.map((p, i) => (
        <g key={i} transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.rot.toFixed(1)})`}>
          <rect className="CallEdge_payloadShadow" x="-9" y="-7" width="18" height="14" rx="2.5" />
          <rect className="CallEdge_payloadBox"    x="-8" y="-6" width="16" height="12" rx="2" />
          <line className="CallEdge_payloadStrap"  x1="0"  y1="-6" x2="0" y2="6" />
          <line className="CallEdge_payloadTape"   x1="-8" y1="0"  x2="8" y2="0" />
        </g>
      ))}
    </g>
  )
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
  // Metro-style: straights + 45deg diagonals, no curves. Per-edge id variance
  // nudges diagonal junctions so parallel routes diverge instead of overlapping.
  const [path] = getMetroPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    edgeId: id,
  })

  const hasArgs = data?.hasArgs ?? false
  const recentFires = data?.recentFires ?? []
  const totalCount = data?.count ?? 0

  // Duration for filtering in-flight from arrived. Uses current path which is
  // very close to the per-package snapshotted path (small layout drift only),
  // so the cutoff matches actual animation completion within a render tick.
  const flightDuration = useMemo(() => pathDuration(path), [path])

  const now = Date.now()
  const inFlightFires = recentFires.filter((t) => now - t < flightDuration)
  // Anything fired but not currently flying has already arrived. We don't
  // need an exact count - just whether ANY arrived and whether MORE THAN ONE
  // arrived, which controls pile composition.
  const arrivedCount = Math.max(0, totalCount - inFlightFires.length)

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {hasArgs && (
        <>
          {inFlightFires.map((firedAt) => (
            <PayloadPackage key={firedAt} firedAt={firedAt} currentPath={path} />
          ))}
          {arrivedCount > 0 && (
            <ArrivedPile edgeId={id} isMulti={arrivedCount > 1} x={targetX} y={targetY} />
          )}
        </>
      )}
    </>
  )
}

export const CallEdge = memo(CallEdgeImpl)
