import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowClockwiseIcon, ArrowCounterClockwiseIcon, CaretLeftIcon, CaretRightIcon, FunnelSimpleIcon, GearSixIcon, MagnifyingGlassIcon, PlusIcon, UserIcon, XIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { calendarService, type CalendarUser } from '../../../shared/api/services/calendar.service'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { cn } from '../../../shared/lib/cn'
import { useToast } from '../../../shared/toast/useToast'
import { SelectField } from '../../../shared/ui/select-field'
import { isProbablyEncryptedValue } from '../../../shared/lib/customer-display'
import { formatPhone } from '../../telephony/components/telephonyFormat'
import { useAuth } from '../../auth/hooks/useAuth'
import { AgendaView } from '../components/AgendaView'
import { EventDialog } from '../components/EventDialog'
import { MonthView } from '../components/MonthView'
import { SettingsDialog } from '../components/SettingsDialog'
import { SidePanel } from '../components/SidePanel'
import { WeekView } from '../components/WeekView'
import { addDays, dayOf, dayParts, joinDayTime, monthGrid, monthTitle, parseDay, tashkentToday, timeOf, toDayString, weekDays } from '../lib/dates'
import { kindLabel } from '../lib/kindLabel'
import { apiToEvent, loadCalendarEvents, loadCustomerNames, loadDayTypes, loadTasks } from '../lib/sources'
import { hasLocalEvents, migrateLocalEvents } from '../lib/store'
import { KIND_COLORS, KINDS, type CalEvent, type CalendarView, type EventDraft, type EventKind } from '../lib/types'

const PREFS_KEY = 'cims.calendar.prefs'
/** Opening the calendar always starts with meetings. */
const DEFAULT_TYPES: EventKind[] = ['meeting']

function readPrefs(): { view: CalendarView } {
  try {
    const data = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as { view?: CalendarView }
    return { view: data.view === 'week' || data.view === 'list' ? data.view : 'month' }
  } catch {
    return { view: 'month' }
  }
}

function plusHour(time: string) {
  const [h, m] = time.split(':').map(Number)
  return `${String(Math.min(23, (h || 0) + 1)).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`
}

function isTyping(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))
}

/** 422 → { field: message } from FastAPI's `detail: [{ loc, msg }]`. */
function fieldErrors(error: unknown): Record<string, string> {
  const detail = ((error as { details?: { detail?: unknown } } | null)?.details?.detail)
  if (!Array.isArray(detail)) return {}
  const out: Record<string, string> = {}
  for (const item of detail as Array<{ loc?: unknown[]; msg?: string }>) {
    const field = Array.isArray(item.loc) ? String(item.loc[item.loc.length - 1]) : ''
    if (field && item.msg && !out[field]) out[field] = item.msg
  }
  return out
}

