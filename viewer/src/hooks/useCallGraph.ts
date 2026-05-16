// @purpose Derives a live call graph (group nodes + child nodes + edges) from streamed exec() log entries.
// Each unique scope becomes a draggable container; function nodes are children with extent:'parent'.
import { useEffect, useRef, useState } from 'react'
import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { LogEntry, LogLevel, StreamItem } from '../types'
import type { ScopeGroupData } from '../components/ScopeGroup'

export interface CallNodeData {
  label: string
  full: string
  scope: string
  appId: string
  firedAt: number
  callCount: number
  isFnNode: boolean
  /** True once this function has appeared as the `by` field - scope is then final. */
  lockedScope: boolean
  counts: Record<LogLevel, number>
  lastMessage: string
  lastLevel: LogLevel | ''
  [key: string]: unknown
}

export interface CallEdgeData {
  firedAt: number
  count: number
  /** True when the underlying exec carried an args payload (object/array with entries). */
  hasArgs: boolean
  /** Timestamps of the most recent fires - one rendered package per entry. */
  recentFires: number[]
  [key: string]: unknown
}

type AnyGraphNode = Node<CallNodeData> | Node<ScopeGroupData>

interface GraphState {
  nodes: Map<string, AnyGraphNode>
  edges: Map<string, Edge<CallEdgeData>>
  scopeCols: Map<string, number>
  rowsInCol: Map<string, number>
  /** Per-scope freed row slots from reassignments - reused before allocating new rows. */
  freedRows: Map<string, number[]>
  /** node id -> row index in its current scope. */
  nodeRow: Map<string, number>
  groupHeights: Map<string, number>
  lastProcessedIndex: number
}

interface ParsedExec {
  by?: string
  target?: string
  msg?: string
  hasArgs: boolean
}

// Group container geometry. Function nodes use positions RELATIVE to their parent group.
// GROUP_W = NODE_W (220 from CallNode.scss) + 2*NODE_X_INSIDE so child nodes
// sit with symmetric horizontal padding inside the frame.
const GROUP_W       = 244
const GROUP_GAP_X   = 36
const GROUP_GAP_Y   = 40
const COL_STRIDE    = GROUP_W + GROUP_GAP_X
const HEADER_H      = 28
const PAD_TOP       = 14
const ROW_H         = 104
const PAD_BOTTOM    = 16
const NODE_X_INSIDE = 12

// How many scope-groups fit in one row before wrapping. Keeps the canvas compact in 2D
// instead of scrolling forever to the right.
const COLS_PER_ROW  = 4

function makeFreshState(): GraphState {
  return {
    nodes: new Map(),
    edges: new Map(),
    scopeCols: new Map(),
    rowsInCol: new Map(),
    freedRows: new Map(),
    nodeRow: new Map(),
    groupHeights: new Map(),
    lastProcessedIndex: 0,
  }
}

function parseExec(entry: LogEntry): ParsedExec | null {
  if (entry.level !== 'log') return null
  const head = entry.args[0]
  if (typeof head !== 'string') return null

  // exec emits "with args:" suffix only when the args payload was non-empty,
  // and ships the actual object as a separate console arg (entry.args[1]).
  const hasArgs = head.endsWith('with args:') && entry.args.length > 1

  const m = head.match(/^(.+?) called (.+?)(?: \| (.+?))?(?: with args:)?$/)
  if (m) return { by: m[1], target: m[2], msg: m[3], hasArgs }

  const t = head.match(/^(.+?) with args:$/)
  if (t && entry.args.length > 1) return { target: t[1], hasArgs: true }

  return null
}

function scopeKey(appId: string, scope: string | undefined | null): string {
  return `${appId || 'unknown'}::${scope || '_unscoped'}`
}

function getColumn(state: GraphState, sk: string): number {
  const existing = state.scopeCols.get(sk)
  if (existing != null) return existing
  const col = state.scopeCols.size
  state.scopeCols.set(sk, col)
  return col
}

function nextRow(state: GraphState, sk: string): number {
  const freed = state.freedRows.get(sk)
  if (freed && freed.length > 0) {
    // FIFO: reuse earliest freed slot to keep apparent ordering stable.
    return freed.shift() as number
  }
  const row = state.rowsInCol.get(sk) ?? 0
  state.rowsInCol.set(sk, row + 1)
  return row
}

function freeRow(state: GraphState, sk: string, row: number): void {
  let arr = state.freedRows.get(sk)
  if (!arr) {
    arr = []
    state.freedRows.set(sk, arr)
  }
  arr.push(row)
  arr.sort((a, b) => a - b)
}

function rowsOccupied(state: GraphState, sk: string): number {
  const allocated = state.rowsInCol.get(sk) ?? 0
  const freed = state.freedRows.get(sk)?.length ?? 0
  return allocated - freed
}

