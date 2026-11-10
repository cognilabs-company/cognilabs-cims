import type { CSSProperties } from 'react'
import { cn } from '../lib/cn'

/** Minimal loader: a thin ring with one moving arc. */
export function BrandLoader({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span
      role="presentation"
      className={cn('spinner', className)}
      style={{ '--spinner-size': `${size}px` } as CSSProperties}
    />
  )
}

/** Thin indeterminate progress line. */
export function LoadingBar({ className }: { className?: string }) {
  return (
    <span role="presentation" className={cn('loading-bar', className)}>
      <span className="loading-bar__run" />
    </span>
  )
}

/** Full-screen splash while the session is being restored: a ring and the app name, nothing else. */
export function AppSplash({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div role="status" aria-live="polite" className="app-splash">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandLoader size={26} />
        <div>
          <p className="text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{title}</p>
          {subtitle ? <p className="mt-0.5 text-[12px] text-[var(--muted)]">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  )
}
