import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../../shared/lib/cn'
import { initialOf } from './telephonyFormat'

/* Small shared pieces of the Calls page (avatar, capsule button). */

function PersonGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="24" r="11" fill="currentColor" />
      <path d="M11 54c2.5-10.5 11-16 21-16s18.5 5.5 21 16" fill="currentColor" />
    </svg>
  )
}

export function MacAvatar({ name, size = 36, className }: { name?: string | null; size?: number; className?: string }) {
  const initial = initialOf(name)
  return (
    <span
      className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full text-white select-none', className)}
      style={{ width: size, height: size, background: 'var(--mp-avatar)' }}
      aria-hidden="true"
    >
      {initial ? (
        <span className="font-semibold leading-none" style={{ fontSize: size * 0.46 }}>{initial}</span>
      ) : (
        <PersonGlyph className="mt-[18%] h-full w-full text-white/90" />
      )}
    </span>
  )
}

type ToolbarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }

/** Rounded "capsule" toolbar control (macOS Tahoe style). */
export function ToolbarButton({ className, active, ...props }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-[var(--mp-text)] transition-colors',
        'bg-[var(--mp-control)] hover:bg-[var(--mp-control-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-blue)]/60',
        'disabled:cursor-not-allowed disabled:opacity-45',
        active && 'bg-[var(--mp-blue)] text-white hover:bg-[var(--mp-blue)]',
        className,
      )}
      {...props}
    />
  )
}
