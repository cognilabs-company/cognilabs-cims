import type { InputHTMLAttributes, ReactNode } from 'react'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { IconButton } from '../../../shared/ui/icon-button'
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
      {label ? <span className="ui-input-label">{label}</span> : null}
      <div className="relative">
        {leadingIcon ? (
          <span className="pointer-events-none absolute top-1/2 left-3.5 z-10 -translate-y-1/2 text-[var(--muted)]">
            {leadingIcon}
          </span>
        ) : null}
        <Input
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={cn('pr-12', leadingIcon ? 'pl-11' : null, className)}
          {...props}
        />
        <IconButton
          label={visible ? t('auth.password.hide', 'Hide password') : t('auth.password.show', 'Show password')}
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          className="absolute top-1/2 right-2 -translate-y-1/2 hover:bg-[var(--border-hover)]"
        >
          {visible ? (
            <EyeOff aria-hidden="true" strokeWidth={1.8} className="h-4.5 w-4.5" />
          ) : (
            <Eye aria-hidden="true" strokeWidth={1.8} className="h-4.5 w-4.5" />
          )}
        </IconButton>
      </div>
      {error ? <span className="text-[12.5px] font-medium text-[var(--danger-text)]">{error}</span> : null}
      {!error && hint ? <span className="text-[12.5px] text-[var(--muted)]">{hint}</span> : null}
    </Label>
  )
}
