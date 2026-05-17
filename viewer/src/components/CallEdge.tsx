// @purpose Custom edge - tight bezier curve with animated in-flight packages
// riding along it + a static "arrived" pile at the target end.
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
import { useEdgeSelection } from './EdgeSelectionContext'

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

interface ArrivedPileProps {
  edgeId: string
  isMulti: boolean
  x: number
  y: number
  selected: boolean
  onSelect: (id: string) => void
}

// Symbolic pile at the target end. 1 box for single arrival, 3-4 randomly
// stacked boxes for multi (capped - we never render more than 4 regardless
// of how many packages actually arrived).
//
// Pile is the ONLY interactive part of the edge - cursor + hit area come from
// CSS (.CallEdge_pile pointer-events: auto). Clicking opens the right sidebar
// with the full payload list for this edge.
function ArrivedPile({ edgeId, isMulti, x, y, selected, onSelect }: ArrivedPileProps) {
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
    <g
      className="CallEdge_pile"
      data-selected={selected ? 'true' : 'false'}
      transform={`translate(${x} ${y})`}
      onClick={(ev) => {
        ev.stopPropagation()
        onSelect(edgeId)
      }}
      role="button"
      tabIndex={0}
      aria-label={`show payloads on this edge${isMulti ? ' (multiple)' : ''}`}
    >
      {/* Invisible hit-area expands the clickable region around the pile so
          a narrow stack is still easy to tap on a touch screen. */}
      <circle className="CallEdge_pileHit" cx="0" cy="0" r="14" />
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
  // Organic bezier, but with reduced curvature so connections look precise
  // rather than over-elastic. Tighter curves also reduce visual collision
  // between parallel edges since each one bends less aggressively.
  const [path] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    curvature: EDGE_CURVATURE,
  })

  const { selectedEdgeId, selectEdge } = useEdgeSelection()
  const isSelected = selectedEdgeId === id

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
            <ArrivedPile
              edgeId={id}
              isMulti={arrivedCount > 1}
              x={targetX}
              y={targetY}
              selected={isSelected}
              onSelect={selectEdge}
            />
          )}
        </>
      )}
    </>
  )
}

export const CallEdge = memo(CallEdgeImpl)
