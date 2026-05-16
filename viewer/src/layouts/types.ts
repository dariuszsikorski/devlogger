// @purpose Shared types for graph layout transforms.
import type { Edge, Node } from '@xyflow/react'
import type { CallNodeData, CallEdgeData } from '../hooks/useCallGraph'
import type { ScopeGroupData } from '../components/ScopeGroup'

export type GraphNode = Node<CallNodeData> | Node<ScopeGroupData>

export interface LayoutInput {
  nodes: GraphNode[]
  edges: Edge<CallEdgeData>[]
}

export interface LayoutOutput {
  nodes: GraphNode[]
  edges: Edge<CallEdgeData>[]
}

export type LayoutFn = (input: LayoutInput) => LayoutOutput

export type LayoutKey = 'grouped' | 'tree' | 'lanes' | 'radial'

// Reused node-card dimensions across non-grouped layouts.
export const NODE_W = 220
export const NODE_H = 70
