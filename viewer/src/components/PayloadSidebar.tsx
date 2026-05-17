// @purpose Right-side payload inspector - opens when a call-edge pile is clicked.
// Lists every captured fire through the selected edge, newest first, with a compact
// JsonTree preview. Clicking an entry opens the full-detail dialog.
import { useMemo, useState } from 'react'
import { Button } from 'react-aria-components'
import { ArrowRight, ChevronRight, X } from 'lucide-react'
import type { Edge } from '@xyflow/react'
import type { CallEdgeData, EdgePayload } from '../hooks/useCallGraph'
import { JsonTree } from './JsonTree'
import { PayloadDetailDialog } from './PayloadDetailDialog'
import { formatTime } from '../utils/format'

interface PayloadSidebarProps {
  edge: Edge<CallEdgeData> | null
  /** Callback to clear selection (e.g. via close button). */
  onClose: () => void
}

export function PayloadSidebar({ edge, onClose }: PayloadSidebarProps) {
  const [openPayloadId, setOpenPayloadId] = useState<number | null>(null)

  // Newest first feels more useful for live debugging - last fires sit at top.
  const payloads = useMemo<EdgePayload[]>(() => {
    const raw = edge?.data?.payloads ?? []
    return raw.slice().reverse()
  }, [edge])

  if (!edge) {
    return (
      <div className="PayloadSidebar is-empty">
        <p className="PayloadSidebar_hint">
          Click a parcel pile on any call-edge to inspect what was sent through it.
        </p>
      </div>
    )
  }

  const source = String(edge.source)
  const target = String(edge.target)
  const totalCount = edge.data?.count ?? payloads.length
  const detailPayload = openPayloadId != null
    ? payloads.find((p) => p.firedAt === openPayloadId) ?? null
    : null

  return (
    <div className="PayloadSidebar">
      <header className="PayloadSidebar_header">
        <div className="PayloadSidebar_titleRow">
          <h3 className="PayloadSidebar_title">Payloads</h3>
          <Button
            className="PayloadSidebar_close"
            onPress={onClose}
            aria-label="close payload inspector"
          >
            <X size={14} />
          </Button>
        </div>
        <div className="PayloadSidebar_route" title={`${source} -> ${target}`}>
          <span className="PayloadSidebar_routeNode">{source}</span>
          <ArrowRight size={12} className="PayloadSidebar_routeArrow" />
          <span className="PayloadSidebar_routeNode">{target}</span>
        </div>
        <div className="PayloadSidebar_meta">
          <span>{payloads.length} captured</span>
          {totalCount > payloads.length && (
            <span className="PayloadSidebar_metaDim">of {totalCount} total</span>
          )}
        </div>
      </header>

      <ul className="PayloadSidebar_list">
        {payloads.length === 0 && (
          <li className="PayloadSidebar_empty">No payloads captured on this edge.</li>
        )}
        {payloads.map((p) => (
          <li key={p.firedAt} className="PayloadSidebar_item" data-has-args={p.hasArgs ? 'true' : 'false'}>
            <button
              type="button"
              className="PayloadSidebar_itemMain"
              onClick={() => setOpenPayloadId(p.firedAt)}
              aria-label="open payload details"
            >
              <div className="PayloadSidebar_itemHead">
                <span className="PayloadSidebar_itemTime">{formatTime(p.timestamp)}</span>
                {p.scope && <span className="PayloadSidebar_itemScope" title={p.scope}>{p.scope}</span>}
                <ChevronRight size={12} className="PayloadSidebar_itemChevron" />
              </div>
              <div className="PayloadSidebar_itemPreview">
                {p.hasArgs ? (
                  <JsonTree value={p.args} defaultExpandDepth={1} compact />
                ) : (
                  <span className="PayloadSidebar_noArgs">no args</span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <PayloadDetailDialog
        payload={detailPayload}
        source={source}
        target={target}
        onClose={() => setOpenPayloadId(null)}
      />
    </div>
  )
}
