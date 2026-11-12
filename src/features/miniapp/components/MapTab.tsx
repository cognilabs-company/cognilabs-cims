import { useMemo, useRef, useState } from 'react'
import { ArrowClockwiseIcon, MagnifyingGlassIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { MapEmployee } from '../../../shared/api/services/attendanceLocations.service'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { LiveLocationMap, type MapFocusRequest } from '../../attendance/components/locations/LiveLocationMap'
import {
  employeeLocationName,
  employeeMarkerState,
  formatAgo,
  hasPosition,
  initialsOf,
  MARKER_STATES,
  markerStateBadgeClass,
  markerStateLabel,
  markerStateLegendLabel,
  sortEmployeesForList,
  type MarkerState,
} from '../../attendance/lib/locations'
import { useLiveLocationMap } from '../../attendance/lib/useLiveLocationMap'
import { haptic } from '../lib/telegram'

type Props = {
  /** The tab is on screen. */
  active: boolean
  withTabBar: boolean
}

/**
 * Live employee map in the Mini App (capabilities.live_location.view). REST snapshot + realtime socket with the
 * Mini App token; four clear states: live checked-in, stale checked-in, checked-out, never reported.
 */
export function MapTab({ active, withTabBar }: Props) {
  const { t } = useLocale()
  const live = useLiveLocationMap()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [focus, setFocus] = useState<MapFocusRequest | null>(null)
  const [filter, setFilter] = useState<MarkerState | 'all'>('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)

  const counts = useMemo(() => {
    const result: Record<MarkerState, number> = { live: 0, stale: 0, checked_out: 0, no_data: 0 }
    for (const employee of live.employees) result[employeeMarkerState(employee, live.now)] += 1
    return result
  }, [live.employees, live.now])

  const sorted = useMemo(() => sortEmployeesForList(live.employees, live.now), [live.employees, live.now])
  const needle = search.trim().toLowerCase()
  const visible = sorted.filter((employee) =>
    (filter === 'all' || employeeMarkerState(employee, live.now) === filter) && (!needle || employee.name.toLowerCase().includes(needle)))

  function pick(employee: MapEmployee) {
    haptic('select')
    setSelectedId(employee.employee_id)
    if (!hasPosition(employee)) return
    setFocus((current) => ({ employeeId: employee.employee_id, nonce: (current?.nonce ?? 0) + 1 }))
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function refresh() {
    haptic('select')
    setRefreshing(true)
    await live.reload()
    setRefreshing(false)
  }

  if (live.status === 'loading') {
    return (
      <div className="space-y-3 px-4 pt-1">
        <span className="skeleton block h-9 rounded-full" />
        <span className="skeleton block h-[46dvh] rounded-[22px]" />
        <span className="skeleton block h-16 rounded-[18px]" />
      </div>
    )
  }

  if (live.status === 'error') {
    return (
      <div className="mini-in mx-4 mt-6 rounded-[22px] bg-[var(--surface)] p-6 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--danger-dim)] text-[var(--danger-text)]"><WarningCircleIcon size={30} weight="duotone" /></span>
        <p className="mt-3 text-[17px] font-bold text-[var(--foreground)]">{t('attendance.loc.map_error', 'Could not load the live map')}</p>
        <p className="mt-1 text-[13.5px] text-[var(--muted-strong)]">{getApiErrorMessage(live.error)}</p>
        <button type="button" onClick={() => void refresh()} className="mini-key mt-4 h-11 rounded-[14px] bg-[var(--primary)] px-5 text-[15px] font-semibold text-white">
          {t('miniapp.retry', 'Try again')}
        </button>
      </div>
    )
  }

  const connectionLabel = live.connection === 'live'
    ? t('attendance.loc.conn_live', 'Live')
    : live.connection === 'reconnecting'
      ? t('attendance.loc.conn_reconnecting', 'Disconnected · reconnecting')
      : t('attendance.loc.conn_connecting', 'Connecting…')

  return (
    <div className={cn('flex min-h-full flex-col gap-3 px-4 pt-1', withTabBar ? 'pb-28' : 'pb-24', !active && 'pointer-events-none')}>
      {/* Connection + refresh */}
      <div className="flex items-center justify-between gap-2">
        <span role="status" className={cn('inline-flex h-8 items-center gap-2 rounded-full bg-[var(--surface)] px-3 text-[12.5px] font-semibold', live.connection === 'live' ? 'text-[var(--success-text)]' : live.connection === 'reconnecting' ? 'text-[var(--warning-text)]' : 'text-[var(--muted-strong)]')}>
          <span className={cn('h-2 w-2 rounded-full', live.connection === 'live' ? 'mini-pulse bg-[var(--success-text)]' : live.connection === 'reconnecting' ? 'bg-[var(--warning-text)]' : 'bg-[var(--muted)]')} />
          {connectionLabel}
        </span>
        <button type="button" onClick={() => void refresh()} aria-label={t('attendance.loc.refresh', 'Refresh')} className="mini-key grid h-9 w-9 place-items-center rounded-full bg-[var(--surface)] text-[var(--muted-strong)]">
          <ArrowClockwiseIcon size={17} className={cn(refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* State filter — the four states with counts */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
        {(['all', ...MARKER_STATES] as const).map((state) => {
          const on = filter === state
          return (
            <button
              key={state}
              type="button"
              onClick={() => { haptic('select'); setFilter(state) }}
              aria-pressed={on}
              className={cn('mini-key inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold', on ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface)] text-[var(--muted-strong)]')}
            >
              {state === 'all' ? null : <span className={cn('h-3 w-3 shrink-0 rounded-full border-2 bg-[var(--surface)]', markerStateBadgeClass[state])} />}
              {state === 'all' ? t('miniapp.map.all', 'All') : markerStateLegendLabel(state, t)}
              <span className={cn('tabular-nums', on ? 'text-white/80' : 'text-[var(--muted)]')}>{state === 'all' ? live.employees.length : counts[state]}</span>
            </button>
          )
        })}
      </div>

      {live.error ? (
        <p className="rounded-[14px] bg-[var(--danger-dim)] px-3.5 py-2.5 text-[12.5px] text-[var(--danger-text)]">
          {t('attendance.loc.map_refresh_failed', 'Could not refresh the map: {{message}}', { message: getApiErrorMessage(live.error) })}
        </p>
      ) : null}

      <div ref={mapRef} className="h-[46dvh] min-h-[280px] scroll-mt-20 overflow-hidden rounded-[22px] bg-[var(--surface)]">
        <LiveLocationMap
          locations={live.locations}
          employees={filter === 'all' ? live.employees : live.employees.filter((employee) => employeeMarkerState(employee, live.now) === filter)}
          now={live.now}
          selectedId={selectedId}
          focus={focus}
          onSelect={(id) => { haptic('select'); setSelectedId(id) }}
        />
      </div>

      {/* Employees */}
      <label className="relative flex h-11 items-center">
        <MagnifyingGlassIcon size={17} className="pointer-events-none absolute left-3.5 text-[var(--muted)]" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('attendance.loc.search_employee', 'Search employee')}
          className="h-11 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] pr-3 pl-10 text-[15px] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none"
        />
      </label>
      {visible.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-[var(--muted)]">
          {live.employees.length === 0 ? t('attendance.loc.map_no_employees', 'No employees are assigned to an active location yet.') : t('attendance.loc.nothing_found', 'Nothing found.')}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((employee) => {
            const state = employeeMarkerState(employee, live.now)
            const place = employeeLocationName(employee, live.locations)
            const seen = state === 'no_data'
              ? t('attendance.loc.no_position', 'No position yet')
              : employee.last_seen_at !== null && live.now ? t('attendance.loc.last_seen', 'seen {{ago}}', { ago: formatAgo(live.now - employee.last_seen_at, t) }) : null
            return (
              <li key={employee.employee_id}>
                <button
                  type="button"
                  onClick={() => pick(employee)}
                  className={cn('mini-key flex w-full items-center gap-3 rounded-[18px] bg-[var(--surface)] p-3 text-left', employee.employee_id === selectedId && 'ring-2 ring-[var(--primary)]')}
                >
                  <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full border-[3px] bg-[var(--muted-surface)] text-[14px] font-bold text-[var(--foreground)]', markerStateBadgeClass[state])} data-i18n-skip="true">
                    {initialsOf(employee.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-[var(--foreground)]" data-i18n-skip="true">{employee.name}</span>
                    <span className="block truncate text-[12.5px] text-[var(--muted)]">
                      {[markerStateLabel(state, t), place, seen].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-center text-[11.5px] text-[var(--muted)]">{t('miniapp.map.note', 'Positions come only from employees whose Mini App is open.')}</p>
    </div>
  )
}
