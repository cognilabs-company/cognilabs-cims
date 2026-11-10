import type { ReactNode } from 'react'
import { translateCurrentLiteral } from '../i18n/translations'
import { cn } from '../lib/cn'
import { Button } from './button'
import { BrandLoader } from './loader'

type StateBlockProps = {
  eyebrow: string
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  tone?: 'empty' | 'error'
  className?: string
  children?: ReactNode
}

function EmptyIllustration() {
  return (
    <svg
      className="h-12 w-12 text-[var(--control-border)]"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="10" width="32" height="28" rx="4" />
      <path d="M16 20h16M16 26h10" />
      <path d="M34 34l6 6" strokeWidth="2" />
      <circle cx="34" cy="34" r="5" />
    </svg>
  )
}

function ErrorIllustration() {
  return (
    <svg
      className="h-12 w-12 text-[var(--danger-text)]"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="16" />
      <path d="M24 16v9M24 30v2" strokeWidth="2" />
    </svg>
  )
}

export function StateBlock({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
  tone = 'empty',
  className,
  children,
}: StateBlockProps) {
  const isError = tone === 'error'

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-[24px] px-6 py-10 text-center',
        isError ? 'bg-[var(--danger-dim)]' : 'bg-[var(--muted-surface)]',
        className,
      )}
    >
      <div className="mb-1">
        {isError ? <ErrorIllustration /> : <EmptyIllustration />}
      </div>

      <div>
        <p className="ui-eyebrow">{translateCurrentLiteral(eyebrow)}</p>
        <h3
          className={cn(
            'mt-2 text-base font-semibold',
            isError ? 'text-[var(--danger-text)]' : 'text-[var(--foreground)]',
          )}
        >
          {translateCurrentLiteral(title)}
        </h3>
        {description ? (
          <p className="mt-1.5 text-[13px] text-[var(--muted)]">
            {translateCurrentLiteral(description)}
          </p>
        ) : null}
      </div>

      {children ? <div className="mt-2">{children}</div> : null}

      {actionLabel && onAction ? (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onAction}>
          {translateCurrentLiteral(actionLabel)}
        </Button>
      ) : null}
    </div>
  )
}

/** Section loading: the CIMS loader with a short title — no box, it sits where the content will appear. */
export function LoadingStateBlock({ title, description, className }: Omit<StateBlockProps, 'tone'>) {
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col items-center justify-center gap-4 px-6 py-14 text-center', className)}>
      <BrandLoader size={40} />
      <div>
        <p className="loading-text text-[14px] font-semibold text-[var(--foreground)]">{translateCurrentLiteral(title)}</p>
        {description ? <p className="mt-1 max-w-sm text-[12.5px] text-[var(--muted)]">{translateCurrentLiteral(description)}</p> : null}
      </div>
    </div>
  )
}

export function EmptyStateBlock(props: Omit<StateBlockProps, 'tone'>) {
  return <StateBlock {...props} tone="empty" />
}

export function ErrorStateBlock(props: Omit<StateBlockProps, 'tone'>) {
  return <StateBlock {...props} tone="error" />
}
