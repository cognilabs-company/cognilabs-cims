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
        // The tick lives in index.css (.ui-checkbox): a data-URL with spaces can't be a Tailwind class.
        'ui-checkbox',
        'focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
