// @purpose Thin wrapper around react-aria-components Modal+Dialog - shared
// chrome (title bar, close button, scroll container) reused across the app.
import type { ReactNode } from 'react'
import {
  Modal,
  ModalOverlay,
  Dialog as AriaDialog,
  Heading,
  Button,
} from 'react-aria-components'
import { X } from 'lucide-react'

interface DialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  /** Optional small caption rendered next to the title (e.g. timestamp, scope). */
  subtitle?: ReactNode
  children: ReactNode
  /** Optional extra class on the dialog panel for size variants. */
  className?: string
}

export function Dialog({ isOpen, onOpenChange, title, subtitle, children, className }: DialogProps) {
  return (
    <ModalOverlay
      className="Dialog_overlay"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
    >
      <Modal className="Dialog_modal">
        <AriaDialog className={`Dialog ${className ?? ''}`.trim()}>
          {({ close }) => (
            <>
              <header className="Dialog_header">
                <div className="Dialog_titleWrap">
                  <Heading slot="title" className="Dialog_title">{title}</Heading>
                  {subtitle && <div className="Dialog_subtitle">{subtitle}</div>}
                </div>
                <Button className="Dialog_close" onPress={close} aria-label="close dialog">
                  <X size={16} />
                </Button>
              </header>
              <div className="Dialog_body">{children}</div>
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  )
}
