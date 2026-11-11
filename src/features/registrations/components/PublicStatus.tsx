import { Link } from 'react-router-dom'
import { ArrowClockwiseIcon, HourglassMediumIcon, NotePencilIcon, SealCheckIcon, SignInIcon, XCircleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { PublicSubmissionStatus } from '../../../shared/api/services/registrations.service'
import { formatShortDateTime } from '../../../shared/lib/format'
import { cn } from '../../../shared/lib/cn'
import { Button } from '../../../shared/ui/button'

type PublicStatusProps = {
  status: PublicSubmissionStatus
  formTitle: string | null
  refreshing: boolean
  onRefresh: () => void
  /** Rejected and the link still accepts applications → edit and resubmit. */
  onEdit: (() => void) | null
  onStartOver: () => void
}

const TONES = {
  pending: { icon: HourglassMediumIcon, ring: 'bg-[var(--warning-dim)] text-[var(--warning-text)]' },
  approved: { icon: SealCheckIcon, ring: 'bg-[var(--success-dim)] text-[var(--success-text)]' },
  rejected: { icon: XCircleIcon, ring: 'bg-[var(--danger-dim)] text-[var(--danger-text)]' },
} as const

/** What happened to the application (checked with the stored edit token). */
export function PublicStatus({ status, formTitle, refreshing, onRefresh, onEdit, onStartOver }: PublicStatusProps) {
  const { t, locale } = useLocale()
  const tone = TONES[status.status]
  const Icon = tone.icon

  const title = status.status === 'approved'
    ? t('registrations.public.approved_title', 'Your application is approved')
    : status.status === 'rejected'
      ? t('registrations.public.rejected_title', 'Your application was not approved')
      : t('registrations.public.pending_title', 'Application received')
  const text = status.status === 'approved'
    ? t('registrations.public.approved_text', 'Your account is ready. Sign in with your email and the password you chose.')
    : status.status === 'rejected'
      ? t('registrations.public.rejected_text', 'You can correct your answers and send the application again.')
      : t('registrations.public.pending_text', 'We will review it soon. Come back to this page on this device to see the decision.')

  return (
    <div className="flex flex-col items-center text-center">
      <span className={cn('grid h-16 w-16 place-items-center rounded-full animate-[mm-pop_420ms_cubic-bezier(0.16,1,0.3,1)_backwards]', tone.ring)}>
        <Icon size={32} weight="duotone" />
      </span>
      {formTitle ? <p className="mt-4 text-[12px] font-semibold tracking-[0.04em] text-[var(--muted)] uppercase" data-i18n-skip="true">{formTitle}</p> : null}
      <h1 className="mt-1.5 text-[22px] leading-tight font-bold tracking-[-0.02em] text-[var(--foreground)]">{title}</h1>
      <p className="mt-2 max-w-[400px] text-[14px] leading-relaxed text-[var(--muted-strong)]">{text}</p>

      {status.status === 'rejected' && status.rejection_reason ? (
        <div className="mt-5 w-full rounded-[14px] border border-[var(--danger-border)] bg-[var(--danger-dim)] px-4 py-3 text-left">
          <p className="text-[12px] font-semibold text-[var(--danger-text)]">{t('registrations.public.reason', 'Reason')}</p>
          <p className="mt-0.5 text-[13.5px] leading-[1.5] whitespace-pre-wrap text-[var(--foreground)]" data-i18n-skip="true">{status.rejection_reason}</p>
        </div>
      ) : null}

      <dl className="mt-5 grid w-full gap-px overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--border-subtle)] text-left">
        {status.email ? (
          <div className="flex items-center justify-between gap-3 bg-[var(--card)] px-4 py-2.5">
            <dt className="text-[12.5px] text-[var(--muted)]">{t('registrations.public.email', 'Email')}</dt>
            <dd className="min-w-0 truncate text-[13px] font-medium text-[var(--foreground)]" data-i18n-skip="true">{status.email}</dd>
          </div>
        ) : null}
        {status.submitted_at ? (
          <div className="flex items-center justify-between gap-3 bg-[var(--card)] px-4 py-2.5">
            <dt className="text-[12.5px] text-[var(--muted)]">{t('registrations.public.submitted', 'Sent')}</dt>
            <dd className="text-[13px] font-medium text-[var(--foreground)] tabular-nums">{formatShortDateTime(status.submitted_at, locale)}</dd>
          </div>
        ) : null}
        {status.reviewed_at ? (
          <div className="flex items-center justify-between gap-3 bg-[var(--card)] px-4 py-2.5">
            <dt className="text-[12.5px] text-[var(--muted)]">{t('registrations.public.reviewed', 'Reviewed')}</dt>
            <dd className="text-[13px] font-medium text-[var(--foreground)] tabular-nums">{formatShortDateTime(status.reviewed_at, locale)}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-6 flex w-full flex-col gap-2">
        {status.status === 'approved' ? (
          <Button asChild size="lg" className="w-full">
            <Link to="/auth/login"><SignInIcon size={17} weight="bold" />{t('registrations.public.sign_in', 'Sign in')}</Link>
          </Button>
        ) : null}
        {status.status === 'rejected' && onEdit ? (
          <Button size="lg" className="w-full" onClick={onEdit} leftIcon={<NotePencilIcon size={17} weight="bold" />}>{t('registrations.public.edit', 'Edit and resubmit')}</Button>
        ) : null}
        {status.status === 'rejected' && !onEdit ? (
          <p className="text-[12.5px] text-[var(--muted)]">{t('registrations.public.closed_no_edit', 'This link no longer accepts applications, so it cannot be resubmitted.')}</p>
        ) : null}
        {status.status === 'pending' ? (
          <Button size="lg" variant="secondary" className="w-full" onClick={onRefresh} loading={refreshing} leftIcon={<ArrowClockwiseIcon size={17} />}>
            {t('registrations.public.check_again', 'Check the status')}
          </Button>
        ) : null}
      </div>
      <button type="button" onClick={onStartOver} className="mt-4 text-[12.5px] font-medium text-[var(--muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline">
        {t('registrations.public.start_over', 'Not you? Fill in a new application')}
      </button>
    </div>
  )
}
