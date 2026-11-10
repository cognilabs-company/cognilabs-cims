import type { CSSProperties } from 'react'
import { cn } from '../lib/cn'

/**
 * The CIMS loader: the brand tile ("C") with a gradient arc running around it.
 * Used for page/section loading, the app splash and redirects.
 */
export function BrandLoader({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <span
      role="presentation"
      className={cn('brand-loader', className)}
      style={{ '--loader-size': `${size}px` } as CSSProperties}
    >
      <span className="brand-loader__ring" />
      <span className="brand-loader__tile">C</span>
    </span>
  )
}

/** Thin indeterminate progress line (top of a loading page, splash). */
export function LoadingBar({ className }: { className?: string }) {
  return (
    <span role="presentation" className={cn('loading-bar', className)}>
      <span className="loading-bar__run" />
    </span>
  )
}

/** Full-screen splash while the session is being restored. */
export function AppSplash({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div role="status" aria-live="polite" className="app-splash">
      <div className="app-splash__aura" aria-hidden="true" />
      <div className="relative flex flex-col items-center text-center">
        <BrandLoader size={60} />
        <p className="mt-6 text-[17px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">{title}</p>
        {subtitle ? <p className="mt-1 text-[13px] text-[var(--muted)]">{subtitle}</p> : null}
        <LoadingBar className="mt-6 w-40" />
      </div>
    </div>
  )
}
