import type { InputHTMLAttributes, ReactNode } from 'react'
import { useState } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  error?: string
  hint?: string
  leadingIcon?: ReactNode
}

export function PasswordField({ label, error, hint, id, className, leadingIcon, ...props }: PasswordFieldProps) {
  const { t } = useLocale()
  const [visible, setVisible] = useState(false)
  const inputId = id ?? props.name

  return (
    <Label className="grid gap-2" htmlFor={inputId}>
      {label ? <span className="text-xs font-bold text-[var(--foreground)] tracking-tight">{label}</span> : null}
      <div className="relative group">
        {leadingIcon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[var(--muted)]">
            {leadingIcon}
          </span>
        ) : null}
        <Input
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={cn('pr-14', leadingIcon ? 'pl-10' : null, className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? t('auth.password.hide', 'Hide password') : t('auth.password.show', 'Show password')}
          aria-pressed={visible}
          className={cn(
            'absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-zinc-500 transition-all',
            'hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]',
          )}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4.5 w-4.5"
          >
            <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
            <circle cx="12" cy="12" r="2.75" />
          </svg>
        </button>
      </div>
      {error ? <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">{error}</span> : null}
      {!error && hint ? <span className="text-[11px] font-medium text-zinc-500">{hint}</span> : null}
    </Label>
  )
}
