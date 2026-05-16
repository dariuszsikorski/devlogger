// @purpose Tree layout - dagre top-down hierarchical. Drops scope-group containers.
import dagre from '@dagrejs/dagre'
import type { LayoutFn } from './types'
import { NODE_W, NODE_H } from './types'

export const layoutTree: LayoutFn = ({ nodes, edges }) => {
  // Drop scope containers AND the synthetic scope-aggregate "events" nodes
  // (they have no edges and would float as orphans cluttering the tree).
  const fnNodes = nodes.filter(
    (n) => n.type === 'call' && (n.data as { isFnNode?: boolean }).isFnNode === true,
  )

  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: 'TB',
    nodesep: 36,
    ranksep: 80,
    marginx: 24,
    marginy: 24,
  })
  g.setDefaultEdgeLabel(() => ({}))

  for (const n of fnNodes) {
    g.setNode(n.id, { width: NODE_W, height: NODE_H })
  }
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.setEdge(e.source, e.target)
    }
  }

  dagre.layout(g)

  // Dagre returns center-of-node coords; convert to top-left for RF.
  const out = fnNodes.map((n) => {
    const p = g.node(n.id)
    return {
      ...n,
      parentId: undefined,
      extent: undefined,
      position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
    }
  })

  return { nodes: out, edges }
}
