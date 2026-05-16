// @purpose Top bar - title, view switch, connection indicator, entry counter, clear action.
import { Button } from 'react-aria-components'
import { Circle, Trash2 } from 'lucide-react'
import { ThemeSlider } from './ThemeSlider'
import { FontSizeSlider } from './FontSizeSlider'
import { ViewSwitch, type ViewKey } from './ViewSwitch'

interface HeaderProps {
  isConnected: boolean
  visibleCount: number
  totalCount: number
  onClear: () => void
  view: ViewKey
  onViewChange: (v: ViewKey) => void
}

export function Header({
  isConnected,
  visibleCount,
  totalCount,
  onClear,
  view,
  onViewChange,
}: HeaderProps) {
  const statusClass = 'Header_status ' + (isConnected ? 'is-connected' : 'is-disconnected')
  const statusText = isConnected ? 'connected' : 'disconnected'
  const isGraph = view === 'graph'

  return (
    <header className="Header">
      <div className="Header_brand">
        <span className="Header_dot" aria-hidden="true" />
        <h1 className="Header_title">devlogger</h1>
        <ViewSwitch value={view} onChange={onViewChange} />
      </div>

      <div className="Header_meta">
        <FontSizeSlider />
        <ThemeSlider />

        <span className={statusClass}>
          <Circle className="Header_statusIcon" size={8} />
          {statusText}
        </span>

        <span className="Header_count">
          {isGraph
            ? `${totalCount} entries`
            : `${visibleCount} / ${totalCount} entries`}
        </span>

        <Button className="Header_clear" onPress={onClear}>
          <Trash2 size={14} />
          clear
        </Button>
      </div>
    </header>
  )
}
