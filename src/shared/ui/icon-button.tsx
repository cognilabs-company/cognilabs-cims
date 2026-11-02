import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

type IconButtonTone = 'neutral' | 'primary' | 'danger' | 'inverse'
type IconButtonSize = 'sm' | 'md' | 'lg'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: IconButtonTone
  size?: IconButtonSize
  label: string
  children: ReactNode
}

const tones: Record<IconButtonTone, string> = {
  neutral: 'text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
  primary: 'text-[var(--primary)] hover:bg-[var(--blue-dim)]',
  danger: 'text-[var(--danger-text)] hover:bg-[var(--danger-dim)]',
  inverse: 'bg-[var(--surface-inverse)] text-white hover:opacity-90',
}

const sizes: Record<IconButtonSize, string> = {
  sm: 'h-8 w-8 rounded-[9px]',
  md: 'h-9 w-9 rounded-[11px]',
  lg: 'h-11 w-11 rounded-[14px]',
}

export function IconButton({
  tone = 'neutral',
  size = 'md',
  label,
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-colors',
        'focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-40',
        tones[tone],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
