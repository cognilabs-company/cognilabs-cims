import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowClockwiseIcon, LinkBreakIcon, LockSimpleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import {
  filesFromAnswer,
  registrationsService,
  type PublicRegistrationForm,
  type PublicSubmissionStatus,
  type RegistrationSubmissionBody,
} from '../../../shared/api/services/registrations.service'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { Button } from '../../../shared/ui/button'
import { Skeleton } from '../../../shared/ui/skeleton'
import { PublicForm } from '../components/PublicForm'
import { PublicLayout } from '../components/PublicLayout'
import { PublicStatus } from '../components/PublicStatus'
import { errorStatus } from '../lib/errors'
import { isFileType } from '../lib/fields'
import { clearReceipt, readReceipt, saveReceipt, type StoredReceipt } from '../lib/storage'
import type { FormValues } from '../lib/values'

/** /register/:slug — public (no login): the applicant fills in the form, then follows the decision. */
export function PublicRegistrationPage() {
  const { slug = '' } = useParams()
  return (
    <PublicLayout>
      <PublicRegistration key={slug} slug={slug} />
    </PublicLayout>
  )
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={['rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-lg)] sm:p-8', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

function Message({ icon, tone, title, text, action }: { icon: ReactNode; tone: 'muted' | 'danger' | 'warning'; title: string; text: string; action?: ReactNode }) {
  const ring = tone === 'danger' ? 'bg-[var(--danger-dim)] text-[var(--danger-text)]' : tone === 'warning' ? 'bg-[var(--warning-dim)] text-[var(--warning-text)]' : 'bg-[var(--muted-surface)] text-[var(--muted-strong)]'
  return (
    <Card className="flex flex-col items-center py-10 text-center sm:py-12">
      <span className={`grid h-16 w-16 place-items-center rounded-full ${ring}`}>{icon}</span>
      <h1 className="mt-4 text-[20px] leading-tight font-bold tracking-[-0.02em] text-[var(--foreground)]">{title}</h1>
      <p className="mt-2 max-w-[380px] text-[14px] leading-relaxed text-[var(--muted-strong)]">{text}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </Card>
  )
}

function LoadingCard() {
  return (
    <Card>
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="mt-2 flex flex-col gap-2"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-10 w-full" /></div>
        ))}
        <Skeleton className="mt-3 h-11 w-full" rounded="lg" />
      </div>
    </Card>
  )
}

type FormResult = { attempt: number; form?: PublicRegistrationForm; status?: number | null }
type StatusResult = { key: string; data?: PublicSubmissionStatus; failed?: boolean }

