import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { translateCurrentLiteral } from '../i18n/translations'
import { cn } from '../lib/cn'

type DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  eyebrow?: string
  children?: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl'
  tone?: 'default' | 'danger'
  headerIcon?: ReactNode
  className?: string
}

const sizeClasses = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  eyebrow,
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
      if (event.key === 'Escape') {
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
    <div className="fixed inset-0 z-[100] grid place-items-center p-3 sm:p-6">
      <button
        type="button"
        aria-label={translateCurrentLiteral('Close dialog')}
        className="dialog-backdrop backdrop-fade absolute inset-0"
        onClick={onClose}
      />
      <div
        data-ui-surface="true"
        role="dialog"
        aria-modal="true"
        className={cn(
          'dialog-content modal-pop relative z-10 flex max-h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-[24px] shadow-[var(--elev-xl)] sm:max-h-[calc(100vh-3rem)]',
          sizeClasses[size],
          className,
        )}
      >
        <div className="dialog-divider relative z-10 flex items-start justify-between gap-4 border-b px-[22px] py-5 sm:px-7">
          <div className="max-w-2xl">
            {headerIcon ? <div className="mb-3">{headerIcon}</div> : null}
            {eyebrow ? (
              <p className="dialog-eyebrow ui-eyebrow">{translateCurrentLiteral(eyebrow)}</p>
            ) : null}
            <h2
              className={cn(
                'ui-dialog-title',
                eyebrow && 'mt-2',
                tone === 'danger' ? 'text-[var(--danger-text)]' : 'text-[var(--foreground)]',
              )}
            >
              {translateCurrentLiteral(title)}
            </h2>
            {description ? (
              <p className="ui-helper mt-2">{translateCurrentLiteral(description)}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] transition-colors',
              tone === 'danger'
                ? 'text-[var(--danger-text)] hover:bg-[var(--danger-dim)]'
                : 'text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
            )}
            aria-label={translateCurrentLiteral('Close dialog panel')}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 4l8 8M12 4 4 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {children ? (
          <div className="relative z-10 overflow-y-auto px-[22px] py-6 sm:px-7">
            {children}
          </div>
        ) : null}

        {footer ? (
          <div className="dialog-divider relative z-10 flex flex-wrap justify-end gap-3 border-t px-[22px] py-5 sm:px-7">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
