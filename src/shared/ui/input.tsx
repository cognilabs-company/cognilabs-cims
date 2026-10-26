import type { InputHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      data-ui-control="true"
      className={cn(
        'min-h-[44px] w-full rounded-lg border border-[var(--border)] bg-[var(--input-surface)] px-3.5 py-2',
        'ui-body text-[var(--foreground)]',
        'placeholder:text-[13px] placeholder:leading-[1.45] placeholder:text-[var(--caption)]',
        'shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]',
        'outline-none',
        'transition-[border-color,box-shadow,background-color] duration-150',
        'hover:border-[var(--border-hover)] hover:bg-[var(--input-surface-hover)]',
        'focus:border-[var(--border-focus)] focus:bg-[var(--input-surface-hover)]',
        'focus:shadow-[inset_0_1px_2px_rgba(0,0,0,0.12),0_0_0_3px_rgba(59,130,246,0.12)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
