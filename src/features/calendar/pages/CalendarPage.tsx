import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowClockwiseIcon, CaretLeftIcon, CaretRightIcon, PlusIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { cn } from '../../../shared/lib/cn'
import { useToast } from '../../../shared/toast/useToast'
import { useAuth } from '../../auth/hooks/useAuth'
import { AgendaView } from '../components/AgendaView'
import { EventDialog } from '../components/EventDialog'
import { MonthView } from '../components/MonthView'
import { SidePanel } from '../components/SidePanel'
import { WeekView } from '../components/WeekView'
import { addDays, dayOf, dayParts, monthGrid, monthTitle, parseDay, toDayString, weekDays } from '../lib/dates'
import { kindLabel } from '../lib/kindLabel'
import { loadCallbacks, loadDayTypes, loadTasks, personalToEvent } from '../lib/sources'
import { createLocalEventStore } from '../lib/store'
import { KIND_COLORS, KINDS, PERSONAL_COLORS, type CalEvent, type CalendarView, type EventKind, type PersonalEvent } from '../lib/types'

const PREFS_KEY = 'cims.calendar.prefs'

function readPrefs(): { view: CalendarView; hidden: EventKind[] } {
  try {
    const data = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as { view?: CalendarView; hidden?: EventKind[] }
    return { view: data.view === 'week' || data.view === 'list' ? data.view : 'month', hidden: Array.isArray(data.hidden) ? data.hidden : [] }
  } catch {
    return { view: 'month', hidden: [] }
  }
}

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

function plusHour(time: string) {
  const [h, m] = time.split(':').map(Number)
  return `${String(Math.min(23, (h || 0) + 1)).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`
}

function isTyping(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))
}

