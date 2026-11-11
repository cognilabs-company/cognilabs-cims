import { useMemo, useState, type ReactNode } from 'react'
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../../app/hooks/useLocale'
import { attendanceService } from '../../../../shared/api/services/attendance.service'
import { attendanceLocationsService, type LocationEvent } from '../../../../shared/api/services/attendanceLocations.service'
import { useAsyncData } from '../../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../../shared/lib/api-error'
import { cn } from '../../../../shared/lib/cn'
import { Button } from '../../../../shared/ui/button'
import { CalendarField } from '../../../../shared/ui/calendar-field'
import { Label } from '../../../../shared/ui/label'
import { SelectField, type SelectFieldOption } from '../../../../shared/ui/select-field'
import { LoadingStateBlock, StateBlock } from '../../../../shared/ui/state-block'
import {
  eventToneClass,
  eventTypeMeta,
  formatDateTime,
  formatMeters,
  tashkentDayEnd,
  tashkentDayStart,
  toEmployeeOptions,
} from '../../lib/locations'

const PAGE_SIZE = 50

type Filters = { employeeId: string; locationId: string; dateFrom: string; dateTo: string }
const emptyFilters: Filters = { employeeId: '', locationId: '', dateFrom: '', dateTo: '' }

const headCellClass = 'bg-[var(--muted-surface)] px-3 py-2.5 text-left align-middle text-xs font-medium whitespace-nowrap text-[var(--muted)]'
const bodyCellClass = 'border-b border-[var(--border-subtle)] px-3 py-3 align-middle text-[13px]'

