// @purpose Layout registry - maps a LayoutKey to a transform function.
import { layoutTree } from './tree'
import { layoutLanes } from './lanes'
import { layoutRadial } from './radial'
import type { LayoutFn, LayoutInput, LayoutKey, LayoutOutput } from './types'

const passthrough: LayoutFn = ({ nodes, edges }) => ({ nodes, edges })

const REGISTRY: Record<LayoutKey, LayoutFn> = {
  grouped: passthrough,
  tree:    layoutTree,
  lanes:   layoutLanes,
  radial:  layoutRadial,
}

export function applyLayout(key: LayoutKey, input: LayoutInput): LayoutOutput {
  return REGISTRY[key](input)
}

export type { LayoutKey } from './types'
