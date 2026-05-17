// @purpose Live call-chain visualization via React Flow - shows scopes, functions and call edges.
// Layout (grouped/tree/lanes/radial) is selectable via the LayoutSwitch sub-tab bar.
// Side panels (left/right) are collapsible shells - content can be filled by callers.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  type Edge,
  type DefaultEdgeOptions,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CallNode } from './CallNode'
import { ScopeGroup } from './ScopeGroup'
import { CallEdge } from './CallEdge'
import { LayoutSwitch } from './LayoutSwitch'
import { PayloadSidebar } from './PayloadSidebar'
import { EdgeSelectionContext } from './EdgeSelectionContext'
import { useCallGraph, type CallEdgeData } from '../hooks/useCallGraph'
import { applyLayout, type LayoutKey } from '../layouts'
import type { GraphNode } from '../layouts/types'
import type { StreamItem } from '../types'
import { formatGap } from '../utils/format'

// Mirror of Stream.tsx GAP_THRESHOLD_MS - przy tym progu graph oznacza
// idle:Xs jako "stale" (data-stale="true"), zeby cisza byla subtelnie widoczna.
const GRAPH_IDLE_THRESHOLD_MS = 5000

const nodeTypes = { call: CallNode, 'scope-group': ScopeGroup }
const edgeTypes = { call: CallEdge }

interface GraphProps {
  entries: StreamItem[]
  /** Optional content for the left collapsible side panel. */
  leftPanel?: ReactNode
  /** Optional content for the right collapsible side panel. */
  rightPanel?: ReactNode
}

interface SidePanelProps {
  side: 'left' | 'right'
  open: boolean
  onToggle: () => void
  children?: ReactNode
}

function SidePanel({ side, open, onToggle, children }: SidePanelProps) {
  // Toggle icon points toward the action: when open the chevron points away
  // from canvas (will collapse outward); when closed it points toward canvas.
  const collapseIcon = side === 'left' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />
  const expandIcon = side === 'left' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />
  return (
    <aside
      className={`Graph_sidePanel is-${side}`}
      data-open={open ? 'true' : 'false'}
    >
      <button
        type="button"
        className="Graph_sidePanelToggle"
        onClick={onToggle}
        aria-label={open ? 'collapse panel' : 'expand panel'}
        aria-expanded={open}
      >
        {open ? collapseIcon : expandIcon}
      </button>
      <div className="Graph_sidePanelContent" aria-hidden={!open}>{children}</div>
    </aside>
  )
}

export function Graph({ entries, leftPanel, rightPanel }: GraphProps) {
  const { nodes: rawNodes, edges: rawEdges, nodeCount, edgeCount, scopeCount } = useCallGraph(entries)
  const [layoutKey, setLayoutKey] = useState<LayoutKey>('grouped')
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  // Auto-open the right panel on edge selection. We DON'T auto-close when the
  // user picks a different edge - feels more stable. They can still toggle it.
  const selectEdge = useCallback((id: string | null) => {
    setSelectedEdgeId(id)
    if (id) setRightOpen(true)
  }, [])

  const selectionValue = useMemo(
    () => ({ selectedEdgeId, selectEdge }),
    [selectedEdgeId, selectEdge],
  )

  // If the selected edge disappears (graph reset / gap clear), drop selection
  // so the sidebar doesn't keep stale source/target labels.
  useEffect(() => {
    if (!selectedEdgeId) return
    const stillExists = rawEdges.some((e) => e.id === selectedEdgeId)
    if (!stillExists) setSelectedEdgeId(null)
  }, [rawEdges, selectedEdgeId])

  const selectedEdge = useMemo<Edge<CallEdgeData> | null>(
    () => rawEdges.find((e) => e.id === selectedEdgeId) ?? null,
    [rawEdges, selectedEdgeId],
  )

  // Recompute every render so live data + layout transform stays in sync.
  // The transforms are cheap (linear in nodes/edges) so memoization keyed on
  // identity is enough; we don't need deeper equality.
  const { nodes, edges } = useMemo(
    () => applyLayout(layoutKey, { nodes: rawNodes, edges: rawEdges }),
    [rawNodes, rawEdges, layoutKey],
  )

  const isEmpty = nodeCount === 0

  // useCallGraph wewnetrznie tickuje co 300ms (setTick), wiec ten odczyt
  // odswieza sie sam bez dodatkowego interval'a tutaj.
  const lastEventAt = entries.length > 0 ? entries[entries.length - 1].entry.timestamp : 0
  const idleMs = lastEventAt > 0 ? Date.now() - lastEventAt : 0
  const isStale = lastEventAt > 0 && idleMs >= GRAPH_IDLE_THRESHOLD_MS

  const proOptions = useMemo(() => ({ hideAttribution: true }), [])
  const defaultEdgeOptions = useMemo<DefaultEdgeOptions>(
    () => ({ type: 'call', animated: false }),
    [],
  )

  // External rightPanel (if provided) wins over the built-in payload inspector.
  // Lets future callers swap in their own content without losing the toggle UI.
  const rightContent: ReactNode = rightPanel ?? (
    <PayloadSidebar edge={selectedEdge} onClose={() => setSelectedEdgeId(null)} />
  )

  return (
    <EdgeSelectionContext.Provider value={selectionValue}>
    <div className="Graph">
      <SidePanel side="left"  open={leftOpen}  onToggle={() => setLeftOpen((o) => !o)}>
        {leftPanel}
      </SidePanel>
      <div className="Graph_canvas">
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
            {lastEventAt > 0 && (
              <span className="Graph_panelMetric" data-stale={isStale ? 'true' : 'false'}>
                <span className="Graph_panelLabel">idle</span>
                <span className="Graph_panelValue">{formatGap(idleMs)}</span>
              </span>
            )}
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
      <SidePanel side="right" open={rightOpen} onToggle={() => setRightOpen((o) => !o)}>
        {rightContent}
      </SidePanel>
    </div>
    </EdgeSelectionContext.Provider>
  )
}