/** /calendar — events, CRM callbacks and meetings (from the calendar API), task deadlines and holidays in one calendar. */
export function CalendarPage() {
  const { t } = useLocale()
  const { user, can } = useAuth()
  const navigate = useNavigate()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const canCreate = can('calendar', 'create')
  const canEdit = can('calendar', 'edit')
  const canDelete = can('calendar', 'delete')
  const userId = user?.id ?? null

  const today = tashkentToday()
  const [prefs, setPrefs] = useState(readPrefs)
  const [cursor, setCursor] = useState(() => parseDay(tashkentToday()))
  const [selectedDay, setSelectedDay] = useState(today)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [slide, setSlide] = useState<'left' | 'right' | null>(null)
  const [events, setEvents] = useState<CalEvent[] | null>(null)
  const [eventsFailed, setEventsFailed] = useState(false)
  const [tasks, setTasks] = useState<CalEvent[] | null>(null)
  const [dayTypes, setDayTypes] = useState<CalEvent[]>([])
  const [users, setUsers] = useState<CalendarUser[]>([])
  const [personId, setPersonId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<{ draft: EventDraft; saving: boolean; errors: Record<string, string> } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [types, setTypes] = useState<EventKind[]>(DEFAULT_TYPES)
  const [customerNames, setCustomerNames] = useState<Map<number, string>>(() => new Map())
  const canCrm = can('customers') || can('crm')
  const view = prefs.view

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* private mode */ }
  }, [prefs])

  // Search goes to the server a moment after typing stops.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  // Visible days and the date range to load.
  const days = useMemo(() => (view === 'week' ? weekDays(cursor) : monthGrid(cursor)), [cursor, view])
  const rangeStart = view === 'list' ? toDayString(new Date(cursor.getFullYear(), cursor.getMonth(), 1)) : toDayString(days[0])
  const rangeEnd = view === 'list' ? toDayString(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)) : toDayString(days[days.length - 1])

  // ── Sources ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    calendarService.users().then((list) => { if (alive) setUsers(list) }).catch(() => undefined)
    return () => { alive = false }
  }, [])

  // Old browser-only events move to the server once.
  useEffect(() => {
    if (userId === null || !canCreate || !hasLocalEvents(userId)) return
    let alive = true
    void migrateLocalEvents(userId).then(({ moved, failed }) => {
      if (!alive) return
      if (moved) {
        showToast({ title: t('calendar.migrated', '{{count}} of your events moved to the server', { count: moved }), tone: 'success' })
        setRefreshKey((value) => value + 1)
      }
      if (failed) showToast({ title: t('calendar.migrate_failed', '{{count}} events could not be moved — they stay in this browser', { count: failed }), tone: 'error' })
    })
    return () => { alive = false }
  }, [canCreate, showToast, t, userId])

  useEffect(() => {
    let alive = true
    loadCalendarEvents({ dateFrom: rangeStart, dateTo: rangeEnd, userId: personId, search: query })
      .then((items) => { if (alive) { setEvents(items); setEventsFailed(false) } })
      .catch(() => { if (alive) { setEvents([]); setEventsFailed(true) } })
    return () => { alive = false }
  }, [personId, query, rangeEnd, rangeStart, refreshKey])

  // Task deadlines: of the person being looked at (or mine).
  const taskOwner = personId ?? userId
  useEffect(() => {
    if (taskOwner === null) return
    let alive = true
    loadTasks(taskOwner).then((items) => { if (alive) setTasks(items) }).catch(() => { if (alive) setTasks([]) })
    return () => { alive = false }
  }, [taskOwner, refreshKey])

  useEffect(() => {
    let alive = true
    loadDayTypes(rangeStart, rangeEnd, personId ?? userId).then((items) => { if (alive) setDayTypes(items) }).catch(() => { if (alive) setDayTypes([]) })
    return () => { alive = false }
  }, [rangeStart, rangeEnd, personId, userId, refreshKey])

  const loading = events === null || tasks === null

  // The calendar API may send CRM names encrypted: show the customer's real name from the CRM instead.
  const needsNames = canCrm && (events ?? []).some((event) => (event.kind === 'recall' || event.kind === 'meeting') && isProbablyEncryptedValue(event.title))
  useEffect(() => {
    if (!needsNames) return
    let alive = true
    void loadCustomerNames().then((names) => { if (alive) setCustomerNames(names) })
    return () => { alive = false }
  }, [needsNames])

  const allEvents = useMemo(() => {
    const needle = query.toLowerCase()
    // Tasks and holidays are filtered here; the server already searched its own items.
    const local = [...(tasks ?? []), ...dayTypes].filter((event) => !needle || event.title.toLowerCase().includes(needle))
    const server = (events ?? []).map((event) => {
      if (event.kind !== 'recall' && event.kind !== 'meeting') return event
      const phone = event.phone && !isProbablyEncryptedValue(event.phone) ? event.phone : null
      if (!isProbablyEncryptedValue(event.title)) return phone === event.phone ? event : { ...event, phone }
      const name = (event.customerId ? customerNames.get(event.customerId) : '') || (phone ? formatPhone(phone) : '')
        || (event.customerId ? t('calendar.customer_n', 'Customer #{{id}}', { id: event.customerId }) : t('calendar.customer', 'Customer'))
      return { ...event, title: name, phone }
    })
    return [...server, ...local]
  }, [customerNames, dayTypes, events, query, t, tasks])

  const typeSet = useMemo(() => new Set(types), [types])
  const visibleEvents = useMemo(() => allEvents.filter((event) => typeSet.has(event.kind)), [allEvents, typeSet])

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const event of visibleEvents) {
      const key = dayOf(event.start)
      if (!key) continue
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || (a.allDay ? 0 : timeOf(a.start).localeCompare(timeOf(b.start))))
    }
    return map
  }, [visibleEvents])

  const counts = useMemo(() => {
    const out = Object.fromEntries(KINDS.map((kind) => [kind, 0])) as Record<EventKind, number>
    for (const event of allEvents) {
      const key = dayOf(event.start)
      if (key >= rangeStart && key <= rangeEnd) out[event.kind] += 1
    }
    return out
  }, [allEvents, rangeEnd, rangeStart])

  const selectedEvent = selectedEventId ? allEvents.find((event) => event.id === selectedEventId) ?? null : null

  // ── Navigation ───────────────────────────────────────────────────────────
  const shift = useCallback((delta: -1 | 1) => {
    setSlide(delta > 0 ? 'left' : 'right')
    setCursor((current) => (view === 'week' ? addDays(current, 7 * delta) : new Date(current.getFullYear(), current.getMonth() + delta, 1)))
  }, [view])

  const goToday = useCallback(() => {
    const now = tashkentToday()
    setSlide(null)
    setCursor(parseDay(now))
    setSelectedDay(now)
    setSelectedEventId(null)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'ArrowLeft') { event.preventDefault(); shift(-1) }
      else if (event.key === 'ArrowRight') { event.preventDefault(); shift(1) }
      else if (event.key.toLowerCase() === 't') goToday()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goToday, shift])

  function selectDay(day: string) {
    setSelectedDay(day)
    setSelectedEventId(null)
    const date = parseDay(day)
    if (view === 'month' && date.getMonth() !== cursor.getMonth()) {
      setSlide(date < cursor ? 'right' : 'left')
      setCursor(date)
    }
  }

  function openEvent(event: CalEvent) {
    setSelectedEventId(event.id)
    setSelectedDay(dayOf(event.start))
  }

  function go(event: CalEvent) {
    if ((event.kind === 'recall' || event.kind === 'meeting') && event.customerId) navigate(`/crm/customers?customer_id=${event.customerId}`)
    if (event.kind === 'task' && event.boardId) navigate(`/boards/${event.boardId}`)
  }

  // ── Events (server) ──────────────────────────────────────────────────────
  function create(day: string, time?: string) {
    if (!canCreate) return
    const start = time ?? '10:00'
    setDialog({
      saving: false,
      errors: {},
      draft: { baseId: null, title: '', description: '', date: day, allDay: false, startTime: start, endTime: plusHour(start), reminder: true, recurrence: 'none', until: '', participantIds: [] },
    })
  }

  async function edit(event: CalEvent) {
    if (!event.baseId) return
    // A repeat shows its own date; the form edits the whole series from its first date.
    const base = await calendarService.event(event.baseId).catch(() => null)
    const item = base ? apiToEvent(base) : event
    const day = dayOf(item.start)
    setDialog({
      saving: false,
      errors: {},
      draft: {
        baseId: event.baseId,
        title: item.title,
        description: item.note ?? '',
        date: day,
        allDay: item.allDay,
        startTime: item.allDay ? '10:00' : timeOf(item.start) || '10:00',
        endTime: item.allDay ? '11:00' : (item.end ? timeOf(item.end) : '') || plusHour(timeOf(item.start) || '10:00'),
        reminder: Boolean(item.reminder),
        recurrence: item.recurrence ?? 'none',
        until: item.recurrenceUntil ? item.recurrenceUntil.slice(0, 10) : '',
        participantIds: item.participantIds ?? [],
      },
    })
  }

  async function save(draft: EventDraft) {
    const payload = {
      title: draft.title,
      description: draft.description || null,
      start_at: joinDayTime(draft.date, draft.allDay ? '00:00' : draft.startTime),
      end_at: draft.allDay ? null : joinDayTime(draft.date, draft.endTime || draft.startTime),
      all_day: draft.allDay,
      reminder_enabled: draft.reminder,
      recurrence: draft.recurrence,
      recurrence_until: draft.recurrence === 'none' ? null : draft.until || null,
      participant_ids: draft.participantIds,
    }
    setDialog((current) => (current ? { ...current, saving: true, errors: {} } : current))
    try {
      if (draft.baseId) await calendarService.update(draft.baseId, payload)
      else await calendarService.create(payload)
      setDialog(null)
      setSelectedDay(draft.date)
      setSelectedEventId(null)
      setRefreshKey((value) => value + 1)
      showToast({ title: t('calendar.saved', 'Event saved'), description: draft.title, tone: 'success' })
    } catch (error) {
      const status = (error as { status?: number } | null)?.status
      const errors = status === 422 ? fieldErrors(error) : {}
      setDialog((current) => (current ? { ...current, saving: false, errors } : current))
      showToast({
        title: status === 403 ? t('calendar.forbidden', 'You do not have permission for this') : status === 422 ? t('calendar.invalid', 'Check the highlighted fields') : t('calendar.save_failed', 'Could not save the event'),
        tone: 'error',
      })
    }
  }

  async function remove(event: CalEvent) {
    if (!event.baseId) return
    const ok = await confirm({
      title: t('calendar.delete_title', 'Delete “{{title}}”?', { title: event.title }),
      description: event.recurrence && event.recurrence !== 'none'
        ? t('calendar.delete_series_text', 'It is a repeating event — every repeat is deleted.')
        : t('calendar.delete_text', 'The event is removed from the calendar.'),
      confirmLabel: t('common.delete', 'Delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await calendarService.remove(event.baseId)
      setSelectedEventId(null)
      setRefreshKey((value) => value + 1)
    } catch (error) {
      const status = (error as { status?: number } | null)?.status
      showToast({ title: status === 403 ? t('calendar.forbidden', 'You do not have permission for this') : t('calendar.delete_failed', 'Could not delete the event'), tone: 'error' })
    }
  }

  const isDefaultTypes = types.length === DEFAULT_TYPES.length && DEFAULT_TYPES.every((kind) => typeSet.has(kind))
  const filtersActive = !isDefaultTypes || personId !== null || search.trim() !== ''
  function clearFilters() {
    setSearch('')
    setQuery('')
    setPersonId(null)
    setTypes(DEFAULT_TYPES)
  }

  const title = view === 'week'
    ? `${dayParts(toDayString(days[0])).date} – ${dayParts(toDayString(days[6])).date}`
    : monthTitle(cursor.getFullYear(), cursor.getMonth())
  const gridKey = `${view}:${rangeStart}`
  const listGroups = useMemo(() => {
    if (view !== 'list') return []
    return [...byDay.entries()]
      .filter(([day]) => day >= rangeStart && day <= rangeEnd)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, events]) => ({ day, events }))
  }, [byDay, rangeEnd, rangeStart, view])
  const typeOptions = KINDS.map((kind) => ({ value: kind, label: kindLabel(kind, t), color: KIND_COLORS[kind], hint: String(counts[kind]) }))

  return (
    <section className="flex h-[calc(100dvh-var(--header-h)-44px)] min-h-[620px] flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label={t('calendar.prev', 'Previous')} className="mm-press grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--input-surface)]">
            <CaretLeftIcon size={16} weight="bold" />
          </button>
          <button type="button" onClick={() => shift(1)} aria-label={t('calendar.next', 'Next')} className="mm-press grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--input-surface)]">
            <CaretRightIcon size={16} weight="bold" />
          </button>
        </div>
        <h1 key={title} className={cn('min-w-[150px] text-[20px] font-bold tracking-[-0.02em] text-[var(--foreground)]', slide === 'left' ? 'cal-slide-left' : slide === 'right' ? 'cal-slide-right' : '')}>{title}</h1>
        <button type="button" onClick={goToday} className="mm-press h-9 rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] font-semibold text-[var(--foreground)] hover:bg-[var(--input-surface)]" title="T">
          {t('calendar.today', 'Today')}
        </button>
        {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" aria-label={t('common.loading', 'Loading…')} /> : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label={t('calendar.view', 'View')} className="inline-flex h-9 items-center rounded-[11px] bg-[var(--muted-surface)] p-0.5">
            {([
              ['month', t('calendar.view.month', 'Month')],
              ['week', t('calendar.view.week', 'Week')],
              ['list', t('calendar.view.list', 'List')],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={view === value}
                onClick={() => { setSlide(null); setPrefs((current) => ({ ...current, view: value })) }}
                className={cn('h-8 rounded-[9px] px-3.5 text-[13px] font-semibold transition-colors', view === value ? 'bg-[var(--card)] text-[var(--foreground)] shadow-[0_1px_3px_rgba(14,21,37,0.12)]' : 'text-[var(--muted-strong)] hover:text-[var(--foreground)]')}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)} aria-label={t('calendar.refresh', 'Refresh')} className="mm-press grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--border)] bg-[var(--card)] text-[var(--muted-strong)] hover:bg-[var(--input-surface)]">
            <ArrowClockwiseIcon size={16} className={cn(loading && 'animate-spin')} />
          </button>
          {canEdit ? (
            <button type="button" onClick={() => setSettingsOpen(true)} aria-label={t('calendar.settings.title', 'CRM reminders')} title={t('calendar.settings.title', 'CRM reminders')} className="mm-press grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--border)] bg-[var(--card)] text-[var(--muted-strong)] hover:bg-[var(--input-surface)]">
              <GearSixIcon size={16} />
            </button>
          ) : null}
          {canCreate ? (
            <button type="button" onClick={() => create(selectedDay)} className="mm-press inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--primary)] px-3.5 text-[13px] font-semibold text-white hover:bg-[var(--primary-hover)]">
              <PlusIcon size={15} weight="bold" /> {t('calendar.add_event', 'Add event')}
            </button>
          ) : null}
        </div>
      </div>

      {/* Filters: what to show, whose, and a search — each a clear field of its own */}
      <div className="flex flex-wrap items-end gap-2.5 rounded-[18px] border border-[var(--border)] bg-[var(--card)] p-3">
        <div className="w-full min-w-[220px] sm:w-[300px]">
          <span className="mb-1 block px-0.5 text-[11.5px] font-semibold text-[var(--muted)]">{t('calendar.filter.types', 'What to show')}</span>
          <SelectField
            multiple
            value=""
            values={types}
            onValuesChange={(values) => setTypes(KINDS.filter((kind) => values.includes(kind)))}
            options={typeOptions}
            placeholder={t('calendar.filter.types_none', 'Nothing selected')}
            leadingIcon={<FunnelSimpleIcon size={15} />}
          />
        </div>
        {users.length > 1 ? (
          <div className="w-full min-w-[200px] sm:w-[240px]">
            <span className="mb-1 block px-0.5 text-[11.5px] font-semibold text-[var(--muted)]">{t('calendar.filter.user', 'Employee')}</span>
            <SelectField
              searchable
              value={personId === null ? '' : String(personId)}
              onValueChange={(value) => setPersonId(value ? Number(value) : null)}
              options={[{ value: '', label: t('calendar.filter.user_any', 'Everyone I can see') }, ...users.map((person) => ({ value: String(person.id), label: person.name, hint: person.detail ?? undefined }))]}
              leadingIcon={<UserIcon size={15} />}
              searchPlaceholder={t('common.search', 'Search')}
              emptyMessage={t('calendar.no_users', 'No users')}
            />
          </div>
        ) : null}
        <label className="block w-full min-w-[200px] flex-1 sm:max-w-[320px]">
          <span className="mb-1 block px-0.5 text-[11.5px] font-semibold text-[var(--muted)]">{t('calendar.filter.search_label', 'Search')}</span>
          <span className="relative flex h-10 items-center">
            <MagnifyingGlassIcon size={15} className="pointer-events-none absolute left-3 text-[var(--muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('calendar.filter.search', 'Search events, customers…')}
              className="h-10 w-full rounded-[11px] border border-[var(--border)] bg-[var(--surface)] pr-8 pl-9 text-[13.5px] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none"
            />
            {search ? (
              <button type="button" onClick={() => setSearch('')} aria-label={t('common.clear', 'Clear')} className="absolute right-2 grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--input-surface)]">
                <XIcon size={12} />
              </button>
            ) : null}
          </span>
        </label>
        {filtersActive ? (
          <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center gap-1.5 rounded-[11px] px-3 text-[13px] font-semibold text-[var(--muted-strong)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]">
            <ArrowCounterClockwiseIcon size={14} /> {t('calendar.filter.reset', 'Reset')}
          </button>
        ) : null}
      </div>

      {/* What is on screen now: the chosen types with their counts */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
        {types.length === 0 ? <span className="text-[12.5px] font-semibold text-[var(--warning-text)]">{t('calendar.filter.types_none', 'Nothing selected')}</span> : null}
        {types.map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5 text-[12px] text-[var(--muted-strong)]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: KIND_COLORS[kind] }} />
            {kindLabel(kind, t)}
            <span className="font-semibold text-[var(--foreground)] tabular-nums">{counts[kind]}</span>
          </span>
        ))}
        {eventsFailed ? <span className="text-[12px] font-medium text-[var(--danger-text)]">{t('calendar.load_failed', 'Calendar events could not be loaded')}</span> : null}
        <span className="ml-auto hidden text-[11.5px] text-[var(--muted)] 2xl:inline">{t('calendar.tip', 'Double-click a day or an hour to add an event · ← → to move · T — today')}</span>
      </div>

      {/* Calendar + day / event panel */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-[480px] overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--card)]">
          {view === 'month' ? (
            <MonthView
              days={days}
              month={cursor.getMonth()}
              byDay={byDay}
              today={today}
              selectedDay={selectedDay}
              selectedEventId={selectedEventId}
              slide={slide}
              gridKey={gridKey}
              onSelectDay={selectDay}
              onOpenEvent={openEvent}
              onCreate={(day) => create(day)}
            />
          ) : view === 'week' ? (
            <WeekView
              days={days}
              byDay={byDay}
              today={today}
              selectedDay={selectedDay}
              selectedEventId={selectedEventId}
              gridKey={gridKey}
              slide={slide}
              onSelectDay={selectDay}
              onOpenEvent={openEvent}
              onCreateAt={(day, time) => create(day, time)}
            />
          ) : (
            <AgendaView groups={listGroups} today={today} selectedEventId={selectedEventId} onOpenEvent={openEvent} />
          )}
        </div>
        <aside className="min-h-[360px] overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--card)]">
          <SidePanel
            day={selectedDay}
            events={byDay.get(selectedDay) ?? []}
            selected={selectedEvent}
            onOpenEvent={openEvent}
            onCloseEvent={() => setSelectedEventId(null)}
            onCreate={(day) => create(day)}
            onEdit={(event) => void edit(event)}
            onDelete={(event) => void remove(event)}
            onGo={go}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </aside>
      </div>

      {dialog ? (
        <EventDialog
          initial={dialog.draft}
          users={users}
          saving={dialog.saving}
          errors={dialog.errors}
          onClose={() => setDialog(null)}
          onSave={(draft) => void save(draft)}
        />
      ) : null}
      {settingsOpen ? <SettingsDialog onClose={() => setSettingsOpen(false)} /> : null}
    </section>
  )
}
