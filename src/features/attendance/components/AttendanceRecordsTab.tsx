import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ClockCountdownIcon, HourglassMediumIcon, UserCheckIcon } from '@phosphor-icons/react'
import type { ApiResponseError } from '../../../shared/api/types'
import { faceIdAttendanceService, type FaceIdAttendanceStatus, type FaceIdDailyRecord } from '../../../shared/api/services/attendance.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { MANUAL_CHECKOUT_EVENT } from '../lib/manualCheckOut'
import { Alert } from '../../../shared/ui/alert'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Dialog } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { CalendarField } from '../../../shared/ui/calendar-field'
import { Label } from '../../../shared/ui/label'
import { MemberAvatar } from '../../../shared/ui/member-avatar'
import { PageHeader } from '../../../shared/ui/page-header'
import { SelectField, type SelectFieldOption } from '../../../shared/ui/select-field'
import { StatCard } from '../../../shared/ui/stat-card'
import { LoadingStateBlock, StateBlock } from '../../../shared/ui/state-block'
import { Textarea } from '../../../shared/ui/textarea'
import { useToast } from '../../../shared/toast/useToast'
import { cn } from '../../../shared/lib/cn'
import { MonthField } from '../../../shared/ui/month-field'
import { useAuth } from '../../auth/hooks/useAuth'

const TASHKENT_TIMEZONE = 'Asia/Tashkent'
const PAGE_SIZE = 100

const statusOptions: SelectFieldOption[] = [
  { value: '', label: 'All statuses' },
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'incomplete', label: 'Incomplete' },
]

const sourceOptions: SelectFieldOption[] = [
  { value: '', label: 'All sources' },
  { value: 'faceid', label: 'FaceID' },
  { value: 'manual', label: 'Manual' },
]

const headCellClass = 'bg-[var(--muted-surface)] px-3 py-2.5 text-left align-middle text-xs font-medium whitespace-nowrap text-[var(--muted)]'
const bodyCellClass = 'border-b border-[var(--border-subtle)] px-3 py-3.5 align-middle'

const deleteWarningIcon = (
  <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.3 4.2 2.9 17.1A1.9 1.9 0 0 0 4.6 20h14.8a1.9 1.9 0 0 0 1.7-2.9L13.7 4.2a1.9 1.9 0 0 0-3.4 0Z" />
    <path d="M12 9.3v4M12 16.4v.2" />
  </svg>
)

function getDateTimeParts(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TASHKENT_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(value)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
}

