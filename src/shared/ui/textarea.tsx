import type { TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      data-ui-control="true"
      className={cn(
        'min-h-24 w-full rounded-[14px] border border-transparent bg-[var(--input-surface)] px-3.5 py-2.5',
        'text-sm text-[var(--foreground)]',
        'placeholder:text-[13px] placeholder:leading-[1.45] placeholder:text-[var(--muted)]',
        'outline-none',
        'transition-[border-color,box-shadow,background-color] duration-150',
        'hover:bg-[var(--input-surface-hover)]',
        'focus:border-[var(--primary)] focus:bg-[var(--surface)]',
        'focus:shadow-[0_0_0_3px_rgba(43,89,255,0.12)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
