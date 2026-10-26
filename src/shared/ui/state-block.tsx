import type { ReactNode } from 'react'
import { translateCurrentLiteral } from '../i18n/translations'
import { Button } from './button'

type StateBlockProps = {
  eyebrow: string
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  tone?: 'loading' | 'empty' | 'error'
  children?: ReactNode
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500/60 animate-bounce"
          style={{ animationDelay: `${i * 120}ms`, animationDuration: '900ms' }}
        />
      ))}
    </div>
  )
}

function EmptyIllustration() {
  return (
    <svg
      className="h-12 w-12 text-[var(--border)]"
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
      className="h-12 w-12 text-red-500/40"
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
  description: _description,
  actionLabel,
  onAction,
  tone = 'empty',
  children,
}: StateBlockProps) {
  const isLoading = tone === 'loading'
  const isError   = tone === 'error'

  return (
    <div
      className={
        isError
          ? 'flex flex-col items-center gap-3 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-dim)] px-6 py-10 text-center'
          : 'flex flex-col items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted-surface)] px-6 py-10 text-center'
      }
    >
      {/* Illustration */}
      <div className="mb-1">
        {isLoading ? (
          <LoadingDots />
        ) : isError ? (
          <ErrorIllustration />
        ) : (
          <EmptyIllustration />
        )}
      </div>

      {/* Text */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[var(--caption)]">
          {translateCurrentLiteral(eyebrow)}
        </p>
        <h3
          className={
            isError
              ? 'mt-2 text-base font-semibold text-[var(--danger-text)]'
              : 'mt-2 text-base font-semibold text-white'
          }
        >
          {translateCurrentLiteral(title)}
        </h3>
      </div>

      {/* Children */}
      {children ? <div className="mt-2">{children}</div> : null}

      {/* Action */}
      {actionLabel && onAction ? (
        <Button variant="secondary" size="md" className="mt-2" onClick={onAction}>
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
