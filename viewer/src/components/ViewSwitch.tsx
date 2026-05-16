// @purpose Two-segment toggle between Stream and Graph views, headless via react-aria.
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import { ListTree, Workflow } from 'lucide-react'
import type { Key } from 'react'

export type ViewKey = 'stream' | 'graph'

interface ViewSwitchProps {
  value: ViewKey
  onChange: (v: ViewKey) => void
}

export function ViewSwitch({ value, onChange }: ViewSwitchProps) {
  function handleSelection(keys: Set<Key>) {
    const first = [...keys][0]
    if (first === 'stream' || first === 'graph') onChange(first)
  }

  return (
    <ToggleButtonGroup
      className="ViewSwitch"
      selectedKeys={new Set([value])}
      onSelectionChange={handleSelection}
      selectionMode="single"
      disallowEmptySelection
      aria-label="view mode"
    >
      <ToggleButton id="stream" className="ViewSwitch_button">
        <ListTree size={13} />
        stream
      </ToggleButton>
      <ToggleButton id="graph" className="ViewSwitch_button">
        <Workflow size={13} />
        graph
      </ToggleButton>
    </ToggleButtonGroup>
  )
}
