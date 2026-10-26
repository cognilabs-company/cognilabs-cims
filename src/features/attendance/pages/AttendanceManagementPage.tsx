import { useEffect, useMemo, useState } from 'react'
import type { ApiResponseError } from '../../../shared/api/types'
import { faceIdAttendanceService, type FaceIdAttendanceStatus, type FaceIdDailyRecord } from '../../../shared/api/services/attendance.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { SelectField, type SelectFieldOption } from '../../../shared/ui/select-field'
import { StateBlock } from '../../../shared/ui/state-block'
import { Textarea } from '../../../shared/ui/textarea'
import { useToast } from '../../../shared/toast/useToast'
import { cn } from '../../../shared/lib/cn'

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

export function AttendanceManagementPage() {
  const { showToast } = useToast()
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
    setIsDeleteMode(false)
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
    <div className="page-enter space-y-5">
      <section className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-6 sm:px-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.2),transparent_68%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-400">Operations / FaceID</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[var(--foreground)] sm:text-3xl">Attendance</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted-strong)]">Review device attendance records and correct exceptions when the source data is incomplete.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[310px]">
            <SummaryStat label="Present" value={presentCount} className="text-[var(--success-text)]" />
            <SummaryStat label="Late" value={lateCount} className="text-[var(--warning-text)]" />
            <SummaryStat label="Incomplete" value={incompleteCount} className="text-[var(--blue-text)]" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[170px_150px_minmax(220px,1fr)_180px_160px]">
          <FilterLabel label="Month"><Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></FilterLabel>
          <FilterLabel label="Day"><Input type="number" min="1" max="31" value={day} onChange={(event) => setDay(event.target.value)} placeholder="All days" /></FilterLabel>
          <FilterLabel label="Employee"><SelectField value={employeeId} options={employeeOptions} onValueChange={setEmployeeId} searchable searchPlaceholder="Search employee..." disabled={employeesQuery.isLoading} /></FilterLabel>
          <FilterLabel label="Status"><SelectField value={status} options={statusOptions} onValueChange={setStatus} /></FilterLabel>
          <FilterLabel label="Source"><SelectField value={source} options={sourceOptions} onValueChange={setSource} /></FilterLabel>
        </div>
      </section>

      {recordsQuery.isLoading ? (
        <StateBlock tone="loading" eyebrow="Attendance" title="Loading attendance records" />
      ) : recordsQuery.isError ? (
        <StateBlock tone="error" eyebrow="Attendance" title="Unable to load attendance" description={getErrorMessage(recordsQuery.error)} actionLabel="Retry" onAction={() => void recordsQuery.refetch()} />
      ) : records.length === 0 ? (
        <StateBlock tone="empty" eyebrow="Attendance" title="Davomat ma'lumoti topilmadi" description="Change the filters or select another month." />
      ) : (
        <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">{totalItems} attendance records</p>
            <p className="text-xs text-[var(--muted)]">Times are shown in Asia/Tashkent.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead><tr className="border-b border-[var(--border)] bg-[var(--muted-surface)]/40 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                <th className="px-5 py-3.5">Employee</th><th className="px-4 py-3.5">Date</th><th className="px-4 py-3.5">Came</th><th className="px-4 py-3.5">Gone</th><th className="px-4 py-3.5">Worked time</th><th className="px-4 py-3.5">Status</th><th className="px-4 py-3.5">Source</th><th className="px-4 py-3.5">Note</th><th className="px-5 py-3.5 text-right">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {records.map((record) => (
                  <tr key={`${record.employee_id}-${record.attendance_date}`} className="transition-colors hover:bg-[var(--accent-soft)]/45">
                    <td className="px-5 py-4"><button type="button" onClick={() => setSelectedEmployeeRecord(record)} className="text-left text-sm font-semibold text-[var(--foreground)] transition hover:text-[var(--blue-text)] hover:underline">{getEmployeeName(record)}</button><p className="mt-0.5 text-xs text-[var(--muted)]">ID: {record.employee_id}</p></td>
                    <td className="px-4 py-4 text-sm font-medium text-[var(--foreground)]">{formatDate(record.attendance_date)}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted-strong)]">{formatTime(record.check_in_at, record.check_in_time)}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted-strong)]">{formatTime(record.check_out_at, record.check_out_time)}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-[var(--foreground)]">{formatWorkedMinutes(record.worked_minutes)}</td>
                    <td className="px-4 py-4"><Badge variant={statusBadgeVariant(record.status)} dot>{record.status}</Badge></td>
                    <td className="px-4 py-4"><Badge variant={record.is_manual ? 'blue' : 'outline'}>{record.is_manual ? 'manual' : record.source_system || 'faceid'}</Badge></td>
                    <td className="max-w-[230px] px-4 py-4 text-sm text-[var(--muted-strong)]"><p className="line-clamp-2">{record.note || '-'}</p></td>
                    <td className="px-5 py-4 text-right"><Button variant="ghost" size="sm" onClick={() => openEdit(record)}>Edit</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4">
            <p className="text-xs text-[var(--muted)]">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button></div>
          </div>
        </section>
      )}

      <Dialog open={editingRecord !== null} onClose={closeEdit} title={isDeleteMode ? 'Delete attendance record' : 'Edit attendance record'} description={editingRecord ? `${getEmployeeName(editingRecord)} - ${formatDate(editingRecord.attendance_date)}` : undefined} eyebrow="Attendance correction" tone={isDeleteMode ? 'danger' : 'default'} footer={<><Button variant="ghost" size="md" onClick={closeEdit} disabled={isSaving}>Cancel</Button><Button variant={isDeleteMode ? 'danger' : 'primary'} size="md" onClick={() => void saveEdit()} loading={isSaving}>{isDeleteMode ? 'Delete record' : 'Save changes'}</Button></>}>
        {isDeleteMode ? (
          <div className="space-y-4"><div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-dim)] px-4 py-3 text-sm text-[var(--danger-text)]">This hides the selected daily record from attendance reports. Provide the reason for auditability.</div><FilterLabel label="Delete reason"><Textarea value={editValues.deleteReason} rows={3} onChange={(event) => setEditValues((current) => ({ ...current, deleteReason: event.target.value }))} placeholder="Wrong employee mapping" /></FilterLabel><Button type="button" variant="ghost" size="sm" onClick={() => setIsDeleteMode(false)}>Back to edit</Button></div>
        ) : (
          <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><FilterLabel label="Status"><SelectField value={editValues.status} options={statusOptions.slice(1)} onValueChange={(value) => setEditValues((current) => ({ ...current, status: value as FaceIdAttendanceStatus }))} /></FilterLabel><div className="flex items-end"><Badge variant="outline" className="mb-2">Asia/Tashkent (+05:00)</Badge></div><FilterLabel label="Check in"><Input type="datetime-local" value={editValues.checkInAt} onChange={(event) => setEditValues((current) => ({ ...current, checkInAt: event.target.value }))} /></FilterLabel><FilterLabel label="Check out"><Input type="datetime-local" value={editValues.checkOutAt} onChange={(event) => setEditValues((current) => ({ ...current, checkOutAt: event.target.value }))} /></FilterLabel></div><FilterLabel label="Note"><Textarea value={editValues.note} rows={4} onChange={(event) => setEditValues((current) => ({ ...current, note: event.target.value }))} placeholder="Check-out event missing" /></FilterLabel><div className="flex justify-end border-t border-[var(--border)] pt-4"><Button type="button" variant="ghost" size="sm" className="text-[var(--danger-text)]" onClick={() => setIsDeleteMode(true)}>Delete record</Button></div></div>
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
          <StateBlock tone="loading" eyebrow="Attendance" title="Loading employee attendance" />
        ) : employeeDetailQuery.isError ? (
          <StateBlock tone="error" eyebrow="Attendance" title="Unable to load employee attendance" description={getErrorMessage(employeeDetailQuery.error)} actionLabel="Retry" onAction={() => void employeeDetailQuery.refetch()} />
        ) : employeeDetailQuery.data ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryStat label="Total records" value={employeeDetailQuery.data.stats.total_records} className="text-[var(--foreground)]" />
              <SummaryStat label="Present" value={employeeDetailQuery.data.stats.present_count} className="text-[var(--success-text)]" />
              <SummaryStat label="Late" value={employeeDetailQuery.data.stats.late_count} className="text-[var(--warning-text)]" />
              <SummaryStat label="Absent" value={employeeDetailQuery.data.stats.absent_count} className="text-[var(--danger-text)]" />
              <SummaryStat label="Incomplete" value={employeeDetailQuery.data.stats.incomplete_count} className="text-[var(--blue-text)]" />
              <SummaryStat label="Worked time" value={formatWorkedMinutes(employeeDetailQuery.data.stats.total_worked_minutes)} className="text-[var(--blue-text)]" />
              <SummaryStat label="Average / day" value={formatWorkedMinutes(employeeDetailQuery.data.stats.avg_worked_minutes)} className="text-[var(--muted-strong)]" />
            </div>
            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left">
                  <thead><tr className="border-b border-[var(--border)] bg-[var(--muted-surface)]/40 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]"><th className="px-4 py-3">Date</th><th className="px-4 py-3">Came</th><th className="px-4 py-3">Gone</th><th className="px-4 py-3">Worked time</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {employeeDetailQuery.data.items.map((record) => (
                      <tr key={`${record.employee_id}-${record.attendance_date}`} className="hover:bg-[var(--accent-soft)]/45"><td className="px-4 py-3 text-sm font-medium text-[var(--foreground)]">{formatDate(record.attendance_date)}</td><td className="px-4 py-3 text-sm text-[var(--muted-strong)]">{formatTime(record.check_in_at, record.check_in_time)}</td><td className="px-4 py-3 text-sm text-[var(--muted-strong)]">{formatTime(record.check_out_at, record.check_out_time)}</td><td className="px-4 py-3 text-sm font-semibold text-[var(--foreground)]">{formatWorkedMinutes(record.worked_minutes)}</td><td className="px-4 py-3"><Badge variant={statusBadgeVariant(record.status)} dot>{record.status}</Badge></td><td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => { setSelectedEmployeeRecord(null); openEdit(record) }}>Edit</Button></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}

function FilterLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">{label}</label>{children}</div>
}

function SummaryStat({ label, value, className }: { label: string; value: number | string; className: string }) {
  return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/75 px-3 py-2.5 text-center shadow-sm backdrop-blur-sm"><p className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</p><p className={cn('mt-1 text-xl font-black', className)}>{value}</p></div>
}
