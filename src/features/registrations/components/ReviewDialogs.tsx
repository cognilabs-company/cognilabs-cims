import { useEffect, useState } from 'react'
import { ArrowClockwiseIcon, SealCheckIcon, WarningCircleIcon, XCircleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { rbacService, toSelections, type PermissionSet, type RbacCatalog, type RbacRole } from '../../../shared/api/services/rbac.service'
import { registrationsService, type RegistrationSubmission } from '../../../shared/api/services/registrations.service'
import { useToast } from '../../../shared/toast/useToast'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { SelectField } from '../../../shared/ui/select-field'
import { Skeleton } from '../../../shared/ui/skeleton'
import { Textarea } from '../../../shared/ui/textarea'
import { errorStatus, serverMessage } from '../lib/errors'
import { PermissionMatrix } from './PermissionMatrix'

type ReviewDialogProps = {
  submission: RegistrationSubmission
  onClose: () => void
  /** Called after the backend accepted the decision. */
  onDone: () => void
}

function applicantName(submission: RegistrationSubmission) {
  return [submission.name, submission.surname].filter(Boolean).join(' ') || submission.email
}

/** A job title the applicant may already have typed into a custom field. */
function guessJobTitle(answers: Record<string, unknown>) {
  for (const key of ['job_title', 'position', 'lavozim', 'role', 'vacancy']) {
    const value = answers[key]
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 100)
  }
  return ''
}

/** Stable ref callback: scrolls the alert into view once, when it appears. */
const revealOnMount = (node: HTMLElement | null) => node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })

function Alert({ message }: { message: string }) {
  return (
    <div role="alert" ref={revealOnMount} className="flex items-start gap-2.5 rounded-[12px] bg-[var(--danger-dim)] px-3.5 py-3 text-[13px] leading-[1.45] text-[var(--danger-text)]">
      <WarningCircleIcon size={17} weight="fill" className="mt-px shrink-0" />
      <span>{message}</span>
    </div>
  )
}

