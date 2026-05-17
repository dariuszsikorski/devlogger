// @purpose Full-detail view for a single captured payload. Opens from the sidebar
// list and shows everything that didn't fit in the narrow column - the routed
// call header, full timestamp, scope, and the args object expanded by default.
import { ArrowRight } from 'lucide-react'
import { Dialog } from './Dialog'
import { JsonTree } from './JsonTree'
import { formatTime } from '../utils/format'
import type { EdgePayload } from '../hooks/useCallGraph'

interface PayloadDetailDialogProps {
  payload: EdgePayload | null
  source: string
  target: string
  onClose: () => void
}

export function PayloadDetailDialog({ payload, source, target, onClose }: PayloadDetailDialogProps) {
  const isOpen = payload != null
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onClose() }}
      title={
        <span className="PayloadDetailDialog_route">
          <span className="PayloadDetailDialog_routeNode">{source}</span>
          <ArrowRight size={14} className="PayloadDetailDialog_routeArrow" />
          <span className="PayloadDetailDialog_routeNode">{target}</span>
        </span>
      }
      subtitle={payload ? (
        <span>
          {formatTime(payload.timestamp)}
          {payload.scope ? <> &middot; scope <code>{payload.scope}</code></> : null}
        </span>
      ) : null}
      className="PayloadDetailDialog"
    >
      {payload && (
        <div className="PayloadDetailDialog_body">
          {payload.head && (
            <section className="PayloadDetailDialog_section">
              <div className="PayloadDetailDialog_label">message</div>
              <pre className="PayloadDetailDialog_head">{payload.head}</pre>
            </section>
          )}

          <section className="PayloadDetailDialog_section">
            <div className="PayloadDetailDialog_label">arguments</div>
            {payload.hasArgs ? (
              <JsonTree value={payload.args} defaultExpandDepth={-1} />
            ) : (
              <div className="PayloadDetailDialog_noArgs">No args were attached to this call.</div>
            )}
          </section>
        </div>
      )}
    </Dialog>
  )
}
