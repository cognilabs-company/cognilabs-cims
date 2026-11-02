import type { ReactNode } from 'react'
import { translateCurrentLiteral } from '../i18n/translations'
import { cn } from '../lib/cn'
import { Button } from './button'

type StateBlockProps = {
  eyebrow: string
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  tone?: 'loading' | 'empty' | 'error'
  className?: string
  children?: ReactNode
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]"
          style={{ animationDelay: `${i * 120}ms`, animationDuration: '900ms' }}
        />
      ))}
    </div>
  )
}

function EmptyIllustration() {
  return (
    <svg
      className="h-12 w-12 text-[#D3D7E0]"
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
  const isLoading = tone === 'loading'
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
        {isLoading ? (
          <LoadingDots />
        ) : isError ? (
          <ErrorIllustration />
        ) : (
          <EmptyIllustration />
        )}
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

export function LoadingStateBlock(props: Omit<StateBlockProps, 'tone'>) {
  return <StateBlock {...props} tone="loading" />
}

export function EmptyStateBlock(props: Omit<StateBlockProps, 'tone'>) {
  return <StateBlock {...props} tone="empty" />
}

export function ErrorStateBlock(props: Omit<StateBlockProps, 'tone'>) {
  return <StateBlock {...props} tone="error" />
}
