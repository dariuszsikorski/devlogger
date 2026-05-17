// @purpose Top bar - title, view switch, connection indicator, entry counter, clear action.
// Na mobile UI scale + theme slidery siedza w popoverze za ikona Settings (Sliders),
// bo inline w pasku nie mieszcza sie na 360px.
import {
  Button,
  Dialog,
  DialogTrigger,
  OverlayArrow,
  Popover,
} from 'react-aria-components'
import { Circle, RefreshCw, Sliders, Trash2 } from 'lucide-react'
import { ThemeSlider } from './ThemeSlider'
import { FontSizeSlider } from './FontSizeSlider'
import { ViewSwitch, type ViewKey } from './ViewSwitch'

interface HeaderProps {
  isConnected: boolean
  visibleCount: number
  totalCount: number
  onClear: () => void
  onResend: () => void
  view: ViewKey
  onViewChange: (v: ViewKey) => void
}

export function Header({
  isConnected,
  visibleCount,
  totalCount,
  onClear,
  onResend,
  view,
  onViewChange,
}: HeaderProps) {
  const statusState = isConnected ? 'connected' : 'disconnected'
  const statusText  = statusState
  const isGraph     = view === 'graph'

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

        <DialogTrigger>
          <Button className="Header_settings" aria-label="UI settings">
            <Sliders size={14} />
          </Button>
          <Popover className="Header_settingsPopover" placement="bottom end" offset={6}>
            <OverlayArrow className="Header_settingsArrow">
              <svg width={12} height={12} viewBox="0 0 12 12"><path d="M0 0 L6 6 L12 0" /></svg>
            </OverlayArrow>
            <Dialog className="Header_settingsDialog" aria-label="UI settings">
              <div className="Header_settingsRow">
                <span className="Header_settingsLabel">font size</span>
                <FontSizeSlider />
              </div>
              <div className="Header_settingsRow">
                <span className="Header_settingsLabel">brightness</span>
                <ThemeSlider />
              </div>
            </Dialog>
          </Popover>
        </DialogTrigger>

        <span className="Header_status" data-state={statusState}>
          <Circle className="Header_statusIcon" size={8} />
          {statusText}
        </span>

        <span className="Header_count">
          {isGraph
            ? `${totalCount} entries`
            : `${visibleCount} / ${totalCount} entries`}
        </span>

        <Button className="Header_clear" onPress={onResend} aria-label="resend recent logs from broker">
          <RefreshCw size={14} />
          resend
        </Button>

        <Button className="Header_clear" onPress={onClear}>
          <Trash2 size={14} />
          clear
        </Button>
      </div>
    </header>
  )
}
