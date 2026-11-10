import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { HardDrive, RefreshCw, Search, Server, X } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { ceoService, type CeoUserRecord } from '../../../shared/api/services/ceo.service'
import { telephonyService, type RecordingStorage, type TelephonyExtension } from '../../../shared/api/services/telephony.service'
import { MacAvatar, ToolbarButton } from './MacPrimitives'
import { SelectField } from '../../../shared/ui/select-field'

type ExtensionFilter = 'all' | 'active' | 'inactive'

function formatBytes(value: number) {
  if (!Number.isFinite(value)) return '-'
  const unit = value >= 1024 ** 3 ? 'GB' : 'MB'
  return `${(value / (unit === 'GB' ? 1024 ** 3 : 1024 ** 2)).toFixed(1)} ${unit}`
}

/** Rounded grouped list, like a section in macOS System Settings. */
function Group({ title, icon, action, className, children }: { title: string; icon?: ReactNode; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn('min-w-0', className)}>
      <div className="mb-2 flex min-h-8 flex-wrap items-center justify-between gap-2 px-1">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--mp-secondary)]">{icon}{title}</h3>
        {action}
      </div>
      <div className="overflow-hidden rounded-[12px] bg-[var(--mp-group)] ring-1 ring-inset ring-[var(--mp-separator)]">{children}</div>
    </section>
  )
}

/** macOS on/off switch. */
function MacSwitch({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors disabled:cursor-wait disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-blue)]/60',
        checked ? 'bg-[var(--mp-green)]' : 'bg-[var(--mp-control-hover)]',
      )}
    >
      <span className={cn('absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform', checked && 'translate-x-4')} />
    </button>
  )
}

