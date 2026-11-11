import { useState, type ReactNode } from 'react'
import { CheckIcon, EyeIcon, EyeSlashIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { RegistrationField } from '../../../shared/api/services/registrations.service'
import { cn } from '../../../shared/lib/cn'
import { CalendarField } from '../../../shared/ui/calendar-field'
import { Checkbox } from '../../../shared/ui/checkbox'
import { Input } from '../../../shared/ui/input'
import { SelectField } from '../../../shared/ui/select-field'
import { Textarea } from '../../../shared/ui/textarea'
import { fieldLabel } from '../lib/labels'
import { effectiveAccept, type FormValue, type PickedFile } from '../lib/values'
import { FilePicker } from './FilePicker'

type FieldInputProps = {
  field: RegistrationField
  idPrefix: string
  value: FormValue
  onChange: (value: FormValue) => void
  files?: PickedFile[]
  onAddFiles?: (files: File[]) => void
  onRemoveFile?: (id: string) => void
  keptFiles?: string[]
  error?: string
  disabled?: boolean
  /** Extra hint under the field (e.g. "enter your password again"). */
  note?: string
}

const AUTOCOMPLETE: Record<string, string> = {
  email: 'email',
  name: 'given-name',
  surname: 'family-name',
  password: 'new-password',
  phone: 'tel',
}

const invalidRing = 'border-[var(--danger)] hover:border-[var(--danger)]'

/** One field of a registration form, rendered for the applicant (also used by the builder preview). */
export function FieldInput({ field, idPrefix, value, onChange, files = [], onAddFiles, onRemoveFile, keptFiles, error, disabled, note }: FieldInputProps) {
  const { t } = useLocale()
  const [showPassword, setShowPassword] = useState(false)
  const id = `${idPrefix}-${field.key}`
  const helpId = field.help_text || note ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined
  const label = fieldLabel(t, field)
  const text = typeof value === 'string' ? value : ''
  const placeholder = field.placeholder ?? undefined
  const common = {
    id,
    disabled,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    'aria-required': field.required || undefined,
  } as const

  const labelNode = (
    <>
      <span data-i18n-skip="true">{label}</span>
      {field.required ? <span className="ml-0.5 text-[var(--danger-text)]" aria-hidden="true">*</span> : null}
    </>
  )

  let control: ReactNode
  switch (field.type) {
    case 'textarea':
      control = <Textarea {...common} rows={4} value={text} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="min-h-24" />
      break
    case 'email':
      control = <Input {...common} type="email" inputMode="email" autoComplete={AUTOCOMPLETE[field.key] ?? 'email'} autoCapitalize="none" spellCheck={false} value={text} placeholder={placeholder ?? 'name@example.com'} onChange={(event) => onChange(event.target.value)} />
      break
    case 'phone':
      control = <Input {...common} type="tel" inputMode="tel" autoComplete="tel" value={text} placeholder={placeholder ?? '+998 90 123 45 67'} onChange={(event) => onChange(event.target.value.replace(/[^\d\s()+-]/g, ''))} />
      break
    case 'number':
      control = <Input {...common} type="text" inputMode="decimal" value={text} placeholder={placeholder} onChange={(event) => onChange(event.target.value.replace(',', '.').replace(/[^\d.-]/g, ''))} />
      break
    case 'date':
    case 'datetime':
      control = (
        <CalendarField
          id={id}
          mode={field.type}
          value={text}
          onValueChange={(next) => onChange(next)}
          disabled={disabled}
          required={field.required}
          placeholder={placeholder}
          aria-label={label}
          className={cn(error && invalidRing)}
        />
      )
      break
    case 'password':
      control = (
        <div className="relative">
          <Input
            {...common}
            type={showPassword ? 'text' : 'password'}
            autoComplete={AUTOCOMPLETE[field.key] ?? 'new-password'}
            autoCapitalize="none"
            spellCheck={false}
            value={text}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            disabled={disabled}
            aria-label={showPassword ? t('registrations.form.hide_password', 'Hide password') : t('registrations.form.show_password', 'Show password')}
            aria-pressed={showPassword}
            className="absolute top-1/2 right-1.5 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[8px] text-[var(--muted)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]"
          >
            {showPassword ? <EyeSlashIcon size={17} /> : <EyeIcon size={17} />}
          </button>
        </div>
      )
      break
    case 'select':
      control = (
        <div data-i18n-skip="true">
          <SelectField
            id={id}
            value={text}
            onValueChange={(next) => onChange(next)}
            options={[
              // An optional answer can be cleared again once something was chosen.
              ...(!field.required && text ? [{ value: '', label: t('registrations.form.select_clear', 'Clear selection') }] : []),
              ...field.options.map((option) => ({ value: option, label: option })),
            ]}
            placeholder={placeholder ?? t('registrations.form.select_placeholder', 'Choose…')}
            searchable={field.options.length > 8}
            searchPlaceholder={t('registrations.common.search', 'Search…')}
            emptyMessage={t('registrations.common.nothing_found', 'Nothing found')}
            disabled={disabled}
            aria-label={label}
            className={cn(error && invalidRing)}
          />
        </div>
      )
      break
    case 'radio':
    case 'multi_select': {
      const multiple = field.type === 'multi_select'
      const selected = multiple ? (Array.isArray(value) ? value : []) : [text]
      control = (
        <div role={multiple ? 'group' : 'radiogroup'} aria-labelledby={`${id}-label`} aria-describedby={describedBy} className={cn('grid gap-2', field.options.length > 4 && 'sm:grid-cols-2')}>
          {field.options.map((option) => {
            const checked = selected.includes(option)
            return (
              <label
                key={option}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] border px-3 py-2 text-[13.5px] transition-colors',
                  checked ? 'border-[var(--primary)] bg-[var(--blue-dim)] text-[var(--foreground)]' : 'border-[var(--border-hover)] bg-[var(--surface)] text-[var(--muted-strong)] hover:border-[var(--control-border)]',
                  error && !checked && 'border-[var(--danger)]',
                  disabled && 'pointer-events-none opacity-50',
                )}
              >
                <input
                  type={multiple ? 'checkbox' : 'radio'}
                  name={id}
                  value={option}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    if (!multiple) onChange(option)
                    else onChange(checked ? selected.filter((item) => item !== option) : [...selected, option])
                  }}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid h-[18px] w-[18px] shrink-0 place-items-center border-[1.6px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--primary)]/35',
                    multiple ? 'rounded-[6px]' : 'rounded-full',
                    checked ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--control-border)] bg-[var(--surface)]',
                  )}
                >
                  {checked ? (multiple ? <CheckIcon size={11} weight="bold" /> : <span className="h-1.5 w-1.5 rounded-full bg-white" />) : null}
                </span>
                <span className="min-w-0 flex-1 font-medium" data-i18n-skip="true">{option}</span>
              </label>
            )
          })}
        </div>
      )
      break
    }
    case 'checkbox':
      control = null
      break
    case 'file':
    case 'image':
      control = (
        <FilePicker
          id={id}
          kind={field.type}
          accept={effectiveAccept(field)}
          files={files}
          onAdd={(chosen) => onAddFiles?.(chosen)}
          onRemove={(fileId) => onRemoveFile?.(fileId)}
          keptFiles={keptFiles}
          invalid={Boolean(error)}
          disabled={disabled}
          describedBy={describedBy}
        />
      )
      break
    default:
      control = (
        <Input
          {...common}
          type="text"
          autoComplete={AUTOCOMPLETE[field.key]}
          value={text}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )
  }

  const help = (
    <>
      {field.help_text ? <p id={helpId} className="text-[12px] leading-[1.45] text-[var(--muted)]" data-i18n-skip="true">{field.help_text}</p> : null}
      {note ? <p id={field.help_text ? undefined : helpId} className="text-[12px] leading-[1.45] text-[var(--muted)]">{note}</p> : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-[12.5px] leading-[1.4] font-medium text-[var(--danger-text)]">
          <WarningCircleIcon size={15} weight="fill" className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </>
  )

  if (field.type === 'checkbox') {
    const checked = value === true
    return (
      <div data-field-key={field.key} className="flex flex-col gap-1.5">
        <label
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-[12px] border px-3.5 py-3 transition-colors',
            checked ? 'border-[var(--primary)] bg-[var(--blue-dim)]' : 'border-[var(--border-hover)] bg-[var(--surface)] hover:border-[var(--control-border)]',
            error && !checked && 'border-[var(--danger)]',
            disabled && 'pointer-events-none opacity-50',
          )}
        >
          <Checkbox {...common} checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-px" />
          <span className="text-[13.5px] leading-[1.45] font-medium text-[var(--foreground)]">{labelNode}</span>
        </label>
        {help}
      </div>
    )
  }

  const grouped = field.type === 'radio' || field.type === 'multi_select'
  return (
    <div data-field-key={field.key} className="flex flex-col gap-1.5">
      {grouped ? (
        <span id={`${id}-label`} className="text-[13px] font-semibold text-[var(--foreground)]">{labelNode}</span>
      ) : (
        <label id={`${id}-label`} htmlFor={id} className="text-[13px] font-semibold text-[var(--foreground)]">{labelNode}</label>
      )}
      {control}
      {help}
    </div>
  )
}
