import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Download, Hourglass, LayoutGrid, LogOut, Pencil, Search, Table2, UserCheck, UserX, X } from 'lucide-react'
import type { ApiResponseError } from '../../../shared/api/types'
import { faceIdAttendanceService, type FaceIdAttendanceStatus, type FaceIdDailyRecord } from '../../../shared/api/services/attendance.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { MANUAL_CHECKOUT_EVENT } from '../lib/manualCheckOut'
import { Alert } from '../../../shared/ui/alert'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { CalendarField } from '../../../shared/ui/calendar-field'
import { Label } from '../../../shared/ui/label'
import { MemberAvatar } from '../../../shared/ui/member-avatar'
import { useLocale } from '../../../app/hooks/useLocale'
import { PageHeader } from '../../../shared/ui/page-header'
import { SelectField, type SelectFieldOption } from '../../../shared/ui/select-field'
import { LoadingStateBlock, StateBlock } from '../../../shared/ui/state-block'
import { Textarea } from '../../../shared/ui/textarea'
import { useToast } from '../../../shared/toast/useToast'
import { cn } from '../../../shared/lib/cn'
import { useAuth } from '../../auth/hooks/useAuth'

const TASHKENT_TIMEZONE = 'Asia/Tashkent'
const PAGE_SIZE = 100
/** Upper bound of pages fetched for one day (100 × 10 = 1000 records). */
const MAX_DAY_PAGES = 10
const VIEW_KEY = 'cims-attendance-view'

const statusOptions: SelectFieldOption[] = [
  { value: '', label: 'All statuses' },
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'incomplete', label: 'Incomplete' },
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

/* ───────── Board model (HR Pulse layout, ported from the jiddiylabs attendance board) ───────── */

type Cat = 'left' | 'ok' | 'absent' | 'late' | 'open' | 'wait'
type BoardRow = {
  employeeId: number
  name: string
  department: string | null
  position: string | null
  record: FaceIdDailyRecord | null
  cat: Cat
}

const CAT_COLOR: Record<Cat, string> = {
  ok: 'var(--success)',
  late: 'var(--warning)',
  absent: 'var(--danger)',
  left: 'var(--muted)',
  open: 'var(--primary)',
  wait: '#b6c2d3',
}
const CAT_ICON: Record<Cat, typeof Clock> = { left: LogOut, ok: UserCheck, absent: UserX, late: Clock, open: CalendarClock, wait: Hourglass }
/** Card order, as on the jiddiylabs board. */
const CAT_ORDER: Cat[] = ['left', 'ok', 'absent', 'late', 'open', 'wait']

