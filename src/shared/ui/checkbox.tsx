import type { InputHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  size?: 'sm' | 'md'
}

const sizes = {
  sm: 'h-4 w-4 rounded-[6px]',
  md: 'h-[22px] w-[22px] rounded-[7px]',
}

export function Checkbox({ className, size = 'md', ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={cn(
        'shrink-0 cursor-pointer appearance-none border-[1.6px] border-[var(--control-border)] bg-[var(--surface)] transition-colors',
        'checked:border-transparent checked:bg-[var(--lime)]',
        "checked:bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230E1525' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E%3C/svg%3E\")] checked:bg-[length:72%] checked:bg-center checked:bg-no-repeat",
        'focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
