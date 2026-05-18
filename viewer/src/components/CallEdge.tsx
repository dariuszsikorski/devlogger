// @purpose Custom edge - tight bezier curve with animated in-flight packages
// riding along it. The arrived "delivery slot" pile no longer lives here; it
// is rendered INSIDE each receiving CallNode (top-right corner) so it can
// never be occluded by sibling edges' bezier paths. This file only handles
// the line itself and the RAF-driven in-flight package glyphs.
//
// Animation strategy: requestAnimationFrame + getPointAtLength on the LIVE path.
// Duration is snapshotted at mount (predictable tempo) but the path is read
// from a ref that updates every render - so when a layout (tree/radial/lanes)
// re-positions nodes, the package smoothly tracks the NEW trajectory instead
// of drifting along a stale snapshot. This keeps behaviour identical across
// every layout: grouped (stable), lanes (mostly stable), tree (full re-layout
// per change), radial (per-layer angular shuffle on every new node).
import { memo, useEffect, useMemo, useRef } from 'react'
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react'
import type { CallEdgeData } from '../hooks/useCallGraph'

// React Flow default. Lower = tighter (near-straight on short edges),
// higher = floppier. 0.25 keeps the curve organic but not loopy.
const EDGE_CURVATURE = 0.25

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

interface PayloadPackageProps {
  firedAt: number
  currentPath: string
}

// RAF-driven motion that ALWAYS reads from the current path. Duration is
// frozen at mount so timing stays predictable across layout reshuffles.
function PayloadPackage({ firedAt, currentPath }: PayloadPackageProps) {
  const groupRef       = useRef<SVGGElement | null>(null)
  const currentPathRef = useRef(currentPath)
  currentPathRef.current = currentPath // live mirror of latest prop into the RAF closure

  const startRef    = useRef<number>(0)
  const durationRef = useRef<number>(0)
  if (durationRef.current === 0) {
    startRef.current    = performance.now()
    durationRef.current = pathDuration(currentPath)
  }

  useEffect(() => {
    let raf = 0
    // Single reusable path element - avoids per-frame DOM allocation. Sits
    // detached from the tree; only used to call getTotalLength/Point.
    const probe = document.createElementNS('http://www.w3.org/2000/svg', 'path')

    function tick() {
      const elapsed = performance.now() - startRef.current
      const p = Math.min(1, elapsed / durationRef.current)
      const g = groupRef.current
      if (g) {
        probe.setAttribute('d', currentPathRef.current)
        const len = probe.getTotalLength()
        const pt  = probe.getPointAtLength(p * len)
        g.setAttribute('transform', `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)})`)
      }
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const off = useMemo(() => packageOffset(firedAt), [firedAt])

  return (
    <g ref={groupRef} className="CallEdge_payload">
      <g transform={`translate(${off.x.toFixed(2)} ${off.y.toFixed(2)})`}>
        <rect className="CallEdge_payloadShadow" x="-9" y="-7" width="18" height="14" rx="2.5" />
        <rect className="CallEdge_payloadBox"    x="-8" y="-6" width="16" height="12" rx="2" />
        <line className="CallEdge_payloadStrap"  x1="0"  y1="-6" x2="0" y2="6" />
        <line className="CallEdge_payloadTape"   x1="-8" y1="0"  x2="8" y2="0" />
      </g>
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
  // Organic bezier, but with reduced curvature so connections look precise
  // rather than over-elastic. Tighter curves also reduce visual collision
  // between parallel edges since each one bends less aggressively.
  const [path] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    curvature: EDGE_CURVATURE,
  })

  const hasArgs = data?.hasArgs ?? false
  const recentFires = data?.recentFires ?? []

  // Filters in-flight (still animating) packages from arrived ones. Uses the
  // CURRENT path which is very close to the per-package snapshotted path
  // (small layout drift only), so the cutoff matches actual animation
  // completion within a render tick. Arrived packages are aggregated per
  // target node in useCallGraph and painted as a pile INSIDE CallNode -
  // see CallNodeData.incomingPile.
  const flightDuration = useMemo(() => pathDuration(path), [path])

  const now = Date.now()
  const inFlightFires = recentFires.filter((t) => now - t < flightDuration)

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {hasArgs && inFlightFires.map((firedAt) => (
        <PayloadPackage key={firedAt} firedAt={firedAt} currentPath={path} />
      ))}
    </>
  )
}

export const CallEdge = memo(CallEdgeImpl)
