import { useEffect, useState, type ReactNode } from 'react'
import { ArrowClockwiseIcon, CheckIcon, LinkSimpleIcon, LockSimpleIcon, SealCheckIcon, WarningCircleIcon, XCircleIcon, XIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import {
  filesFromAnswer,
  registrationsService,
  type RegistrationField,
  type RegistrationFile,
  type RegistrationSubmission,
} from '../../../shared/api/services/registrations.service'
import { formatShortDate, formatShortDateTime } from '../../../shared/lib/format'
import { cn } from '../../../shared/lib/cn'
import { Button } from '../../../shared/ui/button'
import { Skeleton } from '../../../shared/ui/skeleton'
import { errorStatus } from '../lib/errors'
import { isFileType } from '../lib/fields'
import { FIELD_TYPE_ICONS, fieldLabel } from '../lib/labels'
import { PrivateFiles } from './PrivateFiles'
import { ApproveDialog, RejectDialog } from './ReviewDialogs'
import { SidePanel } from './SidePanel'
import { RegistrationStatusBadge } from './StatusBadge'
import { ApplicantAvatar } from './ApplicantAvatar'

type ApplicationPanelProps = {
  submissionId: string
  canReview: boolean
  onClose: () => void
  /** After approve / reject: refresh the list and the link counters. */
  onReviewed: () => void
}

function isEmptyAnswer(value: unknown) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
}

function Empty() {
  const { t } = useLocale()
  return <span className="text-[13px] text-[var(--caption)]">{t('registrations.applications.not_filled', 'Not filled')}</span>
}

/** One answer, formatted by the type it had when the applicant submitted (fields_snapshot). */
function AnswerValue({ field, value, files, passwordSet }: { field: RegistrationField; value: unknown; files: RegistrationFile[]; passwordSet: boolean }) {
  const { t, locale } = useLocale()
  if (field.type === 'password') {
    return passwordSet || !isEmptyAnswer(value) ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success-dim)] px-2.5 py-1 text-[12px] font-semibold text-[var(--success-text)]">
        <LockSimpleIcon size={13} weight="bold" /> {t('registrations.applications.password_set', 'Password set')}
      </span>
    ) : (
      <Empty />
    )
  }
  if (isFileType(field.type)) return files.length ? <PrivateFiles files={files} /> : <Empty />
  if (field.type === 'checkbox') {
    const checked = value === true || value === 'true' || value === 1
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-[13.5px] font-medium', checked ? 'text-[var(--success-text)]' : 'text-[var(--muted-strong)]')}>
        {checked ? <CheckIcon size={15} weight="bold" /> : <XIcon size={15} />}
        {checked ? t('registrations.common.yes', 'Yes') : t('registrations.common.no', 'No')}
      </span>
    )
  }
  if (isEmptyAnswer(value)) return <Empty />
  if (field.type === 'multi_select' || Array.isArray(value)) {
    const items = (Array.isArray(value) ? value : [value]).map(String)
    return (
      <span className="flex flex-wrap gap-1.5" data-i18n-skip="true">
        {items.map((item) => <span key={item} className="rounded-full bg-[var(--blue-dim)] px-2.5 py-1 text-[12px] font-semibold text-[var(--blue-text)]">{item}</span>)}
      </span>
    )
  }
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  switch (field.type) {
    case 'email':
      return <a href={`mailto:${text}`} className="text-[13.5px] font-medium break-all text-[var(--primary)] hover:underline" data-i18n-skip="true">{text}</a>
    case 'phone':
      return <a href={`tel:${text.replace(/[^\d+]/g, '')}`} className="text-[13.5px] font-medium text-[var(--primary)] tabular-nums hover:underline" data-i18n-skip="true">{text}</a>
    case 'date':
      return <span className="text-[13.5px] text-[var(--foreground)] tabular-nums">{formatShortDate(text, locale)}</span>
    case 'datetime':
      return <span className="text-[13.5px] text-[var(--foreground)] tabular-nums">{formatShortDateTime(text, locale)}</span>
    case 'select':
    case 'radio':
      return <span className="inline-flex rounded-full bg-[var(--blue-dim)] px-2.5 py-1 text-[12px] font-semibold text-[var(--blue-text)]" data-i18n-skip="true">{text}</span>
    default:
      return <span className="text-[13.5px] leading-[1.55] break-words whitespace-pre-wrap text-[var(--foreground)]" data-i18n-skip="true">{text}</span>
  }
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] text-[var(--muted)]">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-medium text-[var(--foreground)]">{children}</dd>
    </div>
  )
}

