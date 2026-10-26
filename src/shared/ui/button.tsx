import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  JSX,
  ReactElement,
  ReactNode,
} from 'react'
import { cloneElement, isValidElement } from 'react'
import { cn } from '../lib/cn'

type SharedButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  asChild?: boolean
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children: ReactNode
}

type ButtonProps = SharedButtonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

const variants = {
  primary:
    'btn-shimmer border border-blue-500/30 bg-blue-600 text-[rgb(255,255,255)] ' +
    'shadow-[0_1px_2px_rgba(0,0,0,0.20),inset_0_1px_0_rgba(255,255,255,0.12)] ' +
    'hover:bg-blue-500 hover:shadow-[0_4px_12px_rgba(59,130,246,0.25)] ' +
    'active:bg-blue-700',

  secondary:
    'border border-(--border) bg-(--surface) text-(--foreground) ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ' +
    'hover:border-(--border-hover) hover:bg-(--accent-soft) ' +
    'hover:text-(--foreground) active:bg-(--accent-hover)',

  ghost:
    'border border-transparent bg-transparent text-[var(--muted-strong)] ' +
    'hover:border-[var(--border)] hover:bg-[var(--accent-soft)] ' +
    'hover:text-[var(--foreground)]',

  danger:
    'btn-shimmer border border-[var(--danger-border)] ' +
    'bg-[var(--danger-dim)] text-[var(--danger-text)] ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ' +
    'hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300',

  success:
    'btn-shimmer border border-[var(--success-border)] ' +
    'bg-[var(--success-dim)] text-[var(--success-text)] ' +
    'hover:bg-emerald-500/20 hover:text-emerald-300',
}

const sizes = {
  sm: 'min-h-7 px-2.5 py-1 rounded-md gap-1.5',
  md: 'min-h-8 px-3 py-1.5 rounded-lg gap-2',
  lg: 'min-h-9 px-4 py-1.5 rounded-xl gap-2',
}

const baseClassName =
  'ui-button-text inline-flex items-center justify-center tracking-[0.01em] ' +
  'transition-[color,box-shadow,background-color,border-color,transform,opacity] ' +
  'duration-150 active:translate-y-px ' +
  'disabled:pointer-events-none disabled:opacity-40 ' +
  'focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-white/15 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[var(--background)]'

function Spinner({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'

  return (
    <svg
      className={cn(dim, 'animate-spin shrink-0')}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="3"
      />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  asChild = false,
  loading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const combinedClassName = cn(
    baseClassName,
    variants[variant],
    sizes[size],
    className,
  )

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<AnchorHTMLAttributes<HTMLAnchorElement>>

    return cloneElement(child, {
      'data-ui-control': 'true',
      className: cn(combinedClassName, child.props.className),
    } as Partial<JSX.IntrinsicElements['a']>)
  }

  return (
    <button
      data-ui-control="true"
      className={combinedClassName}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Spinner size={size} />
      ) : leftIcon ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}

      {children}

      {!loading && rightIcon ? (
        <span className="shrink-0">{rightIcon}</span>
      ) : null}
    </button>
  )
}
