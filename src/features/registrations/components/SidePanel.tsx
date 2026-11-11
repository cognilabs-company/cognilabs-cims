import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'

type SidePanelProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  /** Extra controls in the header, left of the close button. */
  headerExtra?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Tailwind max-width class for sm and up. */
  width?: string
}

/**
 * A panel sliding in from the right (full screen on phones). Dialogs opened on top of it
 * get Escape first; the panel only closes on Escape when it is the top-most modal.
 */
export function SidePanel({ open, onClose, title, subtitle, headerExtra, children, footer, width = 'sm:max-w-[640px]' }: SidePanelProps) {
  const { t } = useLocale()
  const titleId = useId()
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // Another dialog (approve, confirm…) is open above the panel → it handles Escape.
      if (document.querySelectorAll('[aria-modal="true"]').length > 1) return
      onCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex justify-end">
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('registrations.common.close', 'Close')}
        className="dialog-backdrop backdrop-fade absolute inset-0"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-ui-surface="true"
        className={cn(
          'relative z-10 flex h-full w-full flex-col bg-[var(--surface)] shadow-[var(--elev-xl)] ring-1 ring-[var(--border)]',
          'animate-[sheet-enter_320ms_cubic-bezier(0.16,1,0.3,1)_backwards] sm:rounded-l-[22px]',
          width,
        )}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-[var(--border)] px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3.5 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-[17px] leading-6 font-semibold tracking-[-0.015em] text-[var(--foreground)]">{title}</h2>
            {subtitle ? <div className="mt-0.5 text-[12.5px] leading-[1.45] text-[var(--muted)]">{subtitle}</div> : null}
          </div>
          {headerExtra}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('registrations.common.close', 'Close')}
            className="-mr-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[var(--muted)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]"
          >
            <XIcon size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--card-hover)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </footer>
        ) : null}
      </section>
    </div>,
    document.body,
  )
}
