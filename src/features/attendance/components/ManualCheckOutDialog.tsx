import { useEffect, useMemo, useState } from 'react'
import { CheckCircleIcon, ClockIcon, MagnifyingGlassIcon, SignOutIcon, UserIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { faceIdAttendanceService, type FaceIdAttendanceUser, type ManualCheckOutResult } from '../../../shared/api/services/attendance.service'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { cn } from '../../../shared/lib/cn'
import { useToast } from '../../../shared/toast/useToast'
import { Button } from '../../../shared/ui/button'
import { CalendarField } from '../../../shared/ui/calendar-field'
import { Dialog } from '../../../shared/ui/dialog'
import { SelectField } from '../../../shared/ui/select-field'
import { MANUAL_CHECKOUT_EVENT, tashkentNowParts, toTashkentIso } from '../lib/manualCheckOut'

type Props = { onClose: () => void }

const PAGE_SIZE = 50
const pad = (value: number) => String(value).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, hour) => ({ value: pad(hour), label: pad(hour) }))
const MINUTES = Array.from({ length: 60 }, (_, minute) => ({ value: pad(minute), label: pad(minute) }))
const label = 'mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]'

type ApiError = { status?: number; details?: { detail?: unknown } | null }

function detailText(error: unknown) {
  const detail = (error as ApiError | null)?.details?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return (detail as Array<{ msg?: string }>).map((item) => item.msg).filter(Boolean).join(' · ')
  if (detail && typeof detail === 'object') {
    const data = detail as { message?: unknown }
    if (typeof data.message === 'string') return data.message
  }
  return ''
}

/** "14:58:55.961" or an ISO time → "14:58". */
function hhmm(value: string | null | undefined) {
  if (!value) return '—'
  const match = value.match(/(\d{2}):(\d{2})/)
  return match ? `${match[1]}:${match[2]}` : value
}

/**
 * Manual check-out (CEO and specific people): employee, date, hour and minute in Asia/Tashkent; a confirmation
 * before sending, because sending again corrects an earlier manual check-out.
 */