function shortLabel(full: string): string {
  if (full.length <= 28) return full
  const lastDot = full.lastIndexOf('.')
  if (lastDot > 0 && lastDot < full.length - 1) return '...' + full.slice(lastDot)
  return full.slice(0, 28) + '...'
}

function groupId(sk: string): string {
  return `group::${sk}`
}

function ensureGroupNode(state: GraphState, appId: string, scope: string): string {
  const sk = scopeKey(appId, scope)
  const gid = groupId(sk)
  const existing = state.nodes.get(gid)
  if (existing) return gid

  getColumn(state, sk)
  const initialH = HEADER_H + PAD_TOP + PAD_BOTTOM

  // Position is a placeholder; relayoutGroups() computes the final x/y per batch.
  const node: Node<ScopeGroupData> = {
    id: gid,
    type: 'scope-group',
    position: { x: 0, y: 0 },
    width: GROUP_W,
    height: initialH,
    style: { width: GROUP_W, height: initialH },
    selectable: true,
    draggable: true,
    data: {
      appId,
      scope,
      childCount: 0,
    },
  }
  state.nodes.set(gid, node)
  state.groupHeights.set(sk, initialH)
  return gid
}

function ensureFnNode(
  state: GraphState,
  id: string,
  appId: string,
  scope: string,
  firedAt: number,
  source: 'by' | 'target',
): Node<CallNodeData> {
  const existing = state.nodes.get(id) as Node<CallNodeData> | undefined

  if (existing) {
    const data = existing.data
    // Reassignment: node was previously placed tentatively (came in only as a target).
    // Now it's being claimed as `by` from another scope - that's its real home.
    if (source === 'by' && !data.lockedScope && data.scope !== scope) {
      return reassignFnNode(state, existing, appId, scope)
    }
    // First by-reference seals the scope so future target-references can't move it.
    if (source === 'by' && !data.lockedScope) {
      state.nodes.set(id, {
        ...existing,
        data: { ...data, lockedScope: true },
      })
    }
    return existing
  }

  const sk = scopeKey(appId, scope)
  ensureGroupNode(state, appId, scope)
  const row = nextRow(state, sk)
  state.nodeRow.set(id, row)

  const node: Node<CallNodeData> = {
    id,
    type: 'call',
    parentId: groupId(sk),
    extent: 'parent',
    position: { x: NODE_X_INSIDE, y: HEADER_H + PAD_TOP + row * ROW_H },
    data: {
      label: shortLabel(id),
      full: id,
      scope,
      appId,
      firedAt,
      callCount: 0,
      isFnNode: true,
      lockedScope: source === 'by',
      counts: { log: 0, info: 0, warn: 0, error: 0, debug: 0 },
      lastMessage: '',
      lastLevel: '',
    },
  }
  state.nodes.set(id, node)
  return node
}

function reassignFnNode(
  state: GraphState,
  node: Node<CallNodeData>,
  appId: string,
  newScope: string,
): Node<CallNodeData> {
  // Free the vacated row in the old scope so later tentative nodes recycle it.
  const oldSk = scopeKey(node.data.appId, node.data.scope)
  const oldRow = state.nodeRow.get(node.id)
  if (oldRow != null) freeRow(state, oldSk, oldRow)

  ensureGroupNode(state, appId, newScope)
  const sk = scopeKey(appId, newScope)
  const row = nextRow(state, sk)
  state.nodeRow.set(node.id, row)

  const updated: Node<CallNodeData> = {
    ...node,
    parentId: groupId(sk),
    extent: 'parent',
    position: { x: NODE_X_INSIDE, y: HEADER_H + PAD_TOP + row * ROW_H },
    data: {
      ...node.data,
      scope: newScope,
      appId,
      lockedScope: true,
    },
  }
  state.nodes.set(node.id, updated)
  return updated
}

function ensureScopeNode(
  state: GraphState,
  appId: string,
  scope: string,
  firedAt: number,
): Node<CallNodeData> {
  const sk = scopeKey(appId, scope)
  const id = `scope::${sk}`
  const existing = state.nodes.get(id)
  if (existing) return existing as Node<CallNodeData>

  ensureGroupNode(state, appId, scope)
  const row = nextRow(state, sk)
  state.nodeRow.set(id, row)

  const node: Node<CallNodeData> = {
    id,
    type: 'call',
    parentId: groupId(sk),
    extent: 'parent',
    position: { x: NODE_X_INSIDE, y: HEADER_H + PAD_TOP + row * ROW_H },
    data: {
      label: 'events',
      full: scope || 'unscoped',
      scope,
      appId,
      firedAt,
      callCount: 0,
      isFnNode: false,
      lockedScope: true,
      counts: { log: 0, info: 0, warn: 0, error: 0, debug: 0 },
      lastMessage: '',
      lastLevel: '',
    },
  }
  state.nodes.set(id, node)
  return node
}