export function LocationHistoryTab() {
  const { t } = useLocale()
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)

  const usersQuery = useAsyncData(() => attendanceService.getUsers(), [])
  const locationsQuery = useAsyncData(() => attendanceLocationsService.listLocations(true), [])
  const eventsQuery = useAsyncData(
    () => attendanceLocationsService.listEvents({
      employee_id: filters.employeeId ? Number(filters.employeeId) : undefined,
      location_id: filters.locationId ? Number(filters.locationId) : undefined,
      date_from: tashkentDayStart(filters.dateFrom),
      date_to: tashkentDayEnd(filters.dateTo),
      page,
      page_size: PAGE_SIZE,
    }),
    [filters, page],
  )

  const employees = useMemo(() => toEmployeeOptions(usersQuery.data), [usersQuery.data])
  const employeeNames = useMemo(() => new Map(employees.map((employee) => [employee.id, employee.name])), [employees])
  const locationNames = useMemo(() => new Map((locationsQuery.data ?? []).map((location) => [location.id, location.name])), [locationsQuery.data])

  const employeeOptions = useMemo<SelectFieldOption[]>(() => [
    { value: '', label: t('attendance.loc.all_employees', 'All employees') },
    ...employees.map((employee) => ({ value: String(employee.id), label: employee.name, hint: employee.hint ?? undefined })),
  ], [employees, t])
  const locationOptions = useMemo<SelectFieldOption[]>(() => [
    { value: '', label: t('attendance.loc.all_locations', 'All locations') },
    ...(locationsQuery.data ?? []).map((location) => ({ value: String(location.id), label: location.name })),
  ], [locationsQuery.data, t])

  function changeFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  const hasFilters = Object.values(filters).some(Boolean)
  const data = eventsQuery.data
  const events = data?.items ?? []
  const totalPages = data?.total_pages ?? 1

  return (
    <section className="page-enter space-y-4">
      <div className="grid gap-4 rounded-[20px] bg-[var(--card)] p-4 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1.3fr)_minmax(180px,1fr)_170px_170px_auto]">
        <FilterField label={t('attendance.loc.filter_employee', 'Employee')}>
          <SelectField
            value={filters.employeeId}
            options={employeeOptions}
            onValueChange={(value) => changeFilter('employeeId', value)}
            searchable
            searchPlaceholder={t('attendance.loc.search_employee', 'Search employee')}
            disabled={usersQuery.isLoading}
            aria-label={t('attendance.loc.filter_employee', 'Employee')}
          />
        </FilterField>
        <FilterField label={t('attendance.loc.filter_location', 'Location')}>
          <SelectField
            value={filters.locationId}
            options={locationOptions}
            onValueChange={(value) => changeFilter('locationId', value)}
            disabled={locationsQuery.isLoading}
            aria-label={t('attendance.loc.filter_location', 'Location')}
          />
        </FilterField>
        <FilterField label={t('attendance.loc.filter_from', 'From')}>
          <CalendarField value={filters.dateFrom} max={filters.dateTo || undefined} onValueChange={(value) => changeFilter('dateFrom', value)} aria-label={t('attendance.loc.filter_from', 'From')} />
        </FilterField>
        <FilterField label={t('attendance.loc.filter_to', 'To')}>
          <CalendarField value={filters.dateTo} min={filters.dateFrom || undefined} onValueChange={(value) => changeFilter('dateTo', value)} aria-label={t('attendance.loc.filter_to', 'To')} />
        </FilterField>
        <div className="flex items-end">
          <Button
            variant="ghost"
            size="md"
            leftIcon={<ArrowCounterClockwiseIcon size={15} weight="bold" />}
            disabled={!hasFilters}
            onClick={() => {
              setFilters(emptyFilters)
              setPage(1)
            }}
          >
            {t('attendance.loc.reset_filters', 'Reset')}
          </Button>
        </div>
      </div>

      {eventsQuery.isLoading || eventsQuery.isIdle ? (
        <LoadingStateBlock eyebrow={t('attendance.loc.tab_history', 'Location history')} title={t('attendance.loc.history_loading', 'Loading events')} />
      ) : eventsQuery.isError ? (
        <StateBlock
          tone="error"
          eyebrow={t('attendance.loc.tab_history', 'Location history')}
          title={t('attendance.loc.history_error', 'Could not load events')}
          description={getApiErrorMessage(eventsQuery.error)}
          actionLabel={t('attendance.loc.retry', 'Retry')}
          onAction={() => void eventsQuery.refetch().catch(() => undefined)}
        />
      ) : events.length === 0 ? (
        <StateBlock
          eyebrow={t('attendance.loc.tab_history', 'Location history')}
          title={t('attendance.loc.history_empty', 'No events found')}
          description={hasFilters ? t('attendance.loc.history_empty_filtered', 'Try other filters or a wider date range.') : t('attendance.loc.history_empty_all', 'Check-ins and check-outs will appear here.')}
        />
      ) : (
        <div className="space-y-4 rounded-[20px] bg-[var(--card)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-semibold text-[var(--foreground)]">
              {data?.total !== null && data?.total !== undefined
                ? t('attendance.loc.events_count', '{{count}} events', { count: data.total })
                : t('attendance.loc.events', 'Events')}
            </p>
            <p className="text-[12px] text-[var(--muted)]">{t('attendance.loc.tashkent_time', 'Times are shown in Asia/Tashkent.')}</p>
          </div>
          <div className="custom-scrollbar-visible overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  <th className={cn(headCellClass, 'rounded-l-[12px] pl-3.5')}>{t('attendance.loc.col_time', 'Time')}</th>
                  <th className={headCellClass}>{t('attendance.loc.col_employee', 'Employee')}</th>
                  <th className={headCellClass}>{t('attendance.loc.col_event', 'Event')}</th>
                  <th className={headCellClass}>{t('attendance.loc.col_location', 'Location')}</th>
                  <th className={cn(headCellClass, 'text-right')}>{t('attendance.loc.col_distance', 'Distance')}</th>
                  <th className={cn(headCellClass, 'rounded-r-[12px] pr-3.5 text-right')}>{t('attendance.loc.col_accuracy', 'Accuracy')}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <EventRow
                    key={event.key}
                    event={event}
                    employeeName={event.employee_name ?? (event.employee_id !== null ? employeeNames.get(event.employee_id) : undefined) ?? (event.employee_id !== null ? `#${event.employee_id}` : '—')}
                    locationName={event.location_name ?? (event.location_id !== null ? locationNames.get(event.location_id) : undefined) ?? '—'}
                    eventMeta={eventTypeMeta(event.event_type, t)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-[var(--muted)]">
              {data?.total !== null && data?.total !== undefined
                ? t('attendance.loc.page_of', 'Page {{page}} of {{pages}}', { page, pages: totalPages })
                : t('attendance.loc.page', 'Page {{page}}', { page })}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                {t('attendance.loc.previous', 'Previous')}
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
                {t('attendance.loc.next', 'Next')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function EventRow({ event, employeeName, locationName, eventMeta }: { event: LocationEvent; employeeName: string; locationName: string; eventMeta: ReturnType<typeof eventTypeMeta> }) {
  return (
    <tr className="transition-colors hover:bg-[var(--card-hover)]">
      <td className={cn(bodyCellClass, 'pl-3.5 whitespace-nowrap text-[var(--muted-strong)] tabular-nums')}>{formatDateTime(event.occurred_at)}</td>
      <td className={cn(bodyCellClass, 'font-semibold text-[var(--foreground)]')}>{employeeName}</td>
      <td className={bodyCellClass}>
        <span className={cn('inline-flex rounded-full px-2 py-1 text-[11.5px] leading-none font-semibold whitespace-nowrap', eventToneClass[eventMeta.tone])}>{eventMeta.label}</span>
        {event.note ? <p className="mt-1 max-w-[260px] text-[12px] text-[var(--muted)]">{event.note}</p> : null}
      </td>
      <td className={cn(bodyCellClass, 'text-[var(--muted-strong)]')}>{locationName}</td>
      <td className={cn(bodyCellClass, 'text-right text-[var(--muted-strong)] tabular-nums')}>{formatMeters(event.distance_meters)}</td>
      <td className={cn(bodyCellClass, 'pr-3.5 text-right text-[var(--muted-strong)] tabular-nums')}>
        {event.accuracy_meters !== null ? `±${formatMeters(event.accuracy_meters)}` : '—'}
      </td>
    </tr>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