/** Application detail: answers rendered with the snapshot schema, private files, approve / reject. */
export function ApplicationPanel({ submissionId, canReview, onClose, onReviewed }: ApplicationPanelProps) {
  const { t, locale } = useLocale()
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState<{ version: number; submission?: RegistrationSubmission; status?: number | null } | null>(null)
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)

  useEffect(() => {
    let alive = true
    registrationsService.getSubmission(submissionId)
      .then((submission) => { if (alive) setResult({ version, submission }) })
      .catch((error: unknown) => { if (alive) setResult({ version, status: errorStatus(error) }) })
    return () => { alive = false }
  }, [submissionId, version])

  const submission = result?.submission ?? null
  const loading = !result || (result.version !== version && !submission)
  const failed = result && !result.submission && result.version === version
  const fullName = submission ? [submission.name, submission.surname].filter(Boolean).join(' ') : ''

  function reviewed() {
    setDialog(null)
    setVersion((value) => value + 1)
    onReviewed()
  }

  // Answers by the snapshot; unknown keys and unassigned files are listed after it.
  const snapshot = submission?.fields_snapshot ?? []
  const snapshotKeys = new Set(snapshot.map((field) => field.key))
  const filesFor = (field: RegistrationField) => {
    if (!submission) return []
    const listed = submission.files.filter((file) => file.field_key === field.key)
    const inAnswer = filesFromAnswer(submission.answers[field.key], field.key).filter((file) => !listed.some((other) => (other.id && other.id === file.id) || other.name === file.name))
    return [...listed, ...inAnswer]
  }
  const extraAnswers = submission ? Object.entries(submission.answers).filter(([key, value]) => !snapshotKeys.has(key) && !isEmptyAnswer(value)) : []
  const looseFiles = submission ? submission.files.filter((file) => !file.field_key || !snapshotKeys.has(file.field_key)) : []

  return (
    <SidePanel
      open
      onClose={onClose}
      width="sm:max-w-[620px]"
      title={submission ? <span data-i18n-skip="true">{fullName || submission.email || '—'}</span> : t('registrations.applications.detail', 'Application')}
      subtitle={submission?.form_title ? <span className="inline-flex items-center gap-1"><LinkSimpleIcon size={12} /><span data-i18n-skip="true">{submission.form_title}</span></span> : undefined}
      headerExtra={submission ? <RegistrationStatusBadge status={submission.status} className="mt-1 shrink-0" /> : undefined}
      footer={submission && submission.status === 'pending' && canReview ? (
        <>
          <Button variant="danger" onClick={() => setDialog('reject')} leftIcon={<XCircleIcon size={16} weight="bold" />}>{t('registrations.applications.reject', 'Reject')}</Button>
          <Button onClick={() => setDialog('approve')} leftIcon={<SealCheckIcon size={16} weight="bold" />}>{t('registrations.applications.approve', 'Approve')}</Button>
        </>
      ) : undefined}
    >
      {loading ? (
        <div className="flex flex-col gap-4 px-5 py-5 sm:px-6" aria-busy="true">
          <Skeleton className="h-[76px]" rounded="lg" />
          <Skeleton className="h-14" />
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-12" />)}
        </div>
      ) : failed ? (
        <div className="grid place-items-center px-6 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-[var(--danger-dim)] text-[var(--danger-text)]"><WarningCircleIcon size={24} weight="duotone" /></span>
          <p className="mt-3 text-[15px] font-semibold text-[var(--foreground)]">
            {result?.status === 404 ? t('registrations.applications.not_found', 'This application no longer exists') : t('registrations.applications.load_failed', 'Could not load the application')}
          </p>
          {result?.status !== 404 ? (
            <Button variant="secondary" className="mt-4" leftIcon={<ArrowClockwiseIcon size={15} />} onClick={() => setVersion((value) => value + 1)}>
              {t('registrations.common.retry', 'Try again')}
            </Button>
          ) : null}
        </div>
      ) : submission ? (
        <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3.5 rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-4">
            <ApplicantAvatar name={fullName || submission.email} size={48} />
            <div className="min-w-0">
              <p className="truncate text-[15.5px] font-semibold text-[var(--foreground)]" data-i18n-skip="true">{fullName || '—'}</p>
              {submission.email ? <a href={`mailto:${submission.email}`} className="block truncate text-[13px] text-[var(--primary)] hover:underline" data-i18n-skip="true">{submission.email}</a> : null}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-[16px] bg-[var(--muted-surface)] px-4 py-3.5">
            <Meta label={t('registrations.applications.submitted', 'Submitted')}>{submission.created_at ? formatShortDateTime(submission.created_at, locale) : '—'}</Meta>
            {submission.updated_at && submission.updated_at !== submission.created_at ? (
              <Meta label={t('registrations.applications.updated', 'Last change')}>{formatShortDateTime(submission.updated_at, locale)}</Meta>
            ) : null}
            {submission.reviewed_at ? <Meta label={t('registrations.applications.reviewed', 'Reviewed')}>{formatShortDateTime(submission.reviewed_at, locale)}</Meta> : null}
            {submission.reviewed_by ? <Meta label={t('registrations.applications.reviewed_by', 'Reviewed by')}><span data-i18n-skip="true">{submission.reviewed_by}</span></Meta> : null}
            {submission.form_slug ? <Meta label={t('registrations.applications.link', 'Link')}><span className="font-mono text-[12px]" data-i18n-skip="true">/register/{submission.form_slug}</span></Meta> : null}
          </dl>

          {submission.status === 'rejected' ? (
            <div className="rounded-[14px] border border-[var(--danger-border)] bg-[var(--danger-dim)] px-4 py-3">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--danger-text)]"><XCircleIcon size={16} weight="fill" /> {t('registrations.applications.rejected_title', 'Rejected')}</p>
              <p className="mt-1 text-[13px] leading-[1.5] whitespace-pre-wrap text-[var(--foreground)]" data-i18n-skip="true">
                {submission.rejection_reason || t('registrations.applications.no_reason', 'No reason was given.')}
              </p>
            </div>
          ) : submission.status === 'approved' ? (
            <div className="rounded-[14px] border border-[var(--success-border)] bg-[var(--success-dim)] px-4 py-3">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--success-text)]"><SealCheckIcon size={16} weight="fill" /> {t('registrations.applications.approved_title', 'User account created')}</p>
              {submission.role_name || submission.job_title || submission.user_id ? (
                <p className="mt-1 text-[13px] text-[var(--foreground)]" data-i18n-skip="true">
                  {[submission.role_name, submission.job_title, submission.user_id ? `ID ${submission.user_id}` : null].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </div>
          ) : null}

          <section className="flex flex-col gap-2">
            <h3 className="text-[13.5px] font-semibold text-[var(--foreground)]">{t('registrations.applications.answers', 'Answers')}</h3>
            {snapshot.length ? (
              <dl className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--card)]">
                {snapshot.map((field) => {
                  const Icon = FIELD_TYPE_ICONS[field.type]
                  return (
                    <div key={field.key} className="grid gap-1.5 px-4 py-3 sm:grid-cols-[minmax(0,190px)_minmax(0,1fr)] sm:gap-4">
                      <dt className="flex min-w-0 items-start gap-1.5 pt-0.5 text-[12.5px] text-[var(--muted)]">
                        <Icon size={14} className="mt-px shrink-0" />
                        <span className="min-w-0 break-words" data-i18n-skip="true">{fieldLabel(t, field)}</span>
                      </dt>
                      <dd className="min-w-0">
                        <AnswerValue field={field} value={submission.answers[field.key]} files={filesFor(field)} passwordSet={submission.password_set} />
                      </dd>
                    </div>
                  )
                })}
              </dl>
            ) : (
              <p className="rounded-[14px] bg-[var(--muted-surface)] px-4 py-3 text-[12.5px] text-[var(--muted)]">{t('registrations.applications.no_snapshot', 'The form schema of this application is not available — raw answers are shown below.')}</p>
            )}
          </section>

          {extraAnswers.length ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-[13.5px] font-semibold text-[var(--foreground)]">{t('registrations.applications.other_answers', 'Other data')}</h3>
              <dl className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--card)]">
                {extraAnswers.map(([key, value]) => (
                  <div key={key} className="grid gap-1.5 px-4 py-3 sm:grid-cols-[minmax(0,190px)_minmax(0,1fr)] sm:gap-4">
                    <dt className="font-mono text-[12px] text-[var(--muted)]" data-i18n-skip="true">{key}</dt>
                    <dd className="min-w-0">
                      <AnswerValue field={{ key, label: key, type: 'text', required: false, placeholder: null, help_text: null, options: [], accept: [] }} value={value} files={[]} passwordSet={false} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {looseFiles.length ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-[13.5px] font-semibold text-[var(--foreground)]">{t('registrations.applications.files', 'Files')}</h3>
              <PrivateFiles files={looseFiles} />
            </section>
          ) : null}
        </div>
      ) : null}

      {submission && dialog === 'approve' ? <ApproveDialog submission={submission} onClose={() => setDialog(null)} onDone={reviewed} /> : null}
      {submission && dialog === 'reject' ? <RejectDialog submission={submission} onClose={() => setDialog(null)} onDone={reviewed} /> : null}
    </SidePanel>
  )
}