/** One category per employee: drives the donut, the cards and the filter. */
function catOf(record: FaceIdDailyRecord | null, isToday: boolean): Cat {
  if (!record) return 'wait'
  if (record.status === 'absent') return 'absent'
  if (record.status === 'late') return 'late'
  const hasOut = Boolean(record.check_out_at || record.check_out_time)
  if (isToday) return hasOut ? 'left' : 'ok'
  return record.status === 'incomplete' ? 'open' : 'ok'
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Board time cell: "HH:MM" or an em dash. */
function boardTime(dateTime: string | null, time: string | null) {
  const text = formatTime(dateTime, time)
  return text === '-' ? '—' : text
}

/** "HH:MM" (Tashkent) → minutes of the day. */
function toMinutes(dateTime: string | null, time: string | null) {
  const text = formatTime(dateTime, time)
  const m = /^(\d{1,2}):(\d{2})/.exec(text)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

function nowMinutesInTashkent() {
  const parts = getDateTimeParts(new Date())
  return Number(parts.hour) * 60 + Number(parts.minute)
}

/** Everything the board needs for one day: all pages of daily records. */
async function loadDayRecords(year: number, month: number, day: number) {
  const items: FaceIdDailyRecord[] = []
  for (let page = 1; page <= MAX_DAY_PAGES; page += 1) {
    const res = await faceIdAttendanceService.listDailyRecords({ year, month, day, page, page_size: PAGE_SIZE })
    items.push(...(res.items ?? []))
    const total = res.total_count ?? res.total_items ?? items.length
    const pages = res.total_pages ?? Math.ceil(total / PAGE_SIZE)
    if (page >= pages || (res.items ?? []).length < PAGE_SIZE) break
  }
  return items
}

/** The day board on /ceo/attendance: donut + category cards, then search / day / view, then table or cards. */
export function AttendanceRecordsTab() {
  const { t } = useLocale()
  const { showToast } = useToast()
  const { can } = useAuth()
  const canEditRecords = can('attendance', 'edit')
  const canDeleteRecords = can('attendance', 'delete')
  const hasRecordActions = canEditRecords || canDeleteRecords
  const todayIso = getTodayInTashkent()
  const [day, setDay] = useState(todayIso)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<Cat | null>(null)
  const [view, setView] = useState<'table' | 'cards'>(() => (window.localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'table'))
  const [editingRecord, setEditingRecord] = useState<FaceIdDailyRecord | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: number; name: string } | null>(null)
  const [editValues, setEditValues] = useState<EditValues>(emptyEditValues)
  const [isDeleteMode, setIsDeleteMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const isToday = day === todayIso
  const [year, monthNumber, dayNumber] = day.split('-').map(Number)

  useEffect(() => { window.localStorage.setItem(VIEW_KEY, view) }, [view])

  const employeesQuery = useAsyncData(
    () => faceIdAttendanceService.listUsers({ page: 1, page_size: 500, is_active: true }),
    [],
  )
  const recordsQuery = useAsyncData(() => loadDayRecords(year, monthNumber, dayNumber), [day])
  const employeeDetailQuery = useAsyncData(
    () => faceIdAttendanceService.listUserDailyRecords(selectedEmployee?.id ?? 0, { year, month: monthNumber, page: 1, page_size: PAGE_SIZE }),
    [selectedEmployee?.id, year, monthNumber],
    { enabled: selectedEmployee !== null },
  )

  // Today's board refreshes every minute, like the jiddiylabs board.
  const refetchRecords = recordsQuery.refetch
  const refetchDetail = employeeDetailQuery.refetch
  useEffect(() => {
    if (!isToday) return
    const id = window.setInterval(() => { void refetchRecords() }, 60_000)
    return () => window.clearInterval(id)
  }, [isToday, refetchRecords])

  // A manual check-out (top bar) changed someone's day: reload what is on screen.
  useEffect(() => {
    const onChange = () => { void refetchRecords(); void refetchDetail() }
    window.addEventListener(MANUAL_CHECKOUT_EVENT, onChange)
    return () => window.removeEventListener(MANUAL_CHECKOUT_EVENT, onChange)
  }, [refetchDetail, refetchRecords])

  const allRows = useMemo<BoardRow[]>(() => {
    const employees = employeesQuery.data?.items ?? []
    const records = recordsQuery.data ?? []
    const byEmployee = new Map(records.map((record) => [record.employee_id, record]))
    const rows: BoardRow[] = employees.map((employee) => {
      const record = byEmployee.get(employee.id) ?? null
      return {
        employeeId: employee.id,
        name: employee.full_name || `${employee.name} ${employee.surname}`.trim() || `#${employee.id}`,
        department: employee.department,
        position: employee.position || employee.role_name || employee.role,
        record,
        cat: catOf(record, isToday),
      }
    })
    // Records of people missing from the active-user list (e.g. deactivated later) still count.
    const known = new Set(employees.map((employee) => employee.id))
    for (const record of records) {
      if (known.has(record.employee_id)) continue
      rows.push({ employeeId: record.employee_id, name: getEmployeeName(record), department: null, position: record.employee?.job_title || record.employee?.role_name || null, record, cat: catOf(record, isToday) })
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name))
  }, [employeesQuery.data, recordsQuery.data, isToday])

  const counts = useMemo(() => {
    const map = new Map<Cat, number>()
    for (const row of allRows) map.set(row.cat, (map.get(row.cat) ?? 0) + 1)
    return map
  }, [allRows])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allRows.filter((row) => (!cat || row.cat === cat) && (!q || `${row.name} ${row.department ?? ''} ${row.position ?? ''}`.toLowerCase().includes(q)))
  }, [allRows, cat, query])

  const catLabel = (key: Cat) => {
    switch (key) {
      case 'ok': return t('attendance.board.cat_ok', 'Came on time')
      case 'late': return t('attendance.board.cat_late', 'Came late')
      case 'absent': return t('attendance.board.cat_absent', 'Did not come')
      case 'left': return t('attendance.board.cat_left', 'Left work')
      case 'open': return t('attendance.board.cat_open', 'No check-out')
      default: return isToday ? t('attendance.board.cat_wait', 'Not arrived yet') : t('attendance.board.cat_nodata', 'No record')
    }
  }
  const stateLabel = (row: BoardRow) => {
    switch (row.cat) {
      case 'ok': return isToday ? t('attendance.board.state_in_office', 'In office') : t('attendance.board.state_present', 'Present')
      case 'late': return t('attendance.board.state_late', 'Late')
      case 'absent': return t('attendance.board.state_absent', 'Did not come')
      case 'left': return t('attendance.board.state_left', 'Left work')
      case 'open': return t('attendance.board.state_open', 'Left without check-out')
      default: return catLabel('wait')
    }
  }
  const visibleCards = CAT_ORDER.filter((key) => {
    if (key === 'left') return isToday
    if (key === 'open') return !isToday
    if (key === 'wait') return (counts.get('wait') ?? 0) > 0
    return true
  })
  const total = allRows.length
  const now = isToday ? nowMinutesInTashkent() : null
  const loading = (recordsQuery.isLoading || employeesQuery.isLoading) && allRows.length === 0
  const failed = recordsQuery.isError && allRows.length === 0
  const dayLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))

  function exportCsv() {
    const head = ['#', t('attendance.board.col_name', 'Full name'), t('attendance.board.col_department', 'Department'), t('attendance.board.col_position', 'Position'), t('attendance.board.col_came', 'Came'), t('attendance.board.col_gone', 'Left'), t('attendance.board.col_worked', 'Worked'), t('attendance.board.col_state', 'Attendance')]
    const body = rows.map((row, i) => [i + 1, row.name, row.department ?? '', row.position ?? '', row.record ? formatTime(row.record.check_in_at, row.record.check_in_time) : '', row.record ? formatTime(row.record.check_out_at, row.record.check_out_time) : '', row.record ? formatWorkedMinutes(row.record.worked_minutes) : '', stateLabel(row)])
    const csv = [head, ...body].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `davomat_${day}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
      await Promise.all([recordsQuery.refetch(), selectedEmployee ? employeeDetailQuery.refetch() : Promise.resolve()])
    } catch (error) {
      showToast({ title: getErrorMessage(error), tone: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const editButton = (record: FaceIdDailyRecord) => (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); openEdit(record) }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]"
      aria-label={canEditRecords ? t('attendance.board.edit', 'Edit') : t('attendance.board.delete', 'Delete record')}
      title={canEditRecords ? t('attendance.board.edit', 'Edit') : t('attendance.board.delete', 'Delete record')}
    >
      <Pencil size={15} />
    </button>
  )

  return (
    <section className="page-enter space-y-[14px]">
      <PageHeader
        eyebrow={t('attendance.board.eyebrow', 'Operations / FaceID')}
        title={t('attendance.board.title', 'Employee statistics')}
        description={dayLabel}
        actions={<Button variant="secondary" size="md" onClick={exportCsv} disabled={rows.length === 0}><Download size={16} />{t('attendance.board.export', 'Get report')}</Button>}
      />

      {/* Day status: donut + category cards (click = filter) */}
      <div className="grid gap-[14px] md:grid-cols-[220px_minmax(0,1fr)]" aria-label={t('attendance.board.day_status', 'Day status')}>
        <div className="relative grid place-items-center rounded-[18px] border border-[var(--border)] bg-[var(--card)] p-[14px]">
          <Donut parts={visibleCards.map((key) => ({ key, value: counts.get(key) ?? 0, color: CAT_COLOR[key] }))} size={168} />
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
            <small className="text-[12px] text-[var(--muted)]">{t('attendance.board.all_employees', 'All employees')}</small>
            <b className="text-[30px] font-extrabold tabular-nums text-[var(--foreground)]">{total}</b>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {visibleCards.map((key) => {
            const Icon = CAT_ICON[key]
            const on = cat === key
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => setCat(on ? null : key)}
                title={on ? t('attendance.board.clear_filter', 'Remove filter') : catLabel(key)}
                style={{ '--tc': CAT_COLOR[key] } as CSSProperties}
                className={cn(
                  'grid min-h-[96px] grid-cols-[1fr_auto] grid-rows-[auto_auto] items-end gap-x-3 gap-y-1.5 rounded-[18px] border bg-[var(--card)] px-[18px] py-4 text-left transition-colors',
                  on
                    ? 'border-[var(--tc)] bg-[color-mix(in_srgb,var(--tc)_8%,var(--card))] shadow-[inset_0_0_0_1px_var(--tc)]'
                    : 'border-[var(--border)] hover:border-[color-mix(in_srgb,var(--tc)_55%,var(--border))]',
                )}
              >
                <Icon size={20} className="col-span-2 self-start text-[var(--tc)]" aria-hidden />
                <span className="text-[13.5px] text-[var(--muted-strong)]">{catLabel(key)}</span>
                <b className="justify-self-end text-[24px] font-extrabold tabular-nums text-[var(--foreground)]">{counts.get(key) ?? 0}</b>
              </button>
            )
          })}
        </div>
      </div>

      {/* Toolbar: search, day, active filter, view */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-[0_1_320px]">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('attendance.board.search', 'Search')} className="pl-9" aria-label={t('attendance.board.search', 'Search')} />
        </div>
        <div className="inline-flex items-center gap-1.5">
          <IconNavButton label={t('attendance.board.prev_day', 'Previous day')} onClick={() => setDay(addDays(day, -1))}><ChevronLeft size={16} /></IconNavButton>
          <div className="w-[170px]"><CalendarField value={day} max={todayIso} onValueChange={(value) => value && setDay(value)} aria-label={t('attendance.board.day', 'Day')} /></div>
          <IconNavButton label={t('attendance.board.next_day', 'Next day')} disabled={isToday} onClick={() => setDay(addDays(day, 1))}><ChevronRight size={16} /></IconNavButton>
          {!isToday ? <Button variant="secondary" size="sm" onClick={() => setDay(todayIso)}>{t('attendance.board.today', 'Today')}</Button> : null}
        </div>
        {cat ? (
          <Button variant="secondary" size="sm" onClick={() => setCat(null)}>{catLabel(cat)} <X size={14} /></Button>
        ) : null}
        <span className="flex-1" />
        <div role="group" aria-label={t('attendance.board.view', 'View')} className="inline-flex gap-0.5 rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-[3px]">
          {([['table', Table2, t('attendance.board.view_table', 'Table')], ['cards', LayoutGrid, t('attendance.board.view_cards', 'Cards')]] as const).map(([key, Icon, label]) => (
            <button key={key} type="button" aria-label={label} title={label} aria-pressed={view === key} onClick={() => setView(key)} className={cn('grid h-[30px] w-[34px] place-items-center rounded-[7px] transition-colors', view === key ? 'bg-[var(--blue-dim)] text-[var(--primary)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]')}>
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingStateBlock eyebrow="Attendance" title={t('attendance.board.loading', 'Loading attendance')} />
      ) : failed ? (
        <StateBlock tone="error" eyebrow="Attendance" title="Unable to load attendance" description={getErrorMessage(recordsQuery.error)} actionLabel="Retry" onAction={() => void recordsQuery.refetch()} />
      ) : rows.length === 0 ? (
        <StateBlock tone="empty" eyebrow="Attendance" title={t('attendance.board.empty', 'No employees found')} description={t('attendance.board.empty_hint', 'Change the search, the filter or the day.')} />
      ) : view === 'table' ? (
        <div className="custom-scrollbar-visible overflow-x-auto rounded-[18px] border border-[var(--border)] bg-[var(--card)]">
          <table className="w-full min-w-[980px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="bg-[var(--blue-dim)] text-[var(--foreground)]">
                <th className={boardHeadClass}>{t('attendance.board.col_no', 'No.')}</th>
                <th className={boardHeadClass}>{t('attendance.board.col_name', 'Full name')}</th>
                <th className={boardHeadClass}>{t('attendance.board.col_department', 'Department')}</th>
                <th className={boardHeadClass}>{t('attendance.board.col_position', 'Position')}</th>
                <th className={boardHeadClass}>{t('attendance.board.col_came', 'Came')}</th>
                <th className={boardHeadClass}>{t('attendance.board.col_gone', 'Left')}</th>
                <th className={boardHeadClass}>{t('attendance.board.col_worked', 'Worked')}</th>
                <th className={boardHeadClass}>{t('attendance.board.col_state', 'Attendance')}</th>
                {hasRecordActions ? <th className={boardHeadClass} aria-label={t('attendance.board.col_action', 'Action')} /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const record = row.record
                return (
                  <tr
                    key={row.employeeId}
                    tabIndex={0}
                    aria-label={row.name}
                    onClick={() => setSelectedEmployee({ id: row.employeeId, name: row.name })}
                    onKeyDown={(event) => { if (event.key === 'Enter') setSelectedEmployee({ id: row.employeeId, name: row.name }) }}
                    className="cursor-pointer transition-colors hover:bg-[var(--card-hover)] focus-visible:bg-[var(--card-hover)] focus-visible:outline-none"
                  >
                    <td className={cn(boardCellClass, 'tabular-nums text-[var(--muted)]')}>{index + 1}</td>
                    <td className={boardCellClass}>
                      <span className="flex items-center gap-3">
                        <MemberAvatar name={row.name} size="sm" />
                        <b className="font-semibold text-[var(--foreground)]">{row.name}</b>
                      </span>
                    </td>
                    <td className={cn(boardCellClass, 'text-[var(--muted-strong)]')}>{row.department || '—'}</td>
                    <td className={cn(boardCellClass, 'text-[var(--muted-strong)]')}>{row.position || '—'}</td>
                    <td className={cn(boardCellClass, 'tabular-nums', row.cat === 'late' ? 'font-bold text-[var(--warning-text)]' : 'text-[var(--foreground)]')}>{record ? boardTime(record.check_in_at, record.check_in_time) : '—'}</td>
                    <td className={cn(boardCellClass, 'tabular-nums text-[var(--foreground)]')}>{record ? boardTime(record.check_out_at, record.check_out_time) : '—'}</td>
                    <td className={cn(boardCellClass, 'tabular-nums text-[var(--foreground)]')}>{record?.worked_minutes ? formatWorkedLong(record.worked_minutes, t) : '—'}</td>
                    <td className={boardCellClass}>
                      <span className="inline-flex items-center gap-1.5">
                        <StateChip cat={row.cat}>{stateLabel(row)}</StateChip>
                        {record?.is_manual ? <Badge variant="blue">{t('attendance.board.manual', 'Manual')}</Badge> : null}
                      </span>
                    </td>
                    {hasRecordActions ? <td className={cn(boardCellClass, 'w-[52px] text-right')}>{record ? editButton(record) : null}</td> : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3">
          {rows.map((row) => {
            const record = row.record
            return (
              <div
                key={row.employeeId}
                role="button"
                tabIndex={0}
                aria-label={row.name}
                onClick={() => setSelectedEmployee({ id: row.employeeId, name: row.name })}
                onKeyDown={(event) => { if (event.key === 'Enter') setSelectedEmployee({ id: row.employeeId, name: row.name }) }}
                style={{ '--tc': CAT_COLOR[row.cat] } as CSSProperties}
                className="grid min-w-0 cursor-pointer gap-3 rounded-[18px] border border-t-[3px] border-[var(--border)] border-t-[var(--tc)] bg-[var(--card)] px-4 pt-3.5 pb-3 transition-[box-shadow,transform] outline-none hover:-translate-y-px hover:shadow-[var(--elev-sm)] focus-visible:-translate-y-px focus-visible:shadow-[var(--elev-sm)]"
              >
                <header className="flex min-w-0 items-center gap-3">
                  <MemberAvatar name={row.name} size="lg" />
                  <div className="grid min-w-0">
                    <b className="truncate font-semibold text-[var(--foreground)]">{row.name}</b>
                    <small className="truncate text-[12.5px] text-[var(--muted)]">{[row.position, row.department].filter(Boolean).join(' · ') || '—'}</small>
                  </div>
                </header>
                <DayBar record={record} now={now} />
                <dl className="m-0 grid grid-cols-[1fr_1fr_1.4fr] gap-2">
                  <CardFact label={t('attendance.board.col_came', 'Came')} value={record ? boardTime(record.check_in_at, record.check_in_time) : '—'} tone={row.cat === 'late' ? 'text-[var(--warning-text)]' : undefined} />
                  <CardFact label={t('attendance.board.col_gone', 'Left')} value={record ? boardTime(record.check_out_at, record.check_out_time) : '—'} />
                  <CardFact label={t('attendance.board.col_worked', 'Worked')} value={record?.worked_minutes ? formatWorkedLong(record.worked_minutes, t) : '—'} />
                </dl>
                <footer className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <StateChip cat={row.cat}>{stateLabel(row)}</StateChip>
                    {record?.is_manual ? <Badge variant="blue">{t('attendance.board.manual', 'Manual')}</Badge> : null}
                  </span>
                  {hasRecordActions && record ? editButton(record) : null}
                </footer>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[12.5px] text-[var(--muted)]">{t('attendance.board.tz_note', 'Times are shown in Asia/Tashkent. Click an employee to see the whole month.')}</p>

      <Dialog open={editingRecord !== null} onClose={closeEdit} title={isDeleteMode ? 'Delete attendance record' : 'Edit attendance record'} description={editingRecord ? `${getEmployeeName(editingRecord)} - ${formatDate(editingRecord.attendance_date)}` : undefined} eyebrow="Attendance correction" tone={isDeleteMode ? 'danger' : 'default'} footer={<><Button variant="ghost" size="md" onClick={closeEdit} disabled={isSaving}>Cancel</Button><Button variant={isDeleteMode ? 'danger' : 'primary'} size="md" onClick={() => void saveEdit()} loading={isSaving}>{isDeleteMode ? 'Delete record' : 'Save changes'}</Button></>}>
        {isDeleteMode ? (
          <div className="space-y-[18px]"><Alert tone="danger" icon={deleteWarningIcon}>This hides the selected daily record from attendance reports. Provide the reason for auditability.</Alert><FilterLabel label="Delete reason"><Textarea value={editValues.deleteReason} rows={3} onChange={(event) => setEditValues((current) => ({ ...current, deleteReason: event.target.value }))} placeholder="Wrong employee mapping" /></FilterLabel>{canEditRecords ? <Button type="button" variant="ghost" size="sm" onClick={() => setIsDeleteMode(false)}>Back to edit</Button> : null}</div>
        ) : (
          <div className="space-y-[18px]"><div className="grid gap-[18px] sm:grid-cols-2"><FilterLabel label="Status"><SelectField value={editValues.status} options={statusOptions.slice(1)} onValueChange={(value) => setEditValues((current) => ({ ...current, status: value as FaceIdAttendanceStatus }))} /></FilterLabel><div className="flex items-end"><Badge variant="secondary" className="mb-2.5">Asia/Tashkent (+05:00)</Badge></div><FilterLabel label="Check in"><CalendarField mode="datetime" value={editValues.checkInAt} onValueChange={(value) => setEditValues((current) => ({ ...current, checkInAt: value }))} /></FilterLabel><FilterLabel label="Check out"><CalendarField mode="datetime" value={editValues.checkOutAt} onValueChange={(value) => setEditValues((current) => ({ ...current, checkOutAt: value }))} /></FilterLabel></div><FilterLabel label="Note"><Textarea value={editValues.note} rows={4} onChange={(event) => setEditValues((current) => ({ ...current, note: event.target.value }))} placeholder="Check-out event missing" /></FilterLabel>{canDeleteRecords ? <div className="flex justify-end border-t border-[var(--border-subtle)] pt-[18px]"><Button type="button" variant="danger" size="sm" onClick={() => setIsDeleteMode(true)}>Delete record</Button></div> : null}</div>
        )}
      </Dialog>

      <Dialog
        open={selectedEmployee !== null}
        onClose={() => setSelectedEmployee(null)}
        title={employeeDetailQuery.data?.employee.full_name || selectedEmployee?.name || 'Employee attendance'}
        description={employeeDetailQuery.data?.employee.job_title || `${day.slice(0, 7)}`}
        eyebrow="Employee attendance"
        size="xl"
        footer={<Button variant="ghost" size="md" onClick={() => setSelectedEmployee(null)}>Close</Button>}
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
                    <tr key={`${record.employee_id}-${record.attendance_date}`} className="transition-colors hover:bg-[var(--card-hover)]"><td className={cn(bodyCellClass, 'pl-3.5 text-[13.5px] font-medium text-[var(--foreground)]')}>{formatDate(record.attendance_date)}</td><td className={cn(bodyCellClass, 'text-[13.5px] tabular-nums text-[var(--muted-strong)]')}>{formatTime(record.check_in_at, record.check_in_time)}</td><td className={cn(bodyCellClass, 'text-[13.5px] tabular-nums text-[var(--muted-strong)]')}>{formatTime(record.check_out_at, record.check_out_time)}</td><td className={cn(bodyCellClass, 'text-[13.5px] font-semibold tabular-nums text-[var(--foreground)]')}>{formatWorkedMinutes(record.worked_minutes)}</td><td className={cn(bodyCellClass, !hasRecordActions && 'pr-3.5')}><Badge variant={statusBadgeVariant(record.status)} dot>{record.status}</Badge></td>{hasRecordActions ? <td className={cn(bodyCellClass, 'pr-3.5 text-right')}><Button variant="ghost" size="sm" onClick={() => openEdit(record)}>{canEditRecords ? 'Edit' : 'Delete record'}</Button></td> : null}</tr>
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

const boardHeadClass = 'px-4 py-3.5 text-left align-bottom text-[13.5px] font-medium whitespace-nowrap'
const boardCellClass = 'border-t border-[var(--border-subtle)] px-4 py-3 align-middle whitespace-nowrap'

const CHIP_CLASS: Record<Cat, string> = {
  ok: 'bg-[var(--success)] text-white',
  late: 'bg-[var(--warning)] text-white',
  absent: 'bg-[var(--danger)] text-white',
  left: 'bg-[var(--muted)] text-white',
  open: 'bg-[var(--primary)] text-white',
  wait: 'bg-[var(--accent-soft)] text-[var(--muted-strong)] ring-1 ring-[var(--border)]',
}

function StateChip({ cat, children }: { cat: Cat; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-[3px] text-[13px] font-medium whitespace-nowrap', CHIP_CLASS[cat])}>{children}</span>
}

function IconNavButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--border)] bg-[var(--card)] text-[var(--muted-strong)] transition-colors hover:text-[var(--foreground)] disabled:cursor-default disabled:opacity-40">
      {children}
    </button>
  )
}

function CardFact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.04em] text-[var(--muted)] uppercase">{label}</dt>
      <dd className={cn('m-0 mt-px text-[13px] font-semibold whitespace-nowrap tabular-nums text-[var(--foreground)]', tone)}>{value}</dd>
    </div>
  )
}

function formatWorkedLong(minutes: number, t: (key: string, fallback?: string, params?: Record<string, string | number>) => string) {
  const h = Math.floor(minutes / 60)
  return h > 0
    ? t('attendance.board.worked_long', '{{h}} h {{m}} min', { h, m: minutes % 60 })
    : t('attendance.board.worked_min', '{{m}} min', { m: minutes })
}

/** Ring chart: one arc per category. */
function Donut({ parts, size }: { parts: { key: string; value: number; color: string }[]; size: number }) {
  const stroke = 18
  const radius = (size - stroke) / 2
  const length = 2 * Math.PI * radius
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  const gap = parts.filter((part) => part.value > 0).length > 1 ? 3 : 0
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--accent-soft)" strokeWidth={stroke} />
      {total > 0 ? parts.filter((part) => part.value > 0).map((part) => {
        const arc = (part.value / total) * length
        const dash = Math.max(0.5, arc - gap)
        const node = <circle key={part.key} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={part.color} strokeWidth={stroke} strokeDasharray={`${dash} ${length}`} strokeDashoffset={-offset} />
        offset += arc
        return node
      }) : null}
    </svg>
  )
}

/** One employee's day: time in office as a bar on a 07:00–21:00 axis (+ "now" marker today). */
function DayBar({ record, now }: { record: FaceIdDailyRecord | null; now: number | null }) {
  const inn = record ? toMinutes(record.check_in_at, record.check_in_time) : null
  const out = record ? toMinutes(record.check_out_at, record.check_out_time) : null
  const lo = Math.max(0, Math.min(7 * 60, inn ?? 7 * 60) - 30)
  const hi = Math.min(1440, Math.max(21 * 60, out ?? 0, now ?? 0) + 30)
  const pct = (m: number) => `${((m - lo) / (hi - lo)) * 100}%`
  const end = out ?? (inn !== null && now !== null && now > inn ? now : null)
  return (
    <div className="relative h-2 rounded-full bg-[var(--accent-soft)]" aria-hidden="true">
      {inn !== null && end !== null ? <i className="absolute inset-y-px rounded-full bg-[var(--tc)]" style={{ left: pct(inn), width: `${((Math.max(end, inn) - inn) / (hi - lo)) * 100}%` }} /> : null}
      {now !== null && now >= lo && now <= hi ? <i className="absolute -inset-y-[3px] w-0.5 rounded-sm bg-[var(--foreground)] opacity-55" style={{ left: pct(now) }} /> : null}
    </div>
  )
}

function FilterLabel({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-col gap-2"><Label>{label}</Label>{children}</div>
}

function SummaryStat({ label, value, className }: { label: string; value: number | string; className: string }) {
  return <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-3.5"><p className="ui-card-label">{label}</p><p className={cn('mt-2 text-[22px] font-bold tracking-[-0.03em] tabular-nums', className)}>{value}</p></div>
}
