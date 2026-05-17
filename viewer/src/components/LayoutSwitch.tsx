// @purpose Inside-graph segmented control - picks the layout transform.
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import { Boxes, GitFork, Rows3, Target } from 'lucide-react'
import type { Key } from 'react'
import type { LayoutKey } from '../layouts'

interface LayoutSwitchProps {
  value: LayoutKey
  onChange: (v: LayoutKey) => void
}

const ITEMS: Array<{ id: LayoutKey; label: string; Icon: typeof Boxes }> = [
  { id: 'grouped', label: 'grouped', Icon: Boxes },
  { id: 'tree',    label: 'tree',    Icon: GitFork },
  { id: 'lanes',   label: 'lanes',   Icon: Rows3 },
  { id: 'radial',  label: 'radial',  Icon: Target },
]

export function LayoutSwitch({ value, onChange }: LayoutSwitchProps) {
  function handleSelection(keys: Set<Key>) {
    const first = [...keys][0]
    if (first === 'grouped' || first === 'tree' || first === 'lanes' || first === 'radial') {
      onChange(first)
    }
  }

  return (
    <ToggleButtonGroup
      className="LayoutSwitch"
      selectedKeys={new Set([value])}
      onSelectionChange={handleSelection}
      selectionMode="single"
      disallowEmptySelection
      aria-label="graph layout"
    >
      {ITEMS.map((item) => (
        <ToggleButton key={item.id} id={item.id} className="LayoutSwitch_button">
          <item.Icon size={13} />
          <span className="LayoutSwitch_label">{item.label}</span>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
