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
    'bg-[var(--primary)] text-white shadow-[var(--elev-primary)] ' +
    'hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)]',

  secondary:
    'border border-[var(--border-hover)] bg-[var(--surface)] text-[var(--foreground)] ' +
    'hover:bg-[var(--input-surface)] active:bg-[var(--accent-hover)]',

  ghost:
    'bg-transparent text-[var(--muted-strong)] ' +
    'hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',

  danger:
    'bg-[var(--danger-dim)] text-[var(--danger-text)] ' +
    'hover:bg-[var(--danger-dim-hover)] active:bg-[var(--danger-dim-active)]',

  success:
    'bg-[var(--success-dim)] text-[var(--success-text)] ' +
    'hover:bg-[var(--success-dim-hover)] active:bg-[var(--success-dim-active)]',
}

const sizes = {
  sm: 'min-h-8 gap-1.5 rounded-[9px] px-3 text-[12.5px]',
  md: 'min-h-10 gap-2 rounded-[10px] px-4 text-[13.5px]',
  lg: 'min-h-11 gap-2 rounded-[12px] px-5 text-[14.5px]',
}

const baseClassName =
  'inline-flex items-center justify-center font-semibold whitespace-nowrap ' +
  'transition-[color,box-shadow,background-color,border-color,opacity] duration-150 ' +
  'disabled:pointer-events-none disabled:opacity-40 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35'

function Spinner({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-4.5 w-4.5' : 'h-4 w-4'

  return (
    <svg
      className={cn(dim, 'shrink-0 animate-spin')}
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
