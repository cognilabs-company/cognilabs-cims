import { useState, type FormEvent } from 'react'
import { ArrowLeftIcon, PaperPlaneTiltIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import {
  REGISTRATION_MAX_TOTAL_BYTES,
  type PublicRegistrationForm,
  type RegistrationSubmissionBody,
} from '../../../shared/api/services/registrations.service'
import { cn } from '../../../shared/lib/cn'
import { Button } from '../../../shared/ui/button'
import { errorStatus, fieldErrorsFromApi, serverMessage } from '../lib/errors'
import { isFileType } from '../lib/fields'
import { totalLimitMessage, valueIssueMessage } from '../lib/labels'
import { usePickedFiles } from '../lib/usePickedFiles'
import {
  buildSubmissionBody,
  emptyValue,
  exceedsTotal,
  formatBytes,
  initialValues,
  totalBytes,
  validateValues,
  type FormValue,
  type FormValues,
} from '../lib/values'
import { FieldInput } from './FieldInput'

type PublicFormProps = {
  form: PublicRegistrationForm
  mode: 'create' | 'edit'
  /** Saved answers of a rejected application (prefill). */
  answers?: Record<string, unknown>
  /** Names of files already stored per field (rejected application). */
  keptFiles?: Record<string, string[]>
  rejectionReason?: string | null
  /** Sends the body; throws the request() error on failure. */
  submit: (body: RegistrationSubmissionBody, values: FormValues) => Promise<void>
  onCancelEdit?: () => void
}

type Banner = { title: string; text?: string }

/** The applicant's form: client checks, JSON / multipart body, server errors next to the fields. */
export function PublicForm({ form, mode, answers, keptFiles = {}, rejectionReason, submit, onCancelEdit }: PublicFormProps) {
  const { t } = useLocale()
  const [values, setValues] = useState<FormValues>(() => initialValues(form.fields, answers))
  const { files, add, remove } = usePickedFiles()
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<Banner | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const keptCount = Object.fromEntries(Object.entries(keptFiles).map(([key, names]) => [key, names.length]))
  const issues = validateValues(form.fields, values, files, keptCount)
  const usedBytes = totalBytes(files)
  const hasFileFields = form.fields.some((field) => isFileType(field.type))
  const overTotal = exceedsTotal(files)

  function errorFor(key: string) {
    if (serverErrors[key]) return serverErrors[key]
    const issue = issues[key]
    if (!issue) return undefined
    // Wrong type / too large are shown at once; "required" etc. only after the first try.
    if (attempted || issue.code === 'accept' || issue.code === 'file_size') return valueIssueMessage(t, issue)
    return undefined
  }

  function clearServerError(key: string) {
    if (serverErrors[key]) setServerErrors((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function change(key: string, value: FormValue) {
    setValues((current) => ({ ...current, [key]: value }))
    clearServerError(key)
  }

  function focusFirst(keys: string[]) {
    const first = form.fields.find((field) => keys.includes(field.key))
    if (!first) return
    window.requestAnimationFrame(() => {
      const container = document.querySelector<HTMLElement>(`[data-field-key="${first.key}"]`)
      container?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      container?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, button')?.focus({ preventScroll: true })
    })
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    setAttempted(true)
    setBanner(null)
    const invalid = Object.keys(issues)
    if (invalid.length) {
      focusFirst(invalid)
      return
    }
    if (overTotal) {
      setBanner({ title: totalLimitMessage(t) })
      return
    }
    setSubmitting(true)
    setServerErrors({})
    try {
      await submit(buildSubmissionBody(form.fields, values, files), values)
    } catch (error) {
      const status = errorStatus(error)
      const message = serverMessage(error)
      if (status === 409) {
        if (mode === 'create' || /mail/i.test(message)) {
          const text = t('registrations.form.error.email_taken', 'This email is already registered or has an application')
          setServerErrors({ email: text })
          setBanner({ title: text, text: t('registrations.form.error.email_taken_hint', 'Use another email, or sign in if you already have an account.') })
          focusFirst(['email'])
        } else {
          setBanner({ title: t('registrations.form.error.state', 'This application can no longer be changed'), text: message || undefined })
        }
      } else if (status === 413) {
        setBanner({ title: t('registrations.form.error.too_large', 'The files are too large'), text: t('registrations.form.error.too_large_hint', 'Each file must be under 25 MB and all files together under 100 MB.') })
      } else if (status === 422 || status === 400) {
        const mapped = fieldErrorsFromApi(error, form.fields.map((field) => field.key))
        setServerErrors(mapped)
        if (Object.keys(mapped).length) {
          setBanner({ title: t('registrations.form.error.check_fields', 'Check the highlighted fields') })
          focusFirst(Object.keys(mapped))
        } else {
          setBanner({ title: t('registrations.form.error.invalid', 'Some answers were not accepted'), text: message || undefined })
        }
      } else if (status === 404 || status === 410 || status === 403) {
        setBanner({ title: t('registrations.form.error.closed', 'This registration link is no longer accepting applications'), text: message || undefined })
      } else if (status === null) {
        setBanner({ title: t('registrations.common.network', 'No connection to the server. Try again.') })
      } else {
        setBanner({ title: t('registrations.form.error.failed', 'Could not send the application'), text: message || t('registrations.form.error.try_later', 'Please try again in a moment.') })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const requiredExists = form.fields.some((field) => field.required)

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col">
      {mode === 'edit' ? (
        <div className="mb-5 rounded-[14px] border border-[var(--danger-border)] bg-[var(--danger-dim)] px-4 py-3">
          <p className="text-[13.5px] font-semibold text-[var(--danger-text)]">{t('registrations.public.edit_title', 'Correct your application and send it again')}</p>
          {rejectionReason ? <p className="mt-1 text-[13px] leading-[1.5] whitespace-pre-wrap text-[var(--foreground)]" data-i18n-skip="true">{rejectionReason}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-5">
        {form.fields.map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            idPrefix="reg"
            value={values[field.key] ?? emptyValue(field)}
            onChange={(value) => change(field.key, value)}
            files={files[field.key]}
            onAddFiles={(list) => { add(field.key, list); clearServerError(field.key) }}
            onRemoveFile={(id) => { remove(field.key, id); clearServerError(field.key) }}
            keptFiles={keptFiles[field.key]}
            error={errorFor(field.key)}
            disabled={submitting}
            note={mode === 'edit' && field.type === 'password' ? t('registrations.public.password_again', 'For your security, enter your password again.') : undefined}
          />
        ))}
      </div>

      {hasFileFields && usedBytes > 0 ? (
        <div className="mt-5">
          <div className="flex items-center justify-between text-[11.5px] text-[var(--muted)] tabular-nums">
            <span>{t('registrations.form.files_total', 'Files: {{used}} of {{max}}', { used: formatBytes(usedBytes), max: formatBytes(REGISTRATION_MAX_TOTAL_BYTES) })}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--muted-surface)]">
            <div className={cn('h-full rounded-full transition-[width]', overTotal ? 'bg-[var(--danger)]' : 'bg-[var(--primary)]')} style={{ width: `${Math.min(100, (usedBytes / REGISTRATION_MAX_TOTAL_BYTES) * 100)}%` }} />
          </div>
          {overTotal ? <p className="mt-1 text-[12px] font-medium text-[var(--danger-text)]">{totalLimitMessage(t)}</p> : null}
        </div>
      ) : null}

      {banner ? (
        <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-[14px] bg-[var(--danger-dim)] px-4 py-3 text-[var(--danger-text)]">
          <WarningCircleIcon size={18} weight="fill" className="mt-px shrink-0" />
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold">{banner.title}</span>
            {banner.text ? <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-[var(--foreground)]">{banner.text}</span> : null}
          </span>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        {mode === 'edit' && onCancelEdit ? (
          <Button type="button" variant="ghost" size="lg" onClick={onCancelEdit} disabled={submitting} leftIcon={<ArrowLeftIcon size={16} />}>
            {t('registrations.public.back_to_status', 'Back')}
          </Button>
        ) : null}
        <Button type="submit" size="lg" loading={submitting} className="w-full sm:flex-1" rightIcon={<PaperPlaneTiltIcon size={16} weight="bold" />}>
          {submitting
            ? t('registrations.form.sending', 'Sending…')
            : mode === 'edit' ? t('registrations.form.resubmit', 'Send again') : t('registrations.form.submit', 'Submit application')}
        </Button>
      </div>
      {requiredExists ? (
        <p className="mt-3 text-center text-[11.5px] text-[var(--muted)]">
          <span className="text-[var(--danger-text)]">*</span> {t('registrations.form.required_note', 'Required fields')} · {t('registrations.form.password_note', 'Your password is stored encrypted and is never shown to anyone.')}
        </p>
      ) : null}
    </form>
  )
}
