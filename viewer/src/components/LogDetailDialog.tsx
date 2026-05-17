// @purpose Detail view for a single non-exec log entry. Args are rendered with JsonTree
// if structured (object/array), otherwise as preformatted text. Reuses shared Dialog chrome.
import { Fragment } from 'react'
import { Dialog } from './Dialog'
import { JsonTree } from './JsonTree'
import { formatTime } from '../utils/format'
import type { StreamItem } from '../types'

interface LogDetailDialogProps {
  item: StreamItem | null
  onClose: () => void
}

function isStructured(v: unknown): boolean {
  if (v === null || v === undefined) return false
  return typeof v === 'object'
}

export function LogDetailDialog({ item, onClose }: LogDetailDialogProps) {
  const isOpen = item != null
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onClose() }}
      title={
        <span className="LogDetailDialog_route">
          <span className="LogDetailDialog_level" data-level={item?.entry.level}>
            {item?.entry.level}
          </span>
          <span className="LogDetailDialog_app">{item?.appId}</span>
          {item?.entry.scope && <span className="LogDetailDialog_scope">[{item.entry.scope}]</span>}
        </span>
      }
      subtitle={item ? <span>{formatTime(item.entry.timestamp)}</span> : null}
      className="LogDetailDialog"
    >
      {item && (
        <div className="LogDetailDialog_body">
          {item.entry.args.map((arg, i) => (
            <Fragment key={i}>
              {isStructured(arg) ? (
                <section className="LogDetailDialog_section">
                  <div className="LogDetailDialog_label">arg {i} (object)</div>
                  <JsonTree value={arg} defaultExpandDepth={-1} />
                </section>
              ) : (
                <section className="LogDetailDialog_section">
                  <div className="LogDetailDialog_label">arg {i} ({typeof arg})</div>
                  <pre className="LogDetailDialog_text">{String(arg)}</pre>
                </section>
              )}
            </Fragment>
          ))}
        </div>
      )}
    </Dialog>
  )
}
