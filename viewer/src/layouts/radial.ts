// @purpose Radial layout - root(s) in the center, BFS depth becomes ring index.
// Pure trigonometry, no external deps. Drops scope-group containers.
import type { LayoutFn } from './types'
import { NODE_W, NODE_H } from './types'

const RING_R0   = 0     // root sits at center
const RING_STEP = 220   // distance between rings

export const layoutRadial: LayoutFn = ({ nodes, edges }) => {
  // Drop scope-aggregate events nodes - they have no edges and would all
  // become "roots" piled at the same center ring.
  const fnNodes = nodes.filter(
    (n) => n.type === 'call' && (n.data as { isFnNode?: boolean }).isFnNode === true,
  )

  // Build adjacency. Roots = nodes with no incoming edges.
  const incoming = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const n of fnNodes) {
    incoming.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of edges) {
    if (!incoming.has(e.target) || !adj.has(e.source)) continue
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1)
    adj.get(e.source)!.push(e.target)
  }

  const roots: string[] = []
  for (const [id, inc] of incoming) if (inc === 0) roots.push(id)

  // BFS layers. Nodes not reached from any root land in their own deepest layer.
  const depth = new Map<string, number>()
  const queue: string[] = []
  for (const r of roots) { depth.set(r, 0); queue.push(r) }
  while (queue.length > 0) {
    const id = queue.shift()!
    const d = depth.get(id)!
    for (const c of adj.get(id) ?? []) {
      if (depth.has(c)) continue
      depth.set(c, d + 1)
      queue.push(c)
    }
  }
  // Catch-all for orphans / cycles.
  let maxD = 0
  for (const d of depth.values()) if (d > maxD) maxD = d
  for (const n of fnNodes) {
    if (!depth.has(n.id)) depth.set(n.id, maxD + 1)
  }

  // Bucket by depth then place on a circle. Root depth=0 -> single point at origin.
  const layers = new Map<number, string[]>()
  for (const [id, d] of depth) {
    if (!layers.has(d)) layers.set(d, [])
    layers.get(d)!.push(id)
  }

  const positions = new Map<string, { x: number; y: number }>()
  for (const [d, ids] of layers) {
    if (d === 0 && ids.length === 1) {
      positions.set(ids[0], { x: 0, y: 0 })
      continue
    }
    const r = d === 0 ? RING_STEP * 0.5 : RING_R0 + d * RING_STEP
    const n = ids.length
    for (let i = 0; i < n; i++) {
      // -PI/2 so the first node sits at the top.
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2
      positions.set(ids[i], {
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
      })
    }
  }

  const out = fnNodes.map((n) => {
    const p = positions.get(n.id) ?? { x: 0, y: 0 }
    return {
      ...n,
      parentId: undefined,
      extent: undefined,
      position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
    }
  })

  return { nodes: out, edges }
}
