// @purpose Lanes layout - each scope becomes a horizontal swim-lane stacked vertically.
// Functions inside a lane are arranged left to right by insertion order.
import type { LayoutFn, GraphNode } from './types'
import type { Node } from '@xyflow/react'
import type { CallNodeData } from '../hooks/useCallGraph'
import type { ScopeGroupData } from '../components/ScopeGroup'

const NODE_W       = 220
const NODE_H       = 70
const LANE_HEADER  = 30
const LANE_TOP_PAD = 18
const LANE_BOT_PAD = 18
const LANE_LEFT    = 16
const LANE_GAP_X   = 24
const LANE_GAP_Y   = 24

export const layoutLanes: LayoutFn = ({ nodes, edges }) => {
  const byScope = new Map<string, Node<CallNodeData>[]>()
  const scopeAppId = new Map<string, string>()

  for (const n of nodes) {
    if (n.type !== 'call') continue
    const d = n.data as CallNodeData
    if (!byScope.has(d.scope)) byScope.set(d.scope, [])
    byScope.get(d.scope)!.push(n as Node<CallNodeData>)
    if (!scopeAppId.has(d.scope)) scopeAppId.set(d.scope, d.appId)
  }

  // Stable lane order = first-seen scope order from input.
  const laneOrder: string[] = []
  for (const n of nodes) {
    if (n.type !== 'call') continue
    const s = (n.data as CallNodeData).scope
    if (!laneOrder.includes(s)) laneOrder.push(s)
  }

  const out: GraphNode[] = []
  let cursorY = 0

  for (const scope of laneOrder) {
    const fns = byScope.get(scope) ?? []
    const laneId = `lane::${scope || '_unscoped'}`
    const laneW = Math.max(fns.length * NODE_W + (fns.length - 1) * LANE_GAP_X + LANE_LEFT * 2, 320)
    const laneH = LANE_HEADER + LANE_TOP_PAD + NODE_H + LANE_BOT_PAD

    const laneNode: Node<ScopeGroupData> = {
      id: laneId,
      type: 'scope-group',
      position: { x: 0, y: cursorY },
      width: laneW,
      height: laneH,
      style: { width: laneW, height: laneH },
      selectable: true,
      draggable: true,
      data: {
        appId: scopeAppId.get(scope) ?? '',
        scope,
        childCount: fns.length,
      },
    }
    out.push(laneNode)

    for (let i = 0; i < fns.length; i++) {
      const fn = fns[i]
      out.push({
        ...fn,
        parentId: laneId,
        extent: 'parent',
        position: {
          x: LANE_LEFT + i * (NODE_W + LANE_GAP_X),
          y: LANE_HEADER + LANE_TOP_PAD,
        },
      })
    }

    cursorY += laneH + LANE_GAP_Y
  }

  return { nodes: out, edges }
}