function bumpNode(
  state: GraphState,
  id: string,
  firedAt: number,
  patch: { incCall?: boolean; level?: LogLevel; message?: string } = {},
): void {
  const prev = state.nodes.get(id) as Node<CallNodeData> | undefined
  if (!prev) return
  const counts = { ...prev.data.counts }
  if (patch.level) counts[patch.level] = (counts[patch.level] ?? 0) + 1
  state.nodes.set(id, {
    ...prev,
    data: {
      ...prev.data,
      firedAt,
      callCount: prev.data.callCount + (patch.incCall ? 1 : 0),
      counts,
      lastMessage: patch.message ?? prev.data.lastMessage,
      lastLevel: patch.level ?? prev.data.lastLevel,
    },
  })
}

// recentFires only feeds in-flight rendering now - arrived packages are
// drawn separately as a static pile from the persistent edge `count`. Window
// is just past the longest possible flight (MAX_FLIGHT_MS=8000 in CallEdge)
// so in-flight items survive their full animation before eviction.
const MAX_PACKAGES_PER_EDGE = 24
const PACKAGE_VISIBLE_MS    = 9000

function bumpEdge(
  state: GraphState,
  byId: string,
  targetId: string,
  firedAt: number,
  hasArgs: boolean,
): void {
  const id = `${byId}=>${targetId}`
  const existing = state.edges.get(id)

  let recentFires: number[]
  // Bursty exec streams can produce many fires within the same millisecond
  // so timestamps collide. Nudge by 1ms until unique within the window so
  // downstream React keys (firedAt) stay unique.
  let uniqueFiredAt = firedAt
  if (existing?.data) {
    recentFires = (existing.data.recentFires ?? []).filter(
      (t) => firedAt - t < PACKAGE_VISIBLE_MS,
    )
    while (recentFires.includes(uniqueFiredAt)) uniqueFiredAt++
    recentFires.push(uniqueFiredAt)
    if (recentFires.length > MAX_PACKAGES_PER_EDGE) {
      recentFires = recentFires.slice(-MAX_PACKAGES_PER_EDGE)
    }
  } else {
    recentFires = [uniqueFiredAt]
  }

  if (existing) {
    state.edges.set(id, {
      ...existing,
      data: {
        firedAt,
        count: (existing.data?.count ?? 0) + 1,
        // Sticky-or: once an edge has carried args, keep showing the package
        // glyph on every fire. Drops back to false only if it was always
        // arg-less, which is the meaningful distinction.
        hasArgs: (existing.data?.hasArgs ?? false) || hasArgs,
        recentFires,
      },
    })
    return
  }
  state.edges.set(id, {
    id,
    source: byId,
    target: targetId,
    type: 'call',
    data: { firedAt, count: 1, hasArgs, recentFires },
  })
}

function resizeGroups(state: GraphState): void {
  for (const sk of state.scopeCols.keys()) {
    // Use the highest still-occupied row index + 1 so groups shrink as rows are freed.
    const allocated = state.rowsInCol.get(sk) ?? 0
    const freed = state.freedRows.get(sk) ?? []
    let highestOccupied = -1
    for (let r = allocated - 1; r >= 0; r--) {
      if (!freed.includes(r)) { highestOccupied = r; break }
    }
    const rows = highestOccupied + 1
    const newH = HEADER_H + PAD_TOP + Math.max(rows, 1) * ROW_H + PAD_BOTTOM
    const prevH = state.groupHeights.get(sk) ?? -1
    const gid = groupId(sk)
    const prevNode = state.nodes.get(gid) as Node<ScopeGroupData> | undefined
    if (!prevNode) continue

    const visibleChildren = rowsOccupied(state, sk)
    if (newH !== prevH || visibleChildren !== prevNode.data.childCount) {
      state.nodes.set(gid, {
        ...prevNode,
        width: GROUP_W,
        height: newH,
        style: { width: GROUP_W, height: newH },
        data: { ...prevNode.data, childCount: visibleChildren },
      })
      state.groupHeights.set(sk, newH)
    }
  }
}

