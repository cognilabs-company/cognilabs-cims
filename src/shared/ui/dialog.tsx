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
        className={cn(
          'dialog-backdrop absolute inset-0 backdrop-blur-md',
          tone === 'danger'
            ? 'bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.16),transparent_34%),rgba(0,0,0,0.76)]'
            : 'bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_32%),rgba(0,0,0,0.72)]',
        )}
        onClick={onClose}
      />
      <div
        data-ui-surface="true"
        className={cn(
          'dialog-content relative z-10 flex max-h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-xl border shadow-[var(--shadow-xl)] sm:max-h-[calc(100vh-3rem)]',
          tone === 'danger' && 'border-red-500/20 shadow-[0_30px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(239,68,68,0.06)]',
          sizeClasses[size],
        )}
      >
        <div
          className={cn(
            'dialog-header-decor pointer-events-none absolute inset-x-0 top-0 h-28',
            tone === 'danger'
              ? 'bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.18),transparent_72%)]'
              : 'bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_72%)]',
          )}
        />

        <div className="dialog-divider relative z-10 flex items-start justify-between gap-4 border-b px-6 py-5 sm:px-7">
          <div className="max-w-2xl">
            {headerIcon ? (
              <div className="mb-3">
                {headerIcon}
              </div>
            ) : null}
            <p className={cn(
              'dialog-eyebrow ui-eyebrow',
              tone === 'danger' ? 'text-red-300/80' : 'text-blue-300/70',
            )}>
              {translateCurrentLiteral(eyebrow ?? 'Workspace dialog')}
            </p>
            <h2 className="ui-dialog-title mt-2 text-[var(--foreground)]">
              {translateCurrentLiteral(title)}
            </h2>
            {description ? (
              <p className={cn(
                'ui-helper mt-2',
                tone === 'danger' ? 'text-zinc-300/80' : 'text-[var(--muted-strong)]',
              )}>
                {translateCurrentLiteral(description)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-[var(--input-surface)] text-[var(--muted-strong)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] transition hover:text-[var(--foreground)]',
              tone === 'danger'
                ? 'border-red-500/15 hover:border-red-500/30 hover:bg-red-500/10'
                : 'border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--accent-soft)]',
            )}
            aria-label={translateCurrentLiteral('Close dialog panel')}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 4l8 8M12 4 4 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {children ? (
          <div className="relative z-10 overflow-y-auto px-6 py-6 sm:px-7">
            {children}
          </div>
        ) : null}

        {footer ? (
          <div className="dialog-divider relative z-10 flex flex-wrap justify-end gap-3 border-t px-6 py-5 sm:px-7">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
