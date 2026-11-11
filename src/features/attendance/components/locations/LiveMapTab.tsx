import { useMemo, useRef, useState } from 'react'
import { ArrowClockwiseIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../../app/hooks/useLocale'
import type { MapEmployee } from '../../../../shared/api/services/attendanceLocations.service'
import { getApiErrorMessage } from '../../../../shared/lib/api-error'
import { cn } from '../../../../shared/lib/cn'
import { Button } from '../../../../shared/ui/button'
import { Input } from '../../../../shared/ui/input'
import { LoadingStateBlock, StateBlock } from '../../../../shared/ui/state-block'
import {
  employeeLocationName,
  employeeMarkerState,
  formatAgo,
  formatTime,
  hasPosition,
  initialsOf,
  MARKER_STATES,
  markerStateBadgeClass,
  markerStateChipClass,
  markerStateHint,
  markerStateLabel,
  markerStateLegendLabel,
  sortEmployeesForList,
  type MarkerState,
  type Translate,
} from '../../lib/locations'
import { useLiveLocationMap, type LiveConnection } from '../../lib/useLiveLocationMap'
import { LiveLocationMap, type MapFocusRequest } from './LiveLocationMap'

const DESKTOP_QUERY = '(min-width: 1024px)'

export function LiveMapTab() {
  const { t } = useLocale()
  const live = useLiveLocationMap()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [focus, setFocus] = useState<MapFocusRequest | null>(null)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const mapWrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const counts = useMemo(() => {
    const result: Record<MarkerState, number> = { live: 0, stale: 0, checked_out: 0, no_data: 0 }
    for (const employee of live.employees) result[employeeMarkerState(employee, live.now)] += 1
    return result
  }, [live.employees, live.now])

  const sorted = useMemo(() => sortEmployeesForList(live.employees, live.now), [live.employees, live.now])
  const needle = search.trim().toLowerCase()
  const visible = needle ? sorted.filter((employee) => employee.name.toLowerCase().includes(needle)) : sorted

  function pickFromList(employee: MapEmployee) {
    setSelectedId(employee.employee_id)
    if (!hasPosition(employee)) return
    setFocus((current) => ({ employeeId: employee.employee_id, nonce: (current?.nonce ?? 0) + 1 }))
    // On phones the list sits under the map: bring the map back into view.
    if (!window.matchMedia(DESKTOP_QUERY).matches) mapWrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function pickFromMap(employeeId: number) {
    setSelectedId(employeeId)
    if (window.matchMedia(DESKTOP_QUERY).matches) {
      listRef.current?.querySelector(`[data-employee-id="${employeeId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }

  async function refresh() {
    setRefreshing(true)
    await live.reload()
    setRefreshing(false)
  }

  if (live.status === 'loading') {
    return <LoadingStateBlock eyebrow={t('attendance.loc.tab_live', 'Live map')} title={t('attendance.loc.map_loading', 'Loading the live map')} />
  }

  if (live.status === 'error') {
    return (
      <StateBlock
        tone="error"
        eyebrow={t('attendance.loc.tab_live', 'Live map')}
        title={t('attendance.loc.map_error', 'Could not load the live map')}
        description={getApiErrorMessage(live.error)}
        actionLabel={t('attendance.loc.retry', 'Retry')}
        onAction={() => void refresh()}
      />
    )
  }

  return (
    <section className="page-enter space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[16px] bg-[var(--card)] px-4 py-2.5" aria-label={t('attendance.loc.legend', 'Legend')}>
          {MARKER_STATES.map((state) => (
            <li key={state} className="flex items-center gap-2 text-[12.5px] text-[var(--muted-strong)]" title={markerStateHint(state, t)}>
              <span className={cn('h-3.5 w-3.5 shrink-0 rounded-full border-2 bg-[var(--surface)]', markerStateBadgeClass[state])} aria-hidden="true" />
              <span>{markerStateLegendLabel(state, t)}</span>
              <span className="font-semibold text-[var(--foreground)] tabular-nums">{counts[state]}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <ConnectionPill connection={live.connection} t={t} />
          <Button variant="secondary" size="sm" loading={refreshing} leftIcon={<ArrowClockwiseIcon size={15} weight="bold" />} onClick={() => void refresh()}>
            {t('attendance.loc.refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      {live.error ? (
        <p className="rounded-[14px] bg-[var(--danger-dim)] px-4 py-2.5 text-[12.5px] text-[var(--danger-text)]">
          {t('attendance.loc.map_refresh_failed', 'Could not refresh the map: {{message}}', { message: getApiErrorMessage(live.error) })}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div ref={mapWrapRef} className="h-[56vh] min-h-[320px] overflow-hidden rounded-[20px] bg-[var(--card)] lg:h-[calc(100dvh-250px)] lg:min-h-[480px]">
          <LiveLocationMap
            locations={live.locations}
            employees={live.employees}
            now={live.now}
            selectedId={selectedId}
            focus={focus}
            onSelect={pickFromMap}
          />
        </div>

        <aside className="flex min-h-0 flex-col rounded-[20px] bg-[var(--card)] lg:h-[calc(100dvh-250px)] lg:min-h-[480px]">
          <div className="space-y-3 border-b border-[var(--border)] p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-[var(--foreground)]">{t('attendance.loc.employees', 'Employees')}</h3>
              <span className="text-[12.5px] text-[var(--muted)] tabular-nums">{live.employees.length}</span>
            </div>
            <div className="relative">
              <MagnifyingGlassIcon size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--caption)]" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('attendance.loc.search_employee', 'Search employee')} className="pl-8" aria-label={t('attendance.loc.search_employee', 'Search employee')} />
            </div>
          </div>
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--muted)]">
              {live.employees.length === 0
                ? t('attendance.loc.map_no_employees', 'No employees are assigned to an active location yet.')
                : t('attendance.loc.nothing_found', 'Nothing found.')}
            </p>
          ) : (
            <ul ref={listRef} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
              {visible.map((employee) => (
                <EmployeeRow
                  key={employee.employee_id}
                  employee={employee}
                  state={employeeMarkerState(employee, live.now)}
                  locationName={employeeLocationName(employee, live.locations)}
                  now={live.now}
                  selected={employee.employee_id === selectedId}
                  onPick={() => pickFromList(employee)}
                  t={t}
                />
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  )
}

function ConnectionPill({ connection, t }: { connection: LiveConnection; t: Translate }) {
  const meta = connection === 'live'
    ? { label: t('attendance.loc.conn_live', 'Live'), dot: 'bg-[var(--success-text)]', text: 'text-[var(--success-text)]' }
    : connection === 'reconnecting'
      ? { label: t('attendance.loc.conn_reconnecting', 'Disconnected · reconnecting'), dot: 'bg-[var(--warning-text)]', text: 'text-[var(--warning-text)]' }
      : { label: t('attendance.loc.conn_connecting', 'Connecting…'), dot: 'bg-[var(--muted)]', text: 'text-[var(--muted-strong)]' }
  return (
    <span role="status" className={cn('inline-flex min-h-8 items-center gap-2 rounded-full bg-[var(--card)] px-3 text-[12.5px] font-semibold', meta.text)}>
      <span className={cn('h-2 w-2 rounded-full', meta.dot, connection === 'live' && 'badge-pulse')} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

type EmployeeRowProps = {
  employee: MapEmployee
  state: MarkerState
  locationName: string | null
  now: number
  selected: boolean
  onPick: () => void
  t: Translate
}

function EmployeeRow({ employee, state, locationName, now, selected, onPick, t }: EmployeeRowProps) {
  const lastSeen = state === 'no_data' || employee.last_seen_at === null || now === 0
    ? null
    : formatAgo(now - employee.last_seen_at, t)
  const checkIn = formatTime(employee.checked_in_at)
  const checkOut = formatTime(employee.checked_out_at)
  const details = [
    checkIn ? t('attendance.loc.checked_in_at', 'In {{time}}', { time: checkIn }) : null,
    checkOut && employee.state === 'checked_out' ? t('attendance.loc.checked_out_at', 'Out {{time}}', { time: checkOut }) : null,
  ].filter(Boolean).join(' · ')

  return (
    <li data-employee-id={employee.employee_id}>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={selected}
        title={details || undefined}
        className={cn(
          'flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2.5 text-left transition-colors',
          selected ? 'bg-[var(--row-selected)]' : 'hover:bg-[var(--input-surface)]',
        )}
      >
        <span data-i18n-skip="true" className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 bg-[var(--surface)] text-[11px] font-bold', markerStateBadgeClass[state])}>
          {initialsOf(employee.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-[var(--foreground)]">{employee.name}</span>
          <span className="mt-0.5 block truncate text-[12px] text-[var(--muted)]">
            {[locationName, state === 'no_data' ? t('attendance.loc.no_position', 'No position yet') : lastSeen ? t('attendance.loc.last_seen', 'seen {{ago}}', { ago: lastSeen }) : null]
              .filter(Boolean)
              .join(' · ') || '—'}
          </span>
        </span>
        <span className={cn('shrink-0 rounded-full px-2 py-1 text-[11px] leading-none font-semibold', markerStateChipClass[state])}>
          {markerStateLabel(state, t)}
        </span>
      </button>
    </li>
  )
}
