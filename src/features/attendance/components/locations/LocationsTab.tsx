import { useState } from 'react'
import { CircleDashedIcon, MapPinIcon, PencilSimpleIcon, PlusIcon, TrashIcon, UsersThreeIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../../app/hooks/useLocale'
import { attendanceLocationsService, type AttendanceLocation } from '../../../../shared/api/services/attendanceLocations.service'
import { useConfirm } from '../../../../shared/confirm/useConfirm'
import { useAsyncData } from '../../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../../shared/lib/api-error'
import { cn } from '../../../../shared/lib/cn'
import { useToast } from '../../../../shared/toast/useToast'
import { Badge } from '../../../../shared/ui/badge'
import { Button } from '../../../../shared/ui/button'
import { IconButton } from '../../../../shared/ui/icon-button'
import { Switch } from '../../../../shared/ui/switch'
import { LoadingStateBlock, StateBlock } from '../../../../shared/ui/state-block'
import { useAuth } from '../../../auth/hooks/useAuth'
import { formatCoordinates, formatMeters, loadLocationsWithAssignments, type Translate } from '../../lib/locations'
import { LocationEmployeesDialog } from './LocationEmployeesDialog'
import { LocationFormDialog } from './LocationFormDialog'

type FormState = { location: AttendanceLocation | null; key: number }

export function LocationsTab() {
  const { t } = useLocale()
  const { can } = useAuth()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const canCreate = can('attendance', 'create')
  const canEdit = can('attendance', 'edit')
  const canDelete = can('attendance', 'delete')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [assigning, setAssigning] = useState<AttendanceLocation | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const query = useAsyncData(() => loadLocationsWithAssignments(includeInactive), [includeInactive])
  const locations = query.data ?? []

  function reload() {
    void query.refetch().catch(() => undefined)
  }

  function openForm(location: AttendanceLocation | null) {
    setForm((current) => ({ location, key: (current?.key ?? 0) + 1 }))
  }

  async function remove(location: AttendanceLocation) {
    const confirmed = await confirm({
      title: t('attendance.loc.delete_title', 'Delete location?'),
      description: t('attendance.loc.delete_description', 'Employees will no longer be able to check in at "{{name}}".', { name: location.name }),
      confirmLabel: t('attendance.loc.delete', 'Delete'),
      cancelLabel: t('attendance.loc.cancel', 'Cancel'),
      tone: 'danger',
    })
    if (!confirmed) return
    setDeletingId(location.id)
    try {
      await attendanceLocationsService.deleteLocation(location.id)
      showToast({ title: t('attendance.loc.toast_deleted', 'Location deleted'), tone: 'success' })
      reload()
    } catch (error) {
      showToast({ title: t('attendance.loc.toast_delete_failed', 'Could not delete the location'), description: getApiErrorMessage(error), tone: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="page-enter space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-[var(--card)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-[14px] font-semibold text-[var(--foreground)]">
            {query.isSuccess ? t('attendance.loc.count', '{{count}} locations', { count: locations.length }) : t('attendance.loc.tab_locations', 'Locations')}
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-[var(--muted-strong)]">
            <Switch size="sm" checked={includeInactive} onChange={setIncludeInactive} label={t('attendance.loc.show_inactive', 'Show inactive')} />
            <span>{t('attendance.loc.show_inactive', 'Show inactive')}</span>
          </label>
        </div>
        {canCreate ? (
          <Button size="sm" leftIcon={<PlusIcon size={15} weight="bold" />} onClick={() => openForm(null)}>
            {t('attendance.loc.add', 'Add location')}
          </Button>
        ) : null}
      </div>

      {query.isLoading || query.isIdle ? (
        <LoadingStateBlock eyebrow={t('attendance.loc.tab_locations', 'Locations')} title={t('attendance.loc.loading', 'Loading locations')} />
      ) : query.isError ? (
        <StateBlock
          tone="error"
          eyebrow={t('attendance.loc.tab_locations', 'Locations')}
          title={t('attendance.loc.load_error', 'Could not load locations')}
          description={getApiErrorMessage(query.error)}
          actionLabel={t('attendance.loc.retry', 'Retry')}
          onAction={reload}
        />
      ) : locations.length === 0 ? (
        <StateBlock
          eyebrow={t('attendance.loc.tab_locations', 'Locations')}
          title={t('attendance.loc.empty_title', 'No locations yet')}
          description={t('attendance.loc.empty_description', 'Add the office or any other place where employees check in.')}
          actionLabel={canCreate ? t('attendance.loc.add', 'Add location') : undefined}
          onAction={canCreate ? () => openForm(null) : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {locations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              t={t}
              deleting={deletingId === location.id}
              onEdit={canEdit ? () => openForm(location) : undefined}
              onAssign={canEdit ? () => setAssigning(location) : undefined}
              onDelete={canDelete ? () => void remove(location) : undefined}
            />
          ))}
        </div>
      )}

      {form ? (
        <LocationFormDialog
          key={form.key}
          location={form.location}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            reload()
          }}
        />
      ) : null}

      {assigning ? (
        <LocationEmployeesDialog
          key={assigning.id}
          location={assigning}
          onClose={() => setAssigning(null)}
          onSaved={() => {
            setAssigning(null)
            reload()
          }}
        />
      ) : null}
    </section>
  )
}

type LocationCardProps = {
  location: AttendanceLocation
  t: Translate
  deleting: boolean
  onEdit?: () => void
  onAssign?: () => void
  onDelete?: () => void
}

function LocationCard({ location, t, deleting, onEdit, onAssign, onDelete }: LocationCardProps) {
  const count = location.employees_count ?? location.employee_ids?.length ?? null
  const hasActions = Boolean(onEdit || onAssign || onDelete)

  return (
    <article className={cn('flex flex-col gap-4 rounded-[20px] bg-[var(--card)] p-[18px]', !location.is_active && 'opacity-80')}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--muted-surface)] text-[var(--muted-strong)]">
          {location.is_active ? <MapPinIcon size={20} weight="duotone" /> : <CircleDashedIcon size={20} weight="duotone" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-[var(--foreground)]" title={location.name}>{location.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-[12.5px] text-[var(--muted)]">{location.address || t('attendance.loc.no_address', 'No address')}</p>
        </div>
        <Badge variant={location.is_active ? 'success' : 'secondary'} size="sm" dot>
          {location.is_active ? t('attendance.loc.active', 'Active') : t('attendance.loc.inactive', 'Inactive')}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-[14px] bg-[var(--muted-surface)] px-3.5 py-3">
        <div className="min-w-0">
          <dt className="text-[11.5px] text-[var(--muted)]">{t('attendance.loc.radius', 'Radius')}</dt>
          <dd className="mt-1 text-[14px] font-semibold text-[var(--foreground)] tabular-nums">{formatMeters(location.radius_meters)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11.5px] text-[var(--muted)]">{t('attendance.loc.employees', 'Employees')}</dt>
          <dd className="mt-1 text-[14px] font-semibold text-[var(--foreground)] tabular-nums">{count ?? '—'}</dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-[11.5px] text-[var(--muted)]">{t('attendance.loc.coordinates', 'Coordinates')}</dt>
          <dd className="mt-1 truncate font-mono text-[12.5px] text-[var(--muted-strong)]">{formatCoordinates(location.latitude, location.longitude)}</dd>
        </div>
      </dl>

      {hasActions ? (
        <div className="mt-auto flex items-center gap-1.5">
          {onAssign ? (
            <Button variant="secondary" size="sm" leftIcon={<UsersThreeIcon size={15} weight="duotone" />} onClick={onAssign}>
              {t('attendance.loc.employees', 'Employees')}
            </Button>
          ) : null}
          <span className="flex-1" />
          {onEdit ? (
            <IconButton size="sm" label={t('attendance.loc.edit', 'Edit')} onClick={onEdit}>
              <PencilSimpleIcon size={16} weight="duotone" />
            </IconButton>
          ) : null}
          {onDelete ? (
            <IconButton size="sm" tone="danger" label={t('attendance.loc.delete', 'Delete')} onClick={onDelete} disabled={deleting}>
              <TrashIcon size={16} weight="duotone" />
            </IconButton>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
