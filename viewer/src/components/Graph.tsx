// @purpose Live call-chain visualization via React Flow - shows scopes, functions and call edges.
// Layout (grouped/tree/lanes/radial) is selectable via the LayoutSwitch sub-tab bar.
import { useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  type Edge,
  type DefaultEdgeOptions,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CallNode } from './CallNode'
import { ScopeGroup } from './ScopeGroup'
import { CallEdge } from './CallEdge'
import { LayoutSwitch } from './LayoutSwitch'
import { useCallGraph, type CallEdgeData } from '../hooks/useCallGraph'
import { applyLayout, type LayoutKey } from '../layouts'
import type { GraphNode } from '../layouts/types'
import type { StreamItem } from '../types'

const nodeTypes = { call: CallNode, 'scope-group': ScopeGroup }
const edgeTypes = { call: CallEdge }

interface GraphProps {
  entries: StreamItem[]
}

export function Graph({ entries }: GraphProps) {
  const { nodes: rawNodes, edges: rawEdges, nodeCount, edgeCount, scopeCount } = useCallGraph(entries)
  const [layoutKey, setLayoutKey] = useState<LayoutKey>('grouped')

  // Recompute every render so live data + layout transform stays in sync.
  // The transforms are cheap (linear in nodes/edges) so memoization keyed on
  // identity is enough; we don't need deeper equality.
  const { nodes, edges } = useMemo(
    () => applyLayout(layoutKey, { nodes: rawNodes, edges: rawEdges }),
    [rawNodes, rawEdges, layoutKey],
  )

  const isEmpty = nodeCount === 0

  const proOptions = useMemo(() => ({ hideAttribution: true }), [])
  const defaultEdgeOptions = useMemo<DefaultEdgeOptions>(
    () => ({ type: 'call', animated: false }),
    [],
  )

  return (
    <div className="Graph">
      <ReactFlow<GraphNode, Edge<CallEdgeData>>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={proOptions}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.15}
        maxZoom={2}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.4} />
        <MiniMap pannable zoomable nodeStrokeWidth={3} />
        <Controls showInteractive={false} />

        <Panel position="top-left" className="Graph_panel">
          <span className="Graph_panelMetric">
            <span className="Graph_panelLabel">scopes</span>
            <span className="Graph_panelValue">{scopeCount}</span>
          </span>
          <span className="Graph_panelMetric">
            <span className="Graph_panelLabel">nodes</span>
            <span className="Graph_panelValue">{nodeCount}</span>
          </span>
          <span className="Graph_panelMetric">
            <span className="Graph_panelLabel">edges</span>
            <span className="Graph_panelValue">{edgeCount}</span>
          </span>
        </Panel>

        <Panel position="top-right" className="Graph_layoutPanel">
          <LayoutSwitch value={layoutKey} onChange={setLayoutKey} />
        </Panel>
      </ReactFlow>
      {isEmpty && (
        <div className="Graph_empty">
          <p>
            Waiting for <code>log.exec({'{'} by, target {'}'})</code> calls...
          </p>
          <p className="Graph_emptyHint">
            Once an exec entry arrives, its caller and target appear here, connected by a pulsing edge.
          </p>
        </div>
      )}
    </div>
  )
}
