import { useMemo, useState } from 'react'
import { MagnifyingGlassIcon, UsersThreeIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../../app/hooks/useLocale'
import { attendanceService } from '../../../../shared/api/services/attendance.service'
import { attendanceLocationsService, type AttendanceLocation } from '../../../../shared/api/services/attendanceLocations.service'
import { useAsyncData } from '../../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../../shared/lib/api-error'
import { useToast } from '../../../../shared/toast/useToast'
import { Alert } from '../../../../shared/ui/alert'
import { Button } from '../../../../shared/ui/button'
import { Checkbox } from '../../../../shared/ui/checkbox'
import { Dialog } from '../../../../shared/ui/dialog'
import { Input } from '../../../../shared/ui/input'
import { LoadingStateBlock, StateBlock } from '../../../../shared/ui/state-block'
import { loadAssignedEmployeeIds, toEmployeeOptions } from '../../lib/locations'

type LocationEmployeesDialogProps = {
  location: AttendanceLocation
  onClose: () => void
  onSaved: () => void
}

/** Who may check in at a location. Saving replaces every assignment (PUT). */
export function LocationEmployeesDialog({ location, onClose, onSaved }: LocationEmployeesDialogProps) {
  const { t } = useLocale()
  const { showToast } = useToast()
  const usersQuery = useAsyncData(() => attendanceService.getUsers(), [])
  const assignedQuery = useAsyncData(() => loadAssignedEmployeeIds(location), [location.id])
  const [picked, setPicked] = useState<Set<number> | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const baseline = useMemo(() => new Set(assignedQuery.data ?? []), [assignedQuery.data])
  const selected = picked ?? baseline

  const people = useMemo(() => {
    const rows = toEmployeeOptions(usersQuery.data)
    const known = new Set(rows.map((row) => row.id))
    // Assigned people the user list does not return (e.g. deactivated) stay visible and stay assigned.
    for (const id of baseline) {
      if (known.has(id)) continue
      const name = location.employees.find((employee) => employee.id === id)?.name
      rows.push({ id, name: name || `#${id}`, hint: null })
    }
    return rows
  }, [usersQuery.data, baseline, location.employees])

  const needle = search.trim().toLowerCase()
  const visible = needle
    ? people.filter((person) => person.name.toLowerCase().includes(needle) || (person.hint ?? '').toLowerCase().includes(needle))
    : people

  function toggle(id: number) {
    setPicked((current) => {
      const next = new Set(current ?? baseline)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectVisible(on: boolean) {
    setPicked((current) => {
      const next = new Set(current ?? baseline)
      for (const person of visible) {
        if (on) next.add(person.id)
        else next.delete(person.id)
      }
      return next
    })
  }

  function close() {
    if (!saving) onClose()
  }

  async function save() {
    setSaving(true)
    try {
      await attendanceLocationsService.replaceEmployees(location.id, [...selected].sort((a, b) => a - b))
      showToast({ title: t('attendance.loc.toast_assigned', 'Employees saved for {{name}}', { name: location.name }), tone: 'success' })
      setSaving(false)
      onSaved()
    } catch (error) {
      setSaving(false)
      showToast({ title: t('attendance.loc.toast_assign_failed', 'Could not save employees'), description: getApiErrorMessage(error), tone: 'error' })
    }
  }

  const loading = usersQuery.isLoading || usersQuery.isIdle || assignedQuery.isLoading || assignedQuery.isIdle
  const allVisibleSelected = visible.length > 0 && visible.every((person) => selected.has(person.id))

  return (
    <Dialog
      open
      onClose={close}
      size="lg"
      headerIcon={<UsersThreeIcon weight="duotone" />}
      title={t('attendance.loc.employees_title', 'Employees · {{name}}', { name: location.name })}
      description={t('attendance.loc.employees_description', 'Only selected employees can check in at this location.')}
      footer={(
        <>
          <span className="mr-auto text-[12.5px] text-[var(--muted)] tabular-nums">
            {t('attendance.loc.selected_count', '{{count}} selected', { count: selected.size })}
          </span>
          <Button variant="ghost" onClick={close} disabled={saving}>{t('attendance.loc.cancel', 'Cancel')}</Button>
          <Button onClick={() => void save()} loading={saving} disabled={loading || usersQuery.isError}>{t('attendance.loc.save', 'Save')}</Button>
        </>
      )}
    >
      {loading ? (
        <LoadingStateBlock eyebrow={location.name} title={t('attendance.loc.employees_loading', 'Loading employees')} />
      ) : usersQuery.isError ? (
        <StateBlock
          tone="error"
          eyebrow={location.name}
          title={t('attendance.loc.employees_error', 'Could not load employees')}
          description={getApiErrorMessage(usersQuery.error)}
          actionLabel={t('attendance.loc.retry', 'Retry')}
          onAction={() => void usersQuery.refetch().catch(() => undefined)}
        />
      ) : (
        <div className="space-y-3">
          {assignedQuery.isError || assignedQuery.data === null ? (
            <Alert tone="warning" icon={<WarningCircleIcon size={18} weight="duotone" />}>
              {t('attendance.loc.assignments_unknown', 'Current assignments could not be loaded. Saving replaces them with the selection below.')}
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <MagnifyingGlassIcon size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--caption)]" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('attendance.loc.search_employee', 'Search employee')} className="pl-8" aria-label={t('attendance.loc.search_employee', 'Search employee')} />
            </div>
            <Button variant="secondary" size="sm" onClick={() => selectVisible(!allVisibleSelected)} disabled={visible.length === 0}>
              {allVisibleSelected ? t('attendance.loc.clear_shown', 'Clear shown') : t('attendance.loc.select_shown', 'Select shown')}
            </Button>
          </div>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[var(--muted)]">{t('attendance.loc.nothing_found', 'Nothing found.')}</p>
          ) : (
            <ul className="max-h-[min(46vh,420px)] divide-y divide-[var(--border-subtle)] overflow-y-auto rounded-[14px] ring-1 ring-[var(--border)]">
              {visible.map((person) => (
                <li key={person.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--card-hover)]">
                    <Checkbox size="sm" checked={selected.has(person.id)} onChange={() => toggle(person.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-[var(--foreground)]">{person.name}</span>
                      {person.hint ? <span className="block truncate text-[12px] text-[var(--muted)]">{person.hint}</span> : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Dialog>
  )
}