/** /calendar — callbacks, task deadlines, holidays / short days and the user's own events in one calendar. */
export function CalendarPage() {
  const { t } = useLocale()
  const { user, can } = useAuth()
  const navigate = useNavigate()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const store = useMemo(() => createLocalEventStore(user?.id ?? 'guest'), [user?.id])
  const canCrm = can('customers') || can('crm')

  const today = toDayString(new Date())
  const [prefs, setPrefs] = useState(readPrefs)
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(today)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [slide, setSlide] = useState<'left' | 'right' | null>(null)
  const [callbacks, setCallbacks] = useState<CalEvent[] | null>(null)
  const [tasks, setTasks] = useState<CalEvent[] | null>(null)
  const [dayTypes, setDayTypes] = useState<CalEvent[]>([])
  const [personal, setPersonal] = useState<PersonalEvent[]>([])
  const [dialog, setDialog] = useState<{ event: PersonalEvent; isNew: boolean } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const view = prefs.view
  const hidden = useMemo(() => new Set(prefs.hidden), [prefs.hidden])

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* private mode */ }
  }, [prefs])

  // Visible days and the date range to load.
  const days = useMemo(() => (view === 'week' ? weekDays(cursor) : monthGrid(cursor)), [cursor, view])
  const rangeStart = view === 'list' ? toDayString(new Date(cursor.getFullYear(), cursor.getMonth(), 1)) : toDayString(days[0])
  const rangeEnd = view === 'list' ? toDayString(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)) : toDayString(days[days.length - 1])

  // ── Sources ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canCrm) return
    let alive = true
    loadCallbacks().then((items) => { if (alive) setCallbacks(items) }).catch(() => { if (alive) setCallbacks([]) })
    return () => { alive = false }
  }, [canCrm, refreshKey])

  useEffect(() => {
    if (!user?.id) return
    let alive = true
    loadTasks(user.id).then((items) => { if (alive) setTasks(items) }).catch(() => { if (alive) setTasks([]) })
    return () => { alive = false }
  }, [user?.id, refreshKey])

  useEffect(() => {
    let alive = true
    loadDayTypes(rangeStart, rangeEnd, user?.id ?? null).then((items) => { if (alive) setDayTypes(items) }).catch(() => { if (alive) setDayTypes([]) })
    return () => { alive = false }
  }, [rangeStart, rangeEnd, user?.id, refreshKey])

  useEffect(() => {
    let alive = true
    void store.list().then((items) => { if (alive) setPersonal(items) })
    return () => { alive = false }
  }, [store])

  const loading = (canCrm && callbacks === null) || tasks === null

  const allEvents = useMemo(() => [
    ...(canCrm ? callbacks ?? [] : []),
    ...(tasks ?? []),
    ...dayTypes,
    ...personal.map(personalToEvent),
  ], [callbacks, canCrm, dayTypes, personal, tasks])

  const visibleEvents = useMemo(() => allEvents.filter((event) => !hidden.has(event.kind)), [allEvents, hidden])

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
      list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || (a.allDay ? 0 : new Date(a.start).getTime() - new Date(b.start).getTime()))
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
    const now = new Date()
    setSlide(null)
    setCursor(now)
    setSelectedDay(toDayString(now))
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
    if (event.kind === 'callback' && event.customerId) navigate(`/crm/customers?customer_id=${event.customerId}`)
    if (event.kind === 'task' && event.boardId) navigate(`/boards/${event.boardId}`)
  }

  // ── Own events ───────────────────────────────────────────────────────────
  function create(day: string, time?: string) {
    const start = time ?? '10:00'
    setDialog({
      isNew: true,
      event: { id: newId(), title: '', date: day, allDay: false, startTime: start, endTime: plusHour(start), color: PERSONAL_COLORS[0], note: '', createdAt: new Date().toISOString() },
    })
  }

  function edit(event: CalEvent) {
    const item = personal.find((entry) => entry.id === event.personalId)
    if (item) setDialog({ event: item, isNew: false })
  }

  async function save(item: PersonalEvent) {
    await store.save(item)
    setPersonal(await store.list())
    setDialog(null)
    setSelectedDay(item.date)
    setSelectedEventId(`personal:${item.id}`)
    showToast({ title: t('calendar.saved', 'Event saved'), description: item.title, tone: 'success' })
  }

  async function remove(event: CalEvent) {
    if (!event.personalId) return
    const ok = await confirm({
      title: t('calendar.delete_title', 'Delete “{{title}}”?', { title: event.title }),
      description: t('calendar.delete_text', 'The event is removed from your calendar.'),
      confirmLabel: t('common.delete', 'Delete'),
      tone: 'danger',
    })
    if (!ok) return
    await store.remove(event.personalId)
    setPersonal(await store.list())
    setSelectedEventId(null)
  }

  function toggleKind(kind: EventKind) {
    setPrefs((current) => ({ ...current, hidden: current.hidden.includes(kind) ? current.hidden.filter((item) => item !== kind) : [...current.hidden, kind] }))
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
  const kinds = KINDS.filter((kind) => kind !== 'callback' || canCrm)

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
          <button type="button" onClick={() => create(selectedDay)} className="mm-press inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--primary)] px-3.5 text-[13px] font-semibold text-white hover:bg-[var(--primary-hover)]">
            <PlusIcon size={15} weight="bold" /> {t('calendar.add_event', 'Add event')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {kinds.map((kind) => {
          const off = hidden.has(kind)
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={!off}
              onClick={() => toggleKind(kind)}
              className={cn('mm-press inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[12.5px] font-semibold transition-colors', off ? 'border-[var(--border)] bg-transparent text-[var(--muted)] line-through decoration-[1.5px]' : 'border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]')}
            >
              <span className={cn('h-2.5 w-2.5 rounded-full transition-opacity', off && 'opacity-35')} style={{ background: KIND_COLORS[kind] }} />
              {kindLabel(kind, t)}
              <span className="rounded-full bg-[var(--muted-surface)] px-1.5 text-[11px] text-[var(--muted-strong)] tabular-nums">{counts[kind]}</span>
            </button>
          )
        })}
        <span className="ml-auto hidden text-[11.5px] text-[var(--muted)] xl:inline">{t('calendar.tip', 'Double-click a day or an hour to add an event · ← → to move · T — today')}</span>
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
            onEdit={edit}
            onDelete={(event) => void remove(event)}
            onGo={go}
          />
        </aside>
      </div>

      {dialog ? <EventDialog initial={dialog.event} isNew={dialog.isNew} onClose={() => setDialog(null)} onSave={(item) => void save(item)} /> : null}
    </section>
  )
}
