import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '../../../shared/lib/cn'
import { initialOf } from './telephonyFormat'

/* Small building blocks that make the Calls page feel like the macOS Phone app. */

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

/** Round call button used on every Recents row. */
export function RowCallButton({ disabled, onClick, label }: { disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => { event.stopPropagation(); onClick() }}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--mp-control)] text-[var(--mp-blue)] transition-colors hover:bg-[var(--mp-control-hover)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-blue)]/60"
    >
      <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="currentColor" aria-hidden="true">
        <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z" />
      </svg>
    </button>
  )
}

/** Translucent macOS menu / popover surface. */
export function MacMenu({ className, children, align = 'left' }: { className?: string; children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <div
      role="menu"
      className={cn(
        'mac-pop absolute top-[calc(100%+6px)] z-40 min-w-[220px] rounded-[12px] border border-[var(--mp-menu-border)] bg-[var(--mp-menu)] p-[5px] text-[13px] text-[var(--mp-text)] shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45)] backdrop-blur-2xl',
        align === 'right' ? 'right-0' : 'left-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function MacMenuItem({ checked, children, onSelect, hint }: { checked?: boolean; children: ReactNode; onSelect: () => void; hint?: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={Boolean(checked)}
      onClick={onSelect}
      className="flex w-full items-center gap-2 rounded-[7px] px-2 py-[5px] text-left hover:bg-[var(--mp-blue)] hover:text-white focus-visible:bg-[var(--mp-blue)] focus-visible:text-white focus-visible:outline-none"
    >
      <span className="grid w-3.5 shrink-0 place-items-center">{checked ? <Check size={13} strokeWidth={3} /> : null}</span>
      <span className="flex-1 truncate">{children}</span>
      {hint ? <span className="text-[12px] opacity-60">{hint}</span> : null}
    </button>
  )
}

export function MacMenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-2 pt-1.5 pb-1 text-[11px] font-semibold text-[var(--mp-secondary)]">{children}</p>
}

export function MacMenuSeparator() {
  return <div className="mx-2 my-[5px] h-px bg-[var(--mp-separator)]" />
}
