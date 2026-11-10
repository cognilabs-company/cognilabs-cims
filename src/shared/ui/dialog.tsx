import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { translateCurrentLiteral } from '../i18n/translations'
import { cn } from '../lib/cn'

type DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  /** Kept for callers; the compact header no longer shows an eyebrow line. */
  eyebrow?: string
  children?: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl'
  tone?: 'default' | 'danger'
  headerIcon?: ReactNode
  className?: string
}

/** Compact widths: forms stay readable without taking over the screen. */
const sizeClasses = {
  md: 'sm:max-w-[460px]',
  lg: 'sm:max-w-[580px]',
  xl: 'sm:max-w-[740px]',
}

/**
 * The app dialog: small header (icon · title · one-line description · close),
 * a scrolling body, and a footer that always stays visible.
 * On phones it becomes a bottom sheet.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  tone = 'default',
  headerIcon,
  className,
}: DialogProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-label={translateCurrentLiteral('Close dialog')}
        className="dialog-backdrop backdrop-fade absolute inset-0"
        onClick={onClose}
      />
      <div
        data-ui-surface="true"
        role="dialog"
        aria-modal="true"
        aria-label={translateCurrentLiteral(title)}
        className={cn(
          'dialog-panel relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[22px] bg-[var(--surface)] shadow-[var(--elev-xl)] ring-1 ring-[var(--border)]',
          'sm:max-h-[min(86vh,860px)] sm:rounded-[20px]',
          sizeClasses[size],
          className,
        )}
      >
        <span className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-[var(--border-hover)] sm:hidden" aria-hidden="true" />

        <header className="flex shrink-0 items-start gap-3 border-b border-[var(--border)] px-5 pt-4 pb-3.5">
          {headerIcon ? (
            <span
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-[11px] [&_svg]:h-[18px] [&_svg]:w-[18px]',
                tone === 'danger' ? 'bg-[var(--danger-dim)] text-[var(--danger-text)]' : 'bg-[var(--blue-dim)] text-[var(--primary)]',
              )}
            >
              {headerIcon}
            </span>
          ) : null}
          <div className="min-w-0 flex-1 pt-px">
            <h2 className={cn('text-[16px] leading-6 font-semibold tracking-[-0.015em]', tone === 'danger' ? 'text-[var(--danger-text)]' : 'text-[var(--foreground)]')}>
              {translateCurrentLiteral(title)}
            </h2>
            {description ? (
              <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-[1.45] text-[var(--muted)]">{translateCurrentLiteral(description)}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mt-0.5 -mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[var(--muted)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]"
            aria-label={translateCurrentLiteral('Close dialog panel')}
          >
            <X size={16} />
          </button>
        </header>

        {children ? (
          <div className="dialog-body min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {children}
          </div>
        ) : null}

        {footer ? (
          <div className="dialog-footer flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--card-hover)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
