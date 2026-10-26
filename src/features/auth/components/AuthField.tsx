import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../../shared/lib/cn'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
  leadingIcon?: ReactNode
}

export function AuthField({ label, error, hint, id, className, leadingIcon, ...props }: AuthFieldProps) {
  const inputId = id ?? props.name

  return (
    <Label className="grid gap-2" htmlFor={inputId}>
      <span className="text-xs font-bold text-[var(--foreground)] tracking-tight">{label}</span>
      <div className="relative">
        {leadingIcon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[var(--muted)]">
            {leadingIcon}
          </span>
        ) : null}

        <Input
          id={inputId}
          className={cn(leadingIcon ? 'pl-10' : null, className)}
          {...props}
        />
      </div>
      {error ? <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">{error}</span> : null}
      {!error && hint ? <span className="text-[11px] font-medium text-zinc-500">{hint}</span> : null}
    </Label>
  )
}