function getTodayInTashkent() {
  const parts = getDateTimeParts(new Date())
  return `${parts.year}-${parts.month}-${parts.day}`
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatTime(dateTime: string | null, time: string | null) {
  if (dateTime) {
    const date = new Date(dateTime)
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('en-GB', { timeZone: TASHKENT_TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
    }
  }
  return time?.slice(0, 5) || '-'
}

function formatWorkedMinutes(minutes: number | null) {
  if (minutes === null || minutes === undefined || minutes < 0) return '-'
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function getEmployeeName(record: FaceIdDailyRecord) {
  return (
    record.employee?.full_name ||
    record.employee_name ||
    record.full_name ||
    record.employee_full_name ||
    `Employee #${record.employee_id}`
  )
}

function toDateTimeLocal(value: string | null, attendanceDate: string, fallbackTime: string | null) {
  if (value) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      const parts = getDateTimeParts(date)
      return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
    }
  }
  return fallbackTime ? `${attendanceDate}T${fallbackTime.slice(0, 5)}` : ''
}

function toTashkentApiDateTime(value: string) {
  return value ? `${value}:00+05:00` : null
}

function getTashkentNowWithOffset() {
  const parts = getDateTimeParts(new Date())
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00+05:00`
}

function statusBadgeVariant(status: FaceIdAttendanceStatus) {
  if (status === 'present') return 'success'
  if (status === 'late') return 'warning'
  if (status === 'absent') return 'danger'
  return 'blue'
}

function getErrorMessage(error: unknown) {
  const apiError = error as Partial<ApiResponseError>
  if (apiError.status === 401 || apiError.status === 403) return 'Your session is missing, expired, or does not have permission for attendance data.'
  if (apiError.status === 422) return 'One or more filters or values are invalid. Check the entered data and try again.'
  if (apiError.status === 500) return 'Attendance server error. Please try again shortly.'
  return 'Unable to load attendance data. Please try again.'
}

type EditValues = {
  status: FaceIdAttendanceStatus
  checkInAt: string
  checkOutAt: string
  note: string
  deleteReason: string
}

const emptyEditValues: EditValues = { status: 'incomplete', checkInAt: '', checkOutAt: '', note: '', deleteReason: '' }

/** The FaceID daily-records view (first tab of /ceo/attendance). */
export function AttendanceRecordsTab() {
  const { showToast } = useToast()
  const { can } = useAuth()
  const canEditRecords = can('attendance', 'edit')
  const canDeleteRecords = can('attendance', 'delete')
  const hasRecordActions = canEditRecords || canDeleteRecords
  const [month, setMonth] = useState(() => getTodayInTashkent().slice(0, 7))
  const [day, setDay] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const [editingRecord, setEditingRecord] = useState<FaceIdDailyRecord | null>(null)
  const [selectedEmployeeRecord, setSelectedEmployeeRecord] = useState<FaceIdDailyRecord | null>(null)
  const [editValues, setEditValues] = useState<EditValues>(emptyEditValues)
  const [isDeleteMode, setIsDeleteMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [year, monthNumber] = month.split('-').map(Number)
  const selectedEmployeeId = Number(employeeId)

  const employeesQuery = useAsyncData(
    () => faceIdAttendanceService.listUsers({ page: 1, page_size: 500, is_active: true }),
    [],
  )
  const recordsQuery = useAsyncData(
    () => faceIdAttendanceService.listDailyRecords({
      year,
      month: monthNumber,
      day: day ? Number(day) : undefined,
      employee_id: Number.isFinite(selectedEmployeeId) && selectedEmployeeId > 0 ? selectedEmployeeId : undefined,
      status: status ? status as FaceIdAttendanceStatus : undefined,
      source_system: source || undefined,
      is_manual: source === 'manual' ? true : undefined,
      page,
      page_size: PAGE_SIZE,
    }),
    [month, day, employeeId, status, source, page],
  )
  const employeeDetailQuery = useAsyncData(
    () => faceIdAttendanceService.listUserDailyRecords(selectedEmployeeRecord?.employee_id ?? 0, {
      year,
      month: monthNumber,
      day: day ? Number(day) : undefined,
      status: status ? status as FaceIdAttendanceStatus : undefined,
      source_system: source || undefined,
      is_manual: source === 'manual' ? true : undefined,
      page: 1,
      page_size: PAGE_SIZE,
    }),
    [selectedEmployeeRecord?.employee_id, month, day, status, source],
    { enabled: selectedEmployeeRecord !== null },
  )

  useEffect(() => { setPage(1) }, [month, day, employeeId, status, source])

  // A manual check-out (top bar) changed someone's day: reload what is on screen.
  const refetchRecords = recordsQuery.refetch
  const refetchDetail = employeeDetailQuery.refetch
  useEffect(() => {
    const onChange = () => { void refetchRecords(); void refetchDetail() }
    window.addEventListener(MANUAL_CHECKOUT_EVENT, onChange)
    return () => window.removeEventListener(MANUAL_CHECKOUT_EVENT, onChange)
  }, [refetchDetail, refetchRecords])

  const employeeOptions = useMemo<SelectFieldOption[]>(() => [
    { value: '', label: 'All employees' },
    ...(employeesQuery.data?.items ?? []).map((employee) => ({
      value: String(employee.id),
      label: `${employee.full_name || `${employee.name} ${employee.surname}`}${employee.department ? ` - ${employee.department}` : ''}`,
    })),
  ], [employeesQuery.data])

  const records = recordsQuery.data?.items ?? []
  const totalItems = recordsQuery.data?.total_count ?? recordsQuery.data?.total_items ?? 0
  const totalPages = recordsQuery.data?.total_pages ?? Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const presentCount = records.filter((record) => record.status === 'present').length
  const lateCount = records.filter((record) => record.status === 'late').length
  const incompleteCount = records.filter((record) => record.status === 'incomplete').length

  function openEdit(record: FaceIdDailyRecord) {
    setEditingRecord(record)
    setEditValues({
      status: record.status,
      checkInAt: toDateTimeLocal(record.check_in_at, record.attendance_date, record.check_in_time),
      checkOutAt: toDateTimeLocal(record.check_out_at, record.attendance_date, record.check_out_time),
      note: record.note ?? '',
      deleteReason: '',
    })
    setIsDeleteMode(!canEditRecords)
  }

  function closeEdit() {
    if (isSaving) return
    setEditingRecord(null)
    setIsDeleteMode(false)
    setEditValues(emptyEditValues)
  }

  async function saveEdit() {
    if (!editingRecord) return
    if (isDeleteMode && !editValues.deleteReason.trim()) {
      showToast({ title: 'Enter a reason before deleting this attendance record.', tone: 'error' })
      return
    }
    setIsSaving(true)
    try {
      if (isDeleteMode) {
        await faceIdAttendanceService.updateDailyRecord(editingRecord.employee_id, editingRecord.attendance_date, {
          is_deleted: true, delete_reason: editValues.deleteReason.trim(), source_updated_at: getTashkentNowWithOffset(),
        })
        showToast({ title: 'Attendance record deleted', tone: 'success' })
      } else {
        await faceIdAttendanceService.updateDailyRecord(editingRecord.employee_id, editingRecord.attendance_date, {
          status: editValues.status,
          check_in_at: toTashkentApiDateTime(editValues.checkInAt),
          check_out_at: toTashkentApiDateTime(editValues.checkOutAt),
          note: editValues.note.trim() || null,
          source_updated_at: getTashkentNowWithOffset(),
        })
        showToast({ title: 'Attendance record updated', tone: 'success' })
      }
      closeEdit()
      await recordsQuery.refetch()
    } catch (error) {
      showToast({ title: getErrorMessage(error), tone: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="page-enter space-y-[18px]">
      <PageHeader
        eyebrow="Operations / FaceID"
        title="Attendance"
        description="Review device attendance records and correct exceptions when the source data is incomplete."
      />

      <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Present" value={presentCount} icon={<UserCheckIcon />} iconTone="success" solid />
        <StatCard label="Late" value={lateCount} icon={<ClockCountdownIcon />} iconTone="warning" />
        <StatCard label="Incomplete" value={incompleteCount} icon={<HourglassMediumIcon />} iconTone="blue" />
      </div>

      <Card>
        <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-[170px_150px_minmax(220px,1fr)_180px_160px]">
          <FilterLabel label="Month"><MonthField value={month} onValueChange={setMonth} aria-label="Month" /></FilterLabel>
          <FilterLabel label="Day"><Input type="number" min="1" max="31" value={day} onChange={(event) => setDay(event.target.value)} placeholder="All days" /></FilterLabel>
          <FilterLabel label="Employee"><SelectField value={employeeId} options={employeeOptions} onValueChange={setEmployeeId} searchable searchPlaceholder="Search employee..." disabled={employeesQuery.isLoading} /></FilterLabel>
          <FilterLabel label="Status"><SelectField value={status} options={statusOptions} onValueChange={setStatus} /></FilterLabel>
          <FilterLabel label="Source"><SelectField value={source} options={sourceOptions} onValueChange={setSource} /></FilterLabel>
        </div>
      </Card>

      {recordsQuery.isLoading ? (
        <LoadingStateBlock eyebrow="Attendance" title="Loading attendance records" />
      ) : recordsQuery.isError ? (
        <StateBlock tone="error" eyebrow="Attendance" title="Unable to load attendance" description={getErrorMessage(recordsQuery.error)} actionLabel="Retry" onAction={() => void recordsQuery.refetch()} />
      ) : records.length === 0 ? (
        <StateBlock tone="empty" eyebrow="Attendance" title="Davomat ma'lumoti topilmadi" description="Change the filters or select another month." />
      ) : (
        <Card className="space-y-[18px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{totalItems} attendance records</p>
            <p className="text-[12.5px] text-[var(--muted)]">Times are shown in Asia/Tashkent.</p>
          </div>
          <div className="custom-scrollbar-visible overflow-x-auto">
            <table className="w-full min-w-[1050px] border-separate border-spacing-0 text-left">
              <thead><tr>
                <th className={cn(headCellClass, 'rounded-l-[12px] pl-3.5')}>Employee</th><th className={headCellClass}>Date</th><th className={headCellClass}>Came</th><th className={headCellClass}>Gone</th><th className={headCellClass}>Worked time</th><th className={headCellClass}>Status</th><th className={headCellClass}>Source</th><th className={cn(headCellClass, !hasRecordActions && 'rounded-r-[12px] pr-3.5')}>Note</th>{hasRecordActions ? <th className={cn(headCellClass, 'rounded-r-[12px] pr-3.5 text-right')}>Action</th> : null}
              </tr></thead>
              <tbody>
                {records.map((record) => (
                  <tr key={`${record.employee_id}-${record.attendance_date}`} className="transition-colors hover:bg-[var(--card-hover)]">
                    <td className={cn(bodyCellClass, 'pl-3.5')}>
                      <div className="flex items-center gap-3">
                        <MemberAvatar name={getEmployeeName(record)} size="md" />
                        <div className="min-w-0">
                          <button type="button" onClick={() => setSelectedEmployeeRecord(record)} className="block text-left text-sm font-semibold text-[var(--foreground)] transition-colors hover:text-[var(--primary)]">{getEmployeeName(record)}</button>
                          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">ID: {record.employee_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className={cn(bodyCellClass, 'text-[13.5px] font-medium text-[var(--foreground)]')}>{formatDate(record.attendance_date)}</td>
                    <td className={cn(bodyCellClass, 'text-[13.5px] tabular-nums text-[var(--muted-strong)]')}>{formatTime(record.check_in_at, record.check_in_time)}</td>
                    <td className={cn(bodyCellClass, 'text-[13.5px] tabular-nums text-[var(--muted-strong)]')}>{formatTime(record.check_out_at, record.check_out_time)}</td>
                    <td className={cn(bodyCellClass, 'text-[13.5px] font-semibold tabular-nums text-[var(--foreground)]')}>{formatWorkedMinutes(record.worked_minutes)}</td>
                    <td className={bodyCellClass}><Badge variant={statusBadgeVariant(record.status)} dot>{record.status}</Badge></td>
                    <td className={bodyCellClass}><Badge variant={record.is_manual ? 'blue' : 'secondary'}>{record.is_manual ? 'manual' : record.source_system || 'faceid'}</Badge></td>
                    <td className={cn(bodyCellClass, 'max-w-[230px] text-[13.5px] text-[var(--muted-strong)]', !hasRecordActions && 'pr-3.5')}><p className="line-clamp-2">{record.note || '-'}</p></td>
                    {hasRecordActions ? <td className={cn(bodyCellClass, 'pr-3.5 text-right')}><Button variant="ghost" size="sm" onClick={() => openEdit(record)}>{canEditRecords ? 'Edit' : 'Delete record'}</Button></td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-[var(--muted)]">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button></div>
          </div>
        </Card>
      )}

      <Dialog open={editingRecord !== null} onClose={closeEdit} title={isDeleteMode ? 'Delete attendance record' : 'Edit attendance record'} description={editingRecord ? `${getEmployeeName(editingRecord)} - ${formatDate(editingRecord.attendance_date)}` : undefined} eyebrow="Attendance correction" tone={isDeleteMode ? 'danger' : 'default'} footer={<><Button variant="ghost" size="md" onClick={closeEdit} disabled={isSaving}>Cancel</Button><Button variant={isDeleteMode ? 'danger' : 'primary'} size="md" onClick={() => void saveEdit()} loading={isSaving}>{isDeleteMode ? 'Delete record' : 'Save changes'}</Button></>}>
        {isDeleteMode ? (
          <div className="space-y-[18px]"><Alert tone="danger" icon={deleteWarningIcon}>This hides the selected daily record from attendance reports. Provide the reason for auditability.</Alert><FilterLabel label="Delete reason"><Textarea value={editValues.deleteReason} rows={3} onChange={(event) => setEditValues((current) => ({ ...current, deleteReason: event.target.value }))} placeholder="Wrong employee mapping" /></FilterLabel>{canEditRecords ? <Button type="button" variant="ghost" size="sm" onClick={() => setIsDeleteMode(false)}>Back to edit</Button> : null}</div>
        ) : (
          <div className="space-y-[18px]"><div className="grid gap-[18px] sm:grid-cols-2"><FilterLabel label="Status"><SelectField value={editValues.status} options={statusOptions.slice(1)} onValueChange={(value) => setEditValues((current) => ({ ...current, status: value as FaceIdAttendanceStatus }))} /></FilterLabel><div className="flex items-end"><Badge variant="secondary" className="mb-2.5">Asia/Tashkent (+05:00)</Badge></div><FilterLabel label="Check in"><CalendarField mode="datetime" value={editValues.checkInAt} onValueChange={(value) => setEditValues((current) => ({ ...current, checkInAt: value }))} /></FilterLabel><FilterLabel label="Check out"><CalendarField mode="datetime" value={editValues.checkOutAt} onValueChange={(value) => setEditValues((current) => ({ ...current, checkOutAt: value }))} /></FilterLabel></div><FilterLabel label="Note"><Textarea value={editValues.note} rows={4} onChange={(event) => setEditValues((current) => ({ ...current, note: event.target.value }))} placeholder="Check-out event missing" /></FilterLabel>{canDeleteRecords ? <div className="flex justify-end border-t border-[var(--border-subtle)] pt-[18px]"><Button type="button" variant="danger" size="sm" onClick={() => setIsDeleteMode(true)}>Delete record</Button></div> : null}</div>
        )}
      </Dialog>

      <Dialog
        open={selectedEmployeeRecord !== null}
        onClose={() => setSelectedEmployeeRecord(null)}
        title={employeeDetailQuery.data?.employee.full_name || (selectedEmployeeRecord ? getEmployeeName(selectedEmployeeRecord) : 'Employee attendance')}
        description={employeeDetailQuery.data?.employee.job_title || 'Attendance records for the selected period'}
        eyebrow="Employee attendance"
        size="xl"
        footer={<Button variant="ghost" size="md" onClick={() => setSelectedEmployeeRecord(null)}>Close</Button>}
      >
        {employeeDetailQuery.isLoading ? (
          <LoadingStateBlock eyebrow="Attendance" title="Loading employee attendance" />
        ) : employeeDetailQuery.isError ? (
          <StateBlock tone="error" eyebrow="Attendance" title="Unable to load employee attendance" description={getErrorMessage(employeeDetailQuery.error)} actionLabel="Retry" onAction={() => void employeeDetailQuery.refetch()} />
        ) : employeeDetailQuery.data ? (
          <div className="space-y-[18px]">
            <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
              <SummaryStat label="Total records" value={employeeDetailQuery.data.stats.total_records} className="text-[var(--foreground)]" />
              <SummaryStat label="Present" value={employeeDetailQuery.data.stats.present_count} className="text-[var(--success-text)]" />
              <SummaryStat label="Late" value={employeeDetailQuery.data.stats.late_count} className="text-[var(--warning-text)]" />
              <SummaryStat label="Absent" value={employeeDetailQuery.data.stats.absent_count} className="text-[var(--danger-text)]" />
              <SummaryStat label="Incomplete" value={employeeDetailQuery.data.stats.incomplete_count} className="text-[var(--blue-text)]" />
              <SummaryStat label="Worked time" value={formatWorkedMinutes(employeeDetailQuery.data.stats.total_worked_minutes)} className="text-[var(--blue-text)]" />
              <SummaryStat label="Average / day" value={formatWorkedMinutes(employeeDetailQuery.data.stats.avg_worked_minutes)} className="text-[var(--muted-strong)]" />
            </div>
            <div className="custom-scrollbar-visible overflow-x-auto">
              <table className="w-full min-w-[650px] border-separate border-spacing-0 text-left">
                <thead><tr><th className={cn(headCellClass, 'rounded-l-[12px] pl-3.5')}>Date</th><th className={headCellClass}>Came</th><th className={headCellClass}>Gone</th><th className={headCellClass}>Worked time</th><th className={cn(headCellClass, !hasRecordActions && 'rounded-r-[12px] pr-3.5')}>Status</th>{hasRecordActions ? <th className={cn(headCellClass, 'rounded-r-[12px] pr-3.5 text-right')}>Action</th> : null}</tr></thead>
                <tbody>
                  {employeeDetailQuery.data.items.map((record) => (
                    <tr key={`${record.employee_id}-${record.attendance_date}`} className="transition-colors hover:bg-[var(--card-hover)]"><td className={cn(bodyCellClass, 'pl-3.5 text-[13.5px] font-medium text-[var(--foreground)]')}>{formatDate(record.attendance_date)}</td><td className={cn(bodyCellClass, 'text-[13.5px] tabular-nums text-[var(--muted-strong)]')}>{formatTime(record.check_in_at, record.check_in_time)}</td><td className={cn(bodyCellClass, 'text-[13.5px] tabular-nums text-[var(--muted-strong)]')}>{formatTime(record.check_out_at, record.check_out_time)}</td><td className={cn(bodyCellClass, 'text-[13.5px] font-semibold tabular-nums text-[var(--foreground)]')}>{formatWorkedMinutes(record.worked_minutes)}</td><td className={cn(bodyCellClass, !hasRecordActions && 'pr-3.5')}><Badge variant={statusBadgeVariant(record.status)} dot>{record.status}</Badge></td>{hasRecordActions ? <td className={cn(bodyCellClass, 'pr-3.5 text-right')}><Button variant="ghost" size="sm" onClick={() => { setSelectedEmployeeRecord(null); openEdit(record) }}>{canEditRecords ? 'Edit' : 'Delete record'}</Button></td> : null}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Dialog>
    </section>
  )
}

function FilterLabel({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-col gap-2"><Label>{label}</Label>{children}</div>
}

function SummaryStat({ label, value, className }: { label: string; value: number | string; className: string }) {
  return <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-3.5"><p className="ui-card-label">{label}</p><p className={cn('mt-2 text-[22px] font-bold tracking-[-0.03em] tabular-nums', className)}>{value}</p></div>
}
