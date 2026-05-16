// @purpose Filters bar - text search + app select + level select, all React Aria headless.
import {
  Button,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  TextField,
} from 'react-aria-components'
import { ChevronDown, Search } from 'lucide-react'
import type { Key } from 'react'

const LEVEL_OPTIONS = [
  { id: '',      label: 'all levels' },
  { id: 'log',   label: 'log'   },
  { id: 'info',  label: 'info'  },
  { id: 'warn',  label: 'warn'  },
  { id: 'error', label: 'error' },
  { id: 'debug', label: 'debug' },
]

interface FiltersProps {
  search:      string
  appFilter:   string
  levelFilter: string
  apps:        string[]
  onSearchChange: (v: string) => void
  onAppChange:    (v: string) => void
  onLevelChange:  (v: string) => void
}

export function Filters(props: FiltersProps) {
  const appOptions = [{ id: '', label: 'all apps' }].concat(
    props.apps.map((a) => ({ id: a, label: a }))
  )

  const handleAppChange    = (k: Key | null) => props.onAppChange(k == null ? '' : String(k))
  const handleLevelChange  = (k: Key | null) => props.onLevelChange(k == null ? '' : String(k))

  return (
    <section className="Filters">
      <TextField
        className="Filters_search"
        value={props.search}
        onChange={props.onSearchChange}
        aria-label="filter logs"
      >
        <Label className="Filters_searchIcon"><Search size={14} /></Label>
        <Input placeholder="filter (text in any field)" />
      </TextField>

      <FilterSelect
        ariaLabel="app filter"
        value={props.appFilter}
        onChange={handleAppChange}
        options={appOptions}
      />

      <FilterSelect
        ariaLabel="level filter"
        value={props.levelFilter}
        onChange={handleLevelChange}
        options={LEVEL_OPTIONS}
      />
    </section>
  )
}

interface FilterSelectProps {
  ariaLabel: string
  value:     string
  onChange:  (k: Key | null) => void
  options:   Array<{ id: string; label: string }>
}

function FilterSelect({ ariaLabel, value, onChange, options }: FilterSelectProps) {
  return (
    <Select
      className="Filters_select"
      aria-label={ariaLabel}
      selectedKey={value}
      onSelectionChange={onChange}
    >
      <Button className="Filters_selectButton">
        <SelectValue />
        <ChevronDown size={14} />
      </Button>
      <Popover className="Filters_popover">
        <ListBox className="Filters_listBox" items={options}>
          {(item) => (
            <ListBoxItem id={item.id} className="Filters_option" textValue={item.label}>
              {item.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  )
}