export function CeoTelephonyPanel() {
  const { t } = useLocale()
  const [storage, setStorage] = useState<RecordingStorage | null>(null)
  const [serviceStatus, setServiceStatus] = useState<Record<string, unknown> | null>(null)
  const [extensions, setExtensions] = useState<TelephonyExtension[]>([])
  const [users, setUsers] = useState<CeoUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ExtensionFilter>('all')
  const [newUserId, setNewUserId] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    void Promise.allSettled([telephonyService.storage(), telephonyService.status(), telephonyService.extensions(), ceoService.getDashboard()])
      .then(([storageResult, statusResult, extensionsResult, usersResult]) => {
        if (!active) return
        if (storageResult.status === 'fulfilled') setStorage(storageResult.value)
        if (statusResult.status === 'fulfilled') setServiceStatus(statusResult.value)
        if (extensionsResult.status === 'fulfilled') setExtensions(Array.isArray(extensionsResult.value) ? extensionsResult.value : extensionsResult.value.items)
        if (usersResult.status === 'fulfilled') setUsers(usersResult.value.users)
        const failure = [storageResult, statusResult, extensionsResult, usersResult].find((result) => result.status === 'rejected')
        setError(failure?.status === 'rejected' ? getApiErrorMessage(failure.reason) : null)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [version])

  const visible = useMemo(() => extensions.filter((item) => {
    if (filter === 'active' && !item.is_active) return false
    if (filter === 'inactive' && item.is_active) return false
    const text = `${item.user_name ?? ''} ${item.user_id} ${item.extension ?? ''}`.toLowerCase()
    return text.includes(query.trim().toLowerCase())
  }), [extensions, filter, query])
  const availableUsers = useMemo(() => users.filter((item) =>
    ['seller', 'ceo'].includes(String(item.role).toLowerCase()) && !extensions.some((extension) => extension.user_id === item.id),
  ), [users, extensions])

  function refresh() {
    setLoading(true)
    setVersion((value) => value + 1)
  }

  async function createExtension() {
    const userId = Number(newUserId)
    if (!Number.isInteger(userId) || userId <= 0) return
    setBusyId(userId)
    try { await telephonyService.createExtension(userId); setNewUserId(''); refresh() }
    catch (cause) { setError(getApiErrorMessage(cause)) }
    finally { setBusyId(null) }
  }

  async function toggleExtension(item: TelephonyExtension) {
    setBusyId(item.user_id)
    try { await telephonyService.updateExtension(item.user_id, !item.is_active); refresh() }
    catch (cause) { setError(getApiErrorMessage(cause)) }
    finally { setBusyId(null) }
  }

  const percent = storage?.used_percent ?? 0
  const level = percent >= 90 ? 'critical' : percent >= 80 ? 'warning' : 'healthy'
  const levelText = level === 'critical'
    ? t('telephony.system.critical', 'Critical')
    : level === 'warning'
      ? t('telephony.system.warning', 'Warning')
      : t('telephony.system.healthy', 'Healthy')
  const levelColor = level === 'critical' ? 'var(--mp-red)' : level === 'warning' ? 'var(--mp-orange)' : 'var(--mp-green)'
  const statusFields = serviceStatus ? Object.entries(serviceStatus).filter(([, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') : []
  const filters: Array<{ value: ExtensionFilter; label: string }> = [
    { value: 'all', label: t('telephony.system.filter.all', 'All') },
    { value: 'active', label: t('telephony.system.filter.active', 'Active') },
    { value: 'inactive', label: t('telephony.system.filter.inactive', 'Inactive') },
  ]
  const canCreate = Number.isInteger(Number(newUserId)) && Number(newUserId) > 0 && busyId === null

  return (
    <section className="mx-auto w-full max-w-[1120px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[var(--mp-text)]">{t('telephony.system.title', 'Phone system')}</h2>
          <p className="mt-0.5 text-[13px] text-[var(--mp-secondary)]">{t('telephony.system.description', 'Recording storage, service health and seller extensions.')}</p>
        </div>
        <ToolbarButton onClick={refresh} disabled={loading} title={t('telephony.system.refresh', 'Refresh')}>
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          {t('telephony.system.refresh', 'Refresh')}
        </ToolbarButton>
      </div>

      {error ? <p role="alert" className="mb-4 rounded-[10px] bg-[var(--mp-group)] px-3.5 py-2.5 text-[13px] text-[var(--mp-red)]">{error}</p> : null}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Storage — one number that matters: how full the disk is. */}
        <Group title={t('telephony.system.storage', 'Recording storage')} icon={<HardDrive size={14} />}>
          <div className="p-4">
            {storage ? (
              <>
                <div className="flex items-end justify-between gap-3">
                  <p className="text-[30px] leading-none font-bold tracking-[-0.03em] tabular-nums text-[var(--mp-text)]" data-ui-number="true">
                    {percent.toFixed(1)}%
                  </p>
                  <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-white" style={{ background: levelColor }}>{levelText}</span>
                </div>
                <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-[var(--mp-control)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-label={t('telephony.system.storage', 'Recording storage')}>
                  <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.min(100, percent)}%`, background: levelColor }} />
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[12.5px] text-[var(--mp-secondary)]">
                  <span className="tabular-nums">{t('telephony.system.storage_detail', '{{used}} of {{total}}', { used: formatBytes(storage.used_bytes), total: formatBytes(storage.total_bytes) })}</span>
                  <span className="tabular-nums">{t('telephony.system.recordings', '{{count}} recordings', { count: storage.recording_count })}</span>
                </div>
              </>
            ) : (
              <p className="text-[13px] text-[var(--mp-secondary)]">
                {loading ? t('telephony.system.loading', 'Loading…') : t('telephony.system.storage_unavailable', 'Storage data unavailable.')}
              </p>
            )}
          </div>
        </Group>

        {/* Service status — key/value rows */}
        <Group title={t('telephony.system.service', 'Service status')} icon={<Server size={14} />}>
          {statusFields.length ? (
            <dl>
              {statusFields.map(([key, value], index) => (
                <div key={key} className={cn('flex items-center justify-between gap-4 px-4 py-2.5 text-[13px]', index > 0 && 'border-t border-[var(--mp-separator)]')}>
                  <dt className="capitalize text-[var(--mp-text)]">{key.replaceAll('_', ' ')}</dt>
                  <dd className={cn(
                    'truncate font-medium',
                    value === true ? 'text-[var(--mp-green)]' : value === false ? 'text-[var(--mp-red)]' : 'text-[var(--mp-secondary)]',
                  )} data-i18n-skip="true">
                    {String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="px-4 py-4 text-[13px] text-[var(--mp-secondary)]">
              {loading ? t('telephony.system.loading', 'Loading…') : t('telephony.system.no_status', 'No status data available.')}
            </p>
          )}
        </Group>

        {/* Extensions */}
        <Group
          className="md:col-span-2"
          title={t('telephony.system.extensions', 'Extensions')}
          action={(
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label={t('telephony.system.extensions', 'Extensions')} className="inline-flex h-7 rounded-[8px] bg-[var(--mp-control)] p-[2px]">
                {filters.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={filter === item.value}
                    onClick={() => setFilter(item.value)}
                    className={cn(
                      'rounded-[6px] px-3 text-[12px] font-medium text-[var(--mp-text)] transition',
                      filter === item.value && 'bg-[var(--mp-segment)] shadow-[0_1px_2px_rgba(0,0,0,0.18)]',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="relative w-[200px]">
                <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--mp-secondary)]" />
                <input
                  type="search"
                  aria-label={t('telephony.system.search_extensions', 'Name or extension')}
                  placeholder={t('telephony.system.search_extensions', 'Name or extension')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-7 w-full rounded-full bg-[var(--mp-control)] pr-7 pl-7 text-[12.5px] text-[var(--mp-text)] placeholder:text-[var(--mp-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-blue)]/60 [&::-webkit-search-cancel-button]:hidden"
                />
                {query ? (
                  <button type="button" aria-label={t('telephony.clear_search', 'Clear search')} onClick={() => setQuery('')} className="absolute top-1/2 right-2 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full bg-[var(--mp-secondary)] text-[var(--mp-window)]">
                    <X size={10} strokeWidth={3} />
                  </button>
                ) : null}
              </div>
            </div>
          )}
        >
          {/* New extension row */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <div className="min-w-[220px] flex-1 sm:max-w-[320px]">
              <SelectField
                id="new-extension-user"
                size="sm"
                value={newUserId}
                onValueChange={setNewUserId}
                placeholder={t('telephony.system.select_user', 'Select user')}
                aria-label={t('telephony.system.select_user', 'Select user')}
                searchable
                searchPlaceholder={t('common.search', 'Search')}
                options={availableUsers.map((item) => ({ value: String(item.id), label: `${item.name} ${item.surname}`.trim() || item.email, hint: String(item.role ?? '') }))}
              />
            </div>
            <button
              type="button"
              onClick={() => void createExtension()}
              disabled={!canCreate}
              className="h-7 rounded-[7px] bg-[var(--mp-blue)] px-3 text-[13px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('telephony.system.create', 'Create extension')}
            </button>
          </div>

          <ul>
            {visible.map((item) => {
              const name = item.user_name || t('telephony.system.user_fallback', 'User #{{id}}', { id: item.user_id })
              return (
                <li key={item.user_id} className="flex items-center gap-3 border-t border-[var(--mp-separator)] px-4 py-2.5">
                  <MacAvatar name={item.user_name} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-[var(--mp-text)]">{name}</p>
                    <p className="text-[12px] text-[var(--mp-secondary)]">
                      {item.is_active ? t('telephony.system.active', 'Active') : t('telephony.system.inactive', 'Inactive')}
                    </p>
                  </div>
                  <span className="rounded-[6px] bg-[var(--mp-control)] px-2 py-0.5 font-mono text-[12.5px] tabular-nums text-[var(--mp-text)]" data-i18n-skip="true">
                    {item.extension || '—'}
                  </span>
                  <MacSwitch
                    checked={Boolean(item.is_active)}
                    disabled={busyId === item.user_id}
                    onChange={() => void toggleExtension(item)}
                    label={`${item.is_active ? t('telephony.system.disable', 'Disable') : t('telephony.system.enable', 'Enable')} · ${name}`}
                  />
                </li>
              )
            })}
          </ul>
          {visible.length === 0 ? (
            <p className="border-t border-[var(--mp-separator)] px-4 py-6 text-center text-[13px] text-[var(--mp-secondary)]">
              {loading ? t('telephony.system.loading', 'Loading…') : t('telephony.system.no_extensions', 'No matching extensions.')}
            </p>
          ) : null}
        </Group>
      </div>
    </section>
  )
}
