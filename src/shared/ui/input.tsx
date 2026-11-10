import type { InputHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      data-ui-control="true"
      className={cn(
        'control-field min-h-10 w-full rounded-[10px] px-3 py-1.5 text-[13.5px]',
        'placeholder:text-[13px] placeholder:text-[var(--caption)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