export function ManualCheckOutDialog({ onClose }: Props) {
  const { t } = useLocale()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const [now] = useState(tashkentNowParts)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<FaceIdAttendanceUser[] | null>(null)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [employee, setEmployee] = useState<FaceIdAttendanceUser | null>(null)
  const [date, setDate] = useState(now.date)
  const [hour, setHour] = useState(now.hour)
  const [minute, setMinute] = useState(now.minute)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ManualCheckOutResult | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  // First page for the current search (server-side search + pagination).
  useEffect(() => {
    let alive = true
    faceIdAttendanceService.listUsers({ search: query || undefined, is_active: true, page: 1, page_size: PAGE_SIZE })
      .then((response) => {
        if (!alive) return
        setUsers(response.items ?? [])
        setPage(1)
        setPages(response.total_pages ?? 1)
      })
      .catch(() => { if (alive) setUsers([]) })
    return () => { alive = false }
  }, [query])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const response = await faceIdAttendanceService.listUsers({ search: query || undefined, is_active: true, page: page + 1, page_size: PAGE_SIZE })
      setUsers((current) => [...(current ?? []), ...(response.items ?? [])])
      setPage(page + 1)
      setPages(response.total_pages ?? pages)
    } finally {
      setLoadingMore(false)
    }
  }

  const occurredAt = toTashkentIso(date, hour, minute)
  const inFuture = useMemo(() => `${date}T${hour}:${minute}` > `${now.date}T${now.hour}:${now.minute}`, [date, hour, minute, now])
  const canSubmit = Boolean(employee && date && !inFuture && !saving)
  const employeeName = (user: FaceIdAttendanceUser) => user.full_name || [user.name, user.surname].filter(Boolean).join(' ') || `#${user.id}`

  async function submit() {
    if (!employee || !canSubmit) return
    const ok = await confirm({
      title: t('attendance.manual.confirm_title', 'Set check-out for {{name}}?', { name: employeeName(employee) }),
      description: t('attendance.manual.confirm_text', '{{date}} at {{time}} (Tashkent). If a manual check-out was already set for this day, it is replaced.', { date, time: `${hour}:${minute}` }),
      confirmLabel: t('attendance.manual.confirm', 'Set check-out'),
    })
    if (!ok) return
    setSaving(true)
    setError(null)
    try {
      const response = await faceIdAttendanceService.manualCheckOut({ employee_id: employee.id, occurred_at: occurredAt, comment: comment.trim() || null })
      setResult(response)
      window.dispatchEvent(new CustomEvent(MANUAL_CHECKOUT_EVENT))
      showToast({ title: t('attendance.manual.done', 'Check-out set'), description: `${response.employee_name ?? employeeName(employee)} · ${hhmm(response.check_out_time)}`, tone: 'success' })
    } catch (reason) {
      const status = (reason as ApiError | null)?.status
      const detail = detailText(reason)
      const message = status === 403
        ? t('attendance.manual.e403', 'You are not allowed to set check-outs')
        : status === 404
          ? t('attendance.manual.e404', 'There is no attendance record for this employee on this day')
          : status === 409
            ? t('attendance.manual.e409', 'This employee has no check-in on this day')
            : status === 422
              ? t('attendance.manual.e422', 'Check the time: it cannot be before the check-in or in the future')
              : t('attendance.manual.failed', 'Could not set the check-out')
      setError(detail && status !== 403 ? `${message} — ${detail}` : message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t('attendance.manual.title', 'Manual check-out')}
      description={t('attendance.manual.description', 'Set the time an employee left, in Tashkent time.')}
      headerIcon={<SignOutIcon size={18} weight="duotone" />}
      footer={result ? (
        <Button onClick={onClose}>{t('common.close', 'Close')}</Button>
      ) : (
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={() => void submit()} disabled={!canSubmit} loading={saving} leftIcon={<SignOutIcon size={15} />}>{t('attendance.manual.confirm', 'Set check-out')}</Button>
        </>
      )}
    >
      {result ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-[14px] bg-[var(--success-dim)] px-4 py-3 text-[var(--success-text)]">
            <CheckCircleIcon size={22} weight="fill" />
            <p className="text-[14px] font-semibold">{t('attendance.manual.saved_for', 'Check-out set for {{name}}', { name: result.employee_name ?? (employee ? employeeName(employee) : '') })}</p>
          </div>
          <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {([
              [t('attendance.manual.date', 'Date'), result.attendance_date],
              [t('attendance.manual.check_in', 'Came'), hhmm(result.check_in_time)],
              [t('attendance.manual.check_out', 'Left'), hhmm(result.check_out_time)],
              [t('attendance.manual.worked', 'Worked'), result.worked_minutes != null ? t('attendance.manual.worked_value', '{{h}} h {{m}} min', { h: Math.floor(result.worked_minutes / 60), m: result.worked_minutes % 60 }) : '—'],
            ] as const).map(([name, value]) => (
              <div key={name} className="rounded-[12px] bg-[var(--muted-surface)] px-3 py-2.5">
                <dt className="text-[11.5px] font-semibold text-[var(--muted)]">{name}</dt>
                <dd className="text-[15px] font-bold text-[var(--foreground)] tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Employee */}
          <div>
            <span className={label}>{t('attendance.manual.employee', 'Employee')}</span>
            <label className="relative flex h-10 items-center">
              <MagnifyingGlassIcon size={15} className="pointer-events-none absolute left-3 text-[var(--muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('attendance.manual.search', 'Search by name…')}
                className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] pr-3 pl-9 text-[13.5px] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none"
              />
            </label>
            <ul className="mt-2 max-h-[200px] space-y-0.5 overflow-y-auto rounded-[12px] border border-[var(--border-subtle)] p-1" role="listbox" aria-label={t('attendance.manual.employee', 'Employee')}>
              {users === null ? (
                <li className="skeleton h-10 rounded-[10px]" />
              ) : users.length === 0 ? (
                <li className="px-2 py-3 text-[12.5px] text-[var(--muted)]">{t('attendance.manual.no_users', 'Nobody found')}</li>
              ) : users.map((user) => {
                const picked = employee?.id === user.id
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={picked}
                      onClick={() => setEmployee(user)}
                      className={cn('flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors', picked ? 'bg-[var(--blue-dim)]' : 'hover:bg-[var(--input-surface)]')}
                    >
                      <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full', picked ? 'bg-[var(--primary)] text-white' : 'bg-[var(--muted-surface)] text-[var(--muted-strong)]')}><UserIcon size={14} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-[var(--foreground)]">{employeeName(user)}</span>
                        <span className="block truncate text-[11.5px] text-[var(--muted)]">{[user.position, user.department, user.role_name].filter(Boolean).join(' · ')}</span>
                      </span>
                      {picked ? <CheckCircleIcon size={18} weight="fill" className="shrink-0 text-[var(--primary)]" /> : null}
                    </button>
                  </li>
                )
              })}
              {users && page < pages ? (
                <li className="p-1">
                  <Button size="sm" variant="secondary" className="w-full" loading={loadingMore} onClick={() => void loadMore()}>{t('attendance.manual.more', 'Show more')}</Button>
                </li>
              ) : null}
            </ul>
          </div>

          {/* When (Tashkent) */}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <label className="block">
              <span className={label}>{t('attendance.manual.date', 'Date')}</span>
              <CalendarField value={date} onValueChange={(value) => setDate(value || now.date)} max={now.date} />
            </label>
            <label className="block w-[96px]">
              <span className={label}>{t('attendance.manual.hour', 'Hour')}</span>
              <SelectField value={hour} onValueChange={setHour} options={HOURS} />
            </label>
            <label className="block w-[96px]">
              <span className={label}>{t('attendance.manual.minute', 'Minute')}</span>
              <SelectField value={minute} onValueChange={setMinute} options={MINUTES} searchable />
            </label>
          </div>
          <p className={cn('flex items-center gap-1.5 text-[12px]', inFuture ? 'text-[var(--danger-text)]' : 'text-[var(--muted)]')}>
            <ClockIcon size={13} />
            {inFuture ? t('attendance.manual.future', 'This time is in the future') : t('attendance.manual.tz', 'Tashkent time (UTC+5) · will be sent as {{value}}', { value: occurredAt })}
          </p>

          <label className="block">
            <span className={label}>{t('attendance.manual.comment', 'Reason (optional)')}</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value.slice(0, 1000))}
              rows={2}
              placeholder={t('attendance.manual.comment_placeholder', 'For example: forgot to check out')}
              className="w-full resize-y rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none"
            />
          </label>

          {error ? <p className="rounded-[12px] bg-[var(--danger-dim)] px-3 py-2.5 text-[12.5px] text-[var(--danger-text)]">{error}</p> : null}
        </div>
      )}
    </Dialog>
  )
}
