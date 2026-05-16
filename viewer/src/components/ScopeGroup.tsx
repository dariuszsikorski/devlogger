// @purpose Custom React Flow group container - frames all nodes that share a scope.
import { memo } from 'react'
import type { NodeProps, Node } from '@xyflow/react'

export interface ScopeGroupData {
  appId: string
  scope: string
  childCount: number
  [key: string]: unknown
}

type ScopeGroupNode = Node<ScopeGroupData, 'scope-group'>

function ScopeGroupImpl({ data }: NodeProps<ScopeGroupNode>) {
  const title = data.scope || 'unscoped'

  return (
    <div className="ScopeGroup">
      <div className="ScopeGroup_header">
        <span className="ScopeGroup_dot" aria-hidden="true" />
        <span className="ScopeGroup_title" title={`${data.appId} / ${title}`}>
          {title}
        </span>
        <span className="ScopeGroup_count" title={`${data.childCount} nodes`}>
          {data.childCount}
        </span>
      </div>
    </div>
  )
}

export const ScopeGroup = memo(ScopeGroupImpl)