// Shelf-pack groups into a grid: COLS_PER_ROW per row, each row's height = tallest group in that row.
function relayoutGroups(state: GraphState): void {
  const entries: Array<[string, number]> = []
  for (const [sk, col] of state.scopeCols) entries.push([sk, col])
  entries.sort((a, b) => a[1] - b[1])

  // Pass 1: row heights.
  const rowMaxH: number[] = []
  for (const [sk, col] of entries) {
    const row = Math.floor(col / COLS_PER_ROW)
    const h = state.groupHeights.get(sk) ?? (HEADER_H + PAD_TOP + PAD_BOTTOM)
    rowMaxH[row] = Math.max(rowMaxH[row] ?? 0, h)
  }

  // Pass 2: cumulative y per row.
  const rowY: number[] = [0]
  for (let r = 1; r < rowMaxH.length; r++) {
    rowY[r] = rowY[r - 1] + (rowMaxH[r - 1] ?? 0) + GROUP_GAP_Y
  }

  // Pass 3: apply positions to group nodes.
  for (const [sk, col] of entries) {
    const row = Math.floor(col / COLS_PER_ROW)
    const colInRow = col % COLS_PER_ROW
    const x = colInRow * COL_STRIDE
    const y = rowY[row] ?? 0
    const gid = groupId(sk)
    const prev = state.nodes.get(gid) as Node<ScopeGroupData> | undefined
    if (!prev) continue
    if (prev.position.x === x && prev.position.y === y) continue
    state.nodes.set(gid, { ...prev, position: { x, y } })
  }
}

function processItem(item: StreamItem, state: GraphState): void {
  const { appId, entry } = item
  const scope = entry.scope ?? ''
  const firedAt = entry.timestamp || Date.now()

  const parsed = parseExec(entry)

  if (parsed && parsed.target) {
    // Insert caller first so it sits ABOVE the callee in fresh chains - arrows then flow top -> down.
    if (parsed.by) {
      ensureFnNode(state, parsed.by, appId, scope, firedAt, 'by')
    }

    const targetId = parsed.target
    ensureFnNode(state, targetId, appId, scope, firedAt, 'target')
    bumpNode(state, targetId, firedAt, { incCall: true })

    if (parsed.by) {
      bumpEdge(state, parsed.by, targetId, firedAt, parsed.hasArgs)
    }
    return
  }

  ensureScopeNode(state, appId, scope, firedAt)
  const sid = `scope::${scopeKey(appId, scope)}`
  const message = entry.args
    .map((a) => (typeof a === 'string' ? a : safeStringify(a)))
    .join(' ')
  bumpNode(state, sid, firedAt, { level: entry.level, message })
}

function safeStringify(v: unknown): string {
  try { return JSON.stringify(v) } catch { return String(v) }
}

interface CallGraphResult {
  nodes: AnyGraphNode[]
  edges: Edge<CallEdgeData>[]
  scopeCount: number
  nodeCount: number
  edgeCount: number
}

export function useCallGraph(entries: StreamItem[]): CallGraphResult {
  const stateRef = useRef<GraphState>(makeFreshState())
  const [, setTick] = useState(0)

  useEffect(() => {
    const s = stateRef.current
    if (entries.length < s.lastProcessedIndex) {
      stateRef.current = makeFreshState()
      setTick((t) => t + 1)
      return
    }
    if (entries.length === s.lastProcessedIndex) return

    const fresh = entries.slice(s.lastProcessedIndex)
    for (const item of fresh) processItem(item, s)
    resizeGroups(s)
    relayoutGroups(s)
    s.lastProcessedIndex = entries.length
    setTick((t) => t + 1)
  }, [entries])

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 300)
    return () => window.clearInterval(id)
  }, [])

  const now = Date.now()
  const HOT_WINDOW = 3000

  // React Flow v12 requires parent nodes (groups) to appear BEFORE their
  // children in the array - otherwise "Parent node X not found" warnings
  // spam the console every commit. Map insertion order doesn't guarantee
  // this after reassignFnNode() inserts a new group whose child was already
  // in the map. Emit all groups first, then children, regardless of order.
  const nodes: AnyGraphNode[] = []
  const childNodes: AnyGraphNode[] = []
  for (const n of stateRef.current.nodes.values()) {
    if (n.type === 'scope-group') nodes.push(n)
    else childNodes.push(n)
  }
  for (const n of childNodes) nodes.push(n)

  const edges: Edge<CallEdgeData>[] = []
  for (const e of stateRef.current.edges.values()) {
    const isHot = now - (e.data?.firedAt ?? 0) < HOT_WINDOW
    const markerColor = isHot ? 'var(--color-success)' : 'var(--color-neutral)'
    const rawFires = e.data?.recentFires ?? []
    const visibleFires = rawFires.filter((t) => now - t < PACKAGE_VISIBLE_MS)
    edges.push({
      ...e,
      animated: isHot,
      className: isHot ? 'is-hot' : '',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: markerColor,
      },
      data: {
        firedAt: e.data?.firedAt ?? 0,
        count: e.data?.count ?? 0,
        hasArgs: e.data?.hasArgs ?? false,
        recentFires: visibleFires,
      },
    })
  }

  let fnNodeCount = 0
  for (const n of nodes) if (n.type === 'call') fnNodeCount += 1

  return {
    nodes,
    edges,
    scopeCount: stateRef.current.scopeCols.size,
    nodeCount: fnNodeCount,
    edgeCount: edges.length,
  }
}