/** Approve: role, job title, company code and direct permissions are chosen only here; the user is created on success. */
export function ApproveDialog({ submission, onClose, onDone }: ReviewDialogProps) {
  const { t } = useLocale()
  const { showToast } = useToast()
  const [data, setData] = useState<{ roles: RbacRole[]; catalog: RbacCatalog } | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [roleId, setRoleId] = useState('')
  const [jobTitle, setJobTitle] = useState(() => guessJobTitle(submission.answers))
  const [companyCode, setCompanyCode] = useState('oddiy')
  const [permissions, setPermissions] = useState<PermissionSet>({})
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([rbacService.roles(), rbacService.catalog()])
      .then(([roles, catalog]) => {
        if (!alive) return
        setData({ roles: roles.filter((role) => role.is_active && role.id > 0), catalog })
        setLoadFailed(false)
      })
      .catch(() => { if (alive) setLoadFailed(true) })
    return () => { alive = false }
  }, [attempt])

  const role = data?.roles.find((item) => String(item.id) === roleId) ?? null
  const roleMissing = attempted && !roleId
  const codeMissing = attempted && !companyCode.trim()

  async function approve() {
    setAttempted(true)
    if (!roleId || !companyCode.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await registrationsService.approve(submission.id, {
        role_id: Number(roleId),
        job_title: jobTitle.trim() || null,
        company_code: companyCode.trim(),
        direct_permissions: toSelections(permissions),
      })
      showToast({ title: t('registrations.approve.done', 'Application approved'), description: t('registrations.approve.done_text', 'The user account for {{name}} was created.', { name: applicantName(submission) }), tone: 'success' })
      onDone()
    } catch (caught) {
      const status = errorStatus(caught)
      const message = serverMessage(caught)
      if (status === 409) setError(message || t('registrations.approve.conflict', 'This application was already reviewed, or a user with this email already exists.'))
      else if (status === 403) setError(message || t('registrations.error.forbidden', 'You do not have permission for this'))
      else if (status === null) setError(t('registrations.common.network', 'No connection to the server. Try again.'))
      else setError(message || t('registrations.approve.failed', 'Could not approve the application'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open
      onClose={() => { if (!submitting) onClose() }}
      size="xl"
      title={t('registrations.approve.title', 'Approve application')}
      description={t('registrations.approve.description', 'A user account is created for {{name}} with the access you choose here.', { name: applicantName(submission) })}
      headerIcon={<SealCheckIcon weight="duotone" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('registrations.common.cancel', 'Cancel')}</Button>
          <Button onClick={() => void approve()} loading={submitting} disabled={!data} leftIcon={<SealCheckIcon size={16} weight="bold" />}>
            {t('registrations.approve.submit', 'Approve and create user')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? <Alert key={error} message={error} /> : null}
        {!data && !loadFailed ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
            <Skeleton className="h-16 sm:w-1/2" />
            <Skeleton className="h-48" rounded="lg" />
          </div>
        ) : loadFailed && !data ? (
          <div className="grid place-items-center gap-3 rounded-[14px] border border-dashed border-[var(--border-hover)] px-4 py-10 text-center">
            <p className="text-[13.5px] font-semibold text-[var(--foreground)]">{t('registrations.approve.load_failed', 'Could not load roles and permissions')}</p>
            <Button variant="secondary" size="sm" leftIcon={<ArrowClockwiseIcon size={14} />} onClick={() => { setLoadFailed(false); setAttempt((value) => value + 1) }}>
              {t('registrations.common.retry', 'Try again')}
            </Button>
          </div>
        ) : data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="approve-role" className="text-[12.5px] font-semibold text-[var(--muted-strong)]">
                  {t('registrations.approve.role', 'Role')} <span className="text-[var(--danger-text)]">*</span>
                </label>
                <SelectField
                  id="approve-role"
                  value={roleId}
                  onValueChange={(value) => { setRoleId(value); setError(null) }}
                  options={data.roles.map((item) => ({ value: String(item.id), label: item.display_name || item.name, hint: item.display_name && item.display_name !== item.name ? item.name : undefined }))}
                  placeholder={t('registrations.approve.role_placeholder', 'Choose a role')}
                  searchable={data.roles.length > 7}
                  searchPlaceholder={t('registrations.common.search', 'Search…')}
                  emptyMessage={t('registrations.common.nothing_found', 'Nothing found')}
                  aria-label={t('registrations.approve.role', 'Role')}
                  className={roleMissing ? 'border-[var(--danger)]' : undefined}
                />
                {roleMissing ? <p className="text-[12px] font-medium text-[var(--danger-text)]">{t('registrations.approve.role_required', 'Choose a role')}</p> : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="approve-job" className="text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('registrations.approve.job_title', 'Job title')}</label>
                <Input id="approve-job" value={jobTitle} maxLength={100} onChange={(event) => setJobTitle(event.target.value)} placeholder={t('registrations.approve.job_placeholder', 'e.g. Backend developer')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="approve-company" className="text-[12.5px] font-semibold text-[var(--muted-strong)]">
                  {t('registrations.approve.company_code', 'Company code')} <span className="text-[var(--danger-text)]">*</span>
                </label>
                <Input id="approve-company" value={companyCode} maxLength={255} onChange={(event) => setCompanyCode(event.target.value)} aria-invalid={codeMissing ? true : undefined} className="font-mono" />
                {codeMissing ? <p className="text-[12px] font-medium text-[var(--danger-text)]">{t('registrations.approve.company_required', 'Enter the company code')}</p> : null}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div>
                <p className="text-[13.5px] font-semibold text-[var(--foreground)]">{t('registrations.approve.permissions', 'Direct permissions')}</p>
                <p className="text-[12px] leading-[1.45] text-[var(--muted)]">
                  {role
                    ? t('registrations.approve.permissions_hint_role', 'Optional. “{{role}}” already sets the base access; tick only what this person needs in addition.', { role: role.display_name || role.name })
                    : t('registrations.approve.permissions_hint', 'Optional. Extra access on top of the role.')}
                </p>
              </div>
              <PermissionMatrix catalog={data.catalog} value={permissions} onChange={setPermissions} rolePermissions={role?.permissions ?? {}} disabled={submitting} />
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  )
}

/** Reject with an optional reason — the applicant sees it and may edit and resubmit. */
export function RejectDialog({ submission, onClose, onDone }: ReviewDialogProps) {
  const { t } = useLocale()
  const { showToast } = useToast()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reject() {
    setSubmitting(true)
    setError(null)
    try {
      await registrationsService.reject(submission.id, reason.trim() || null)
      showToast({ title: t('registrations.reject.done', 'Application rejected'), tone: 'success' })
      onDone()
    } catch (caught) {
      const status = errorStatus(caught)
      const message = serverMessage(caught)
      if (status === 409) setError(message || t('registrations.reject.conflict', 'This application was already reviewed.'))
      else if (status === 403) setError(message || t('registrations.error.forbidden', 'You do not have permission for this'))
      else if (status === null) setError(t('registrations.common.network', 'No connection to the server. Try again.'))
      else setError(message || t('registrations.reject.failed', 'Could not reject the application'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open
      onClose={() => { if (!submitting) onClose() }}
      tone="danger"
      title={t('registrations.reject.title', 'Reject application')}
      description={t('registrations.reject.description', '{{name}} will see the decision and can correct the application and send it again.', { name: applicantName(submission) })}
      headerIcon={<XCircleIcon weight="duotone" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('registrations.common.cancel', 'Cancel')}</Button>
          <Button
            onClick={() => void reject()}
            loading={submitting}
            className="bg-[var(--danger)] text-white shadow-none hover:bg-[var(--danger)] hover:brightness-110 active:bg-[var(--danger)]"
          >
            {t('registrations.reject.submit', 'Reject')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reject-reason" className="text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('registrations.reject.reason', 'Reason (optional)')}</label>
          <Textarea
            id="reject-reason"
            value={reason}
            maxLength={5000}
            rows={4}
            autoFocus
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('registrations.reject.reason_placeholder', 'e.g. Please attach your CV as a PDF')}
          />
          <p className="text-[11.5px] text-[var(--muted)]">{t('registrations.reject.reason_hint', 'Shown to the applicant on their status page.')}</p>
        </div>
        {error ? <Alert key={error} message={error} /> : null}
      </div>
    </Dialog>
  )
}
