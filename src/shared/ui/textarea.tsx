import type { TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      data-ui-control="true"
      className={cn(
        'control-field min-h-20 w-full rounded-[10px] px-3 py-2 text-[13.5px] leading-relaxed',
        'placeholder:text-[13px] placeholder:text-[var(--caption)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