function PublicRegistration({ slug }: { slug: string }) {
  const { t } = useLocale()
  const { confirm } = useConfirm()
  const [receipt, setReceipt] = useState<StoredReceipt | null>(() => readReceipt(slug))
  const [formAttempt, setFormAttempt] = useState(0)
  const [formResult, setFormResult] = useState<FormResult | null>(null)
  const [statusAttempt, setStatusAttempt] = useState(0)
  const [statusResult, setStatusResult] = useState<StatusResult | null>(null)
  const [editing, setEditing] = useState(false)
  /** Shown when the backend accepted the application but returned no token to follow it. */
  const [untracked, setUntracked] = useState<PublicSubmissionStatus | null>(null)

  useEffect(() => {
    let alive = true
    registrationsService.publicForm(slug)
      .then((form) => { if (alive) setFormResult({ attempt: formAttempt, form }) })
      .catch((error: unknown) => { if (alive) setFormResult({ attempt: formAttempt, status: errorStatus(error) }) })
    return () => { alive = false }
  }, [formAttempt, slug])

  useEffect(() => {
    if (!receipt) return
    let alive = true
    const key = `${receipt.submission_id}:${statusAttempt}`
    registrationsService.status(slug, receipt.submission_id, receipt.edit_token)
      .then((data) => { if (alive) setStatusResult({ key, data }) })
      .catch((error: unknown) => {
        if (!alive) return
        const status = errorStatus(error)
        // The token is unknown / expired → forget it and show the form again.
        if (status === 401 || status === 403 || status === 404 || status === 422) {
          clearReceipt(slug)
          setReceipt(null)
          setStatusResult(null)
          return
        }
        setStatusResult((current) => ({ key, data: current?.data, failed: true }))
      })
    return () => { alive = false }
  }, [receipt, slug, statusAttempt])

  const form = formResult?.form ?? null
  const formLoading = !formResult || (formResult.attempt !== formAttempt && !form)

  useEffect(() => {
    if (!form?.title) return
    const previous = document.title
    document.title = `${form.title} · Cognilabs`
    return () => { document.title = previous }
  }, [form?.title])

  async function submitNew(body: RegistrationSubmissionBody, values: FormValues) {
    const result = await registrationsService.submit(slug, body)
    const email = typeof values.email === 'string' ? values.email.trim() : ''
    const fresh: PublicSubmissionStatus = {
      id: result.submission_id,
      status: result.status,
      rejection_reason: null,
      email: email || null,
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
      answers: {},
      files: [],
      fields_snapshot: [],
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (!result.submission_id || !result.edit_token) {
      setUntracked(fresh)
      return
    }
    const stored = { submission_id: result.submission_id, edit_token: result.edit_token }
    saveReceipt(slug, stored)
    setStatusResult({ key: `${stored.submission_id}:${statusAttempt}`, data: fresh })
    setReceipt(stored)
  }

  async function resubmit(body: RegistrationSubmissionBody) {
    if (!receipt) return
    const previous = statusResult?.data ?? null
    const { status, edit_token: rotated } = await registrationsService.resubmit(slug, receipt.submission_id, receipt.edit_token, body)
    const next = rotated && rotated !== receipt.edit_token ? { ...receipt, edit_token: rotated } : receipt
    if (next !== receipt) saveReceipt(slug, next)
    const merged: PublicSubmissionStatus = {
      ...(previous ?? status),
      ...status,
      id: status.id || receipt.submission_id,
      status: status.status,
      rejection_reason: status.status === 'rejected' ? status.rejection_reason : null,
      email: status.email ?? previous?.email ?? null,
      submitted_at: status.submitted_at ?? new Date().toISOString(),
      reviewed_at: status.status === 'pending' ? null : status.reviewed_at,
    }
    const attempt = statusAttempt + 1
    setStatusResult({ key: `${next.submission_id}:${attempt}`, data: merged })
    setStatusAttempt(attempt)
    setReceipt(next)
    setEditing(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function startOver() {
    const ok = await confirm({
      title: t('registrations.public.start_over_title', 'Start a new application?'),
      description: t('registrations.public.start_over_text', 'This device stops following the current application. It is not deleted — the team still sees it.'),
      confirmLabel: t('registrations.public.start_over_confirm', 'New application'),
      cancelLabel: t('registrations.common.cancel', 'Cancel'),
    })
    if (!ok) return
    clearReceipt(slug)
    setReceipt(null)
    setStatusResult(null)
    setUntracked(null)
    setEditing(false)
  }

  if (untracked) {
    return (
      <Card>
        <PublicStatus status={untracked} formTitle={form?.title ?? null} refreshing={false} onRefresh={() => undefined} onEdit={null} onStartOver={() => setUntracked(null)} />
      </Card>
    )
  }

  if (receipt) {
    const currentKey = `${receipt.submission_id}:${statusAttempt}`
    const data = statusResult?.data
    if (!data) {
      if (statusResult?.failed && statusResult.key === currentKey) {
        return (
          <Message
            icon={<WarningCircleIcon size={30} weight="duotone" />}
            tone="danger"
            title={t('registrations.public.status_failed', 'Could not check your application')}
            text={t('registrations.common.check_connection', 'Check the connection and try again.')}
            action={<Button onClick={() => setStatusAttempt((value) => value + 1)} leftIcon={<ArrowClockwiseIcon size={16} />}>{t('registrations.common.retry', 'Try again')}</Button>}
          />
        )
      }
      return <LoadingCard />
    }

    if (editing && data.status === 'rejected' && form) {
      const keptFiles: Record<string, string[]> = {}
      for (const field of form.fields) {
        if (!isFileType(field.type)) continue
        const names = [
          ...data.files.filter((file) => file.field_key === field.key).map((file) => file.name),
          ...filesFromAnswer(data.answers[field.key], field.key).map((file) => file.name),
        ]
        if (names.length) keptFiles[field.key] = [...new Set(names)]
      }
      return (
        <Card>
          <FormHeader form={form} />
          <PublicForm
            form={form}
            mode="edit"
            answers={data.answers}
            keptFiles={keptFiles}
            rejectionReason={data.rejection_reason}
            submit={(body) => resubmit(body)}
            onCancelEdit={() => setEditing(false)}
          />
        </Card>
      )
    }

    const canResubmit = data.status === 'rejected' && Boolean(form?.is_active)
    return (
      <Card>
        <PublicStatus
          status={data}
          formTitle={form?.title ?? null}
          refreshing={statusResult?.key !== currentKey}
          onRefresh={() => setStatusAttempt((value) => value + 1)}
          onEdit={canResubmit ? () => { setEditing(true); window.scrollTo({ top: 0 }) } : null}
          onStartOver={() => void startOver()}
        />
      </Card>
    )
  }

  if (formLoading) return <LoadingCard />

  if (!form) {
    return formResult?.status === 404 || formResult?.status === 410 ? (
      <Message
        icon={<LinkBreakIcon size={30} weight="duotone" />}
        tone="muted"
        title={t('registrations.public.not_found_title', 'This link does not work')}
        text={t('registrations.public.not_found_text', 'The registration link is wrong or no longer exists. Ask the person who sent it for a new one.')}
      />
    ) : (
      <Message
        icon={<WarningCircleIcon size={30} weight="duotone" />}
        tone="danger"
        title={t('registrations.public.load_failed', 'Could not open the form')}
        text={t('registrations.common.check_connection', 'Check the connection and try again.')}
        action={<Button onClick={() => setFormAttempt((value) => value + 1)} leftIcon={<ArrowClockwiseIcon size={16} />}>{t('registrations.common.retry', 'Try again')}</Button>}
      />
    )
  }

  if (!form.is_active) {
    return (
      <Message
        icon={<LockSimpleIcon size={30} weight="duotone" />}
        tone="warning"
        title={t('registrations.public.closed_title', 'Registration is closed')}
        text={t('registrations.public.closed_text', 'This form no longer accepts applications.')}
      />
    )
  }

  return (
    <Card>
      <FormHeader form={form} />
      <PublicForm form={form} mode="create" submit={submitNew} />
    </Card>
  )
}

function FormHeader({ form }: { form: PublicRegistrationForm }) {
  return (
    <div className="mb-7">
      <h1 className="text-[24px] leading-tight font-bold tracking-[-0.025em] text-[var(--foreground)] sm:text-[27px]" data-i18n-skip="true">{form.title}</h1>
      {form.description ? (
        <p className="mt-2.5 text-[14px] leading-relaxed whitespace-pre-line text-[var(--muted-strong)]" data-i18n-skip="true">{form.description}</p>
      ) : null}
    </div>
  )
}
