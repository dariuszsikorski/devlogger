// @purpose Shares the currently selected call-edge id between the deeply nested
// ArrivedPile (inside CallEdge) and the Graph host that renders the sidebar.
// Plain context, no provider component - Graph uses .Provider directly.
import { createContext, useContext } from 'react'

export interface EdgeSelectionValue {
  selectedEdgeId: string | null
  selectEdge: (id: string | null) => void
}

export const EdgeSelectionContext = createContext<EdgeSelectionValue>({
  selectedEdgeId: null,
  selectEdge: () => {},
})

export function useEdgeSelection(): EdgeSelectionValue {
  return useContext(EdgeSelectionContext)
}
