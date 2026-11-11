import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, ArchiveRestore, ArrowLeft, CalendarPlus, Loader2, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { CustomerSummary } from '../../../shared/api/types'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { getCustomerDisplayName, getCustomerDisplayPlatform } from '../../../shared/lib/customer-display'
import { formatNumericDate } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { DataGrid, type GridColumn } from '../../../shared/ui/data-grid'
import { gridButton } from '../../../shared/ui/data-grid-styles'
import { ErrorStateBlock } from '../../../shared/ui/state-block'
import { CopyButton, StatusPill } from '../components/CustomerFilters'
import { MetricTile } from '../../../shared/ui/metric-tile'
import { avatarTone, initialsFor } from '../lib/customerAvatar'
import { useAuth } from '../../auth/hooks/useAuth'
import { useCrmScope } from '../lib/crmScope'
import { platformVisual } from '../lib/platformIcon'
import { statusIconFor } from '../lib/statusIcon'

const statusKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const DAY = 86_400_000

/** /crm/archived — archived customers: restore them or delete them for good. */
export function CrmArchivedPage() {
  const { t } = useLocale()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { service: crmService, routeBasePath, storageKey, kind } = useCrmScope()
  const { can } = useAuth()
  // RBAC customers: restore = edit, delete for good = delete, CSV = export (outbound keeps its own rules).
  const canRestore = kind === 'outbound' || can('customers', 'edit')
  const canHardDelete = kind === 'outbound' || can('customers', 'delete')
  const canExport = kind === 'outbound' || can('customers', 'export')
  const navigate = useNavigate()
  const archivedQuery = useAsyncData(() => crmService.archivedCustomers(), [])
  const statusesQuery = useAsyncData(() => crmService.dynamicStatuses(), [])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [busyIds, setBusyIds] = useState<Set<number>>(() => new Set())
  const [bulkBusy, setBulkBusy] = useState<'restore' | 'delete' | null>(null)

  const customers = useMemo(() => archivedQuery.data ?? [], [archivedQuery.data])

  const statusOptions = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>()
    for (const option of statusesQuery.data ?? []) map.set(statusKey(option.value), { label: option.label, color: option.color })
    return map
  }, [statusesQuery.data])
  const statusMeta = (value: string) => {
    const option = statusOptions.get(statusKey(value))
    return {
      label: t(`crm.status_label.${statusKey(value)}`, option?.label || value.replace(/_/g, ' ')),
      color: option?.color ?? '#8A90A2',
      icon: statusIconFor(value),
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return customers
    return customers.filter((row) => [
      getCustomerDisplayName(row), row.phone_number, row.phone, row.username, getCustomerDisplayPlatform(row), row.status,
    ].some((value) => String(value ?? '').toLowerCase().includes(query)))
  }, [customers, search])

  /* metrics */
  const [now] = useState(() => Date.now())
  const recentCount = customers.filter((row) => {
    const created = new Date(row.created_at).getTime()
    return !Number.isNaN(created) && now - created <= 30 * DAY
  }).length
  const platformCounts = new Map<string, number>()
  for (const row of customers) {
    const platform = getCustomerDisplayPlatform(row)
    if (platform) platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + 1)
  }
  const [topPlatform, topPlatformCount] = [...platformCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]
  const topLook = topPlatform ? platformVisual(topPlatform) : null

  /* actions */
  const removeLocally = (ids: number[]) => {
    const drop = new Set(ids)
    archivedQuery.setData((current: CustomerSummary[] | undefined) => current?.filter((row) => !drop.has(row.id)))
  }
  const setBusy = (id: number, busy: boolean) => setBusyIds((current) => {
    const next = new Set(current)
    if (busy) next.add(id)
    else next.delete(id)
    return next
  })

  async function restore(row: CustomerSummary) {
    const name = getCustomerDisplayName(row)
    setBusy(row.id, true)
    try {
      await crmService.restoreCustomer(row.id)
      removeLocally([row.id])
      showToast({ title: t('customers.archive.restored', '{{name}} restored', { name }), description: t('customers.archive.restored_hint', 'Back in the customers list.'), tone: 'success' })
    } catch (error) {
      showToast({ title: t('customers.archive.restore_failed', 'Could not restore'), description: getApiErrorMessage(error), tone: 'error' })
    } finally {
      setBusy(row.id, false)
    }
  }

  async function hardDelete(row: CustomerSummary) {
    const name = getCustomerDisplayName(row)
    const approved = await confirm({
      title: t('customers.archive.delete_title', 'Delete {{name}} for good?', { name }),
      description: t('customers.archive.delete_description', 'All of this customer’s data is removed and can’t be restored.'),
      confirmLabel: t('customers.archive.delete_confirm', 'Delete for good'),
      cancelLabel: t('common.cancel', 'Cancel'),
      tone: 'danger',
    })
    if (!approved) return
    setBusy(row.id, true)
    try {
      await crmService.hardDeleteCustomer(row.id)
      removeLocally([row.id])
      showToast({ title: t('customers.archive.deleted', '{{name}} deleted', { name }), tone: 'success' })
    } catch (error) {
      showToast({ title: t('customers.archive.delete_failed', 'Could not delete'), description: getApiErrorMessage(error), tone: 'error' })
    } finally {
      setBusy(row.id, false)
    }
  }

  async function restoreMany(keys: string[], clear: () => void) {
    const ids = keys.map(Number)
    setBulkBusy('restore')
    const results = await Promise.allSettled(ids.map((id) => crmService.restoreCustomer(id)))
    const done = ids.filter((_, index) => results[index].status === 'fulfilled')
    removeLocally(done)
    clear()
    setBulkBusy(null)
    const failed = ids.length - done.length
    showToast(failed === 0
      ? { title: t('customers.archive.restored_many', '{{count}} customers restored', { count: done.length }), tone: 'success' }
      : { title: t('customers.archive.restored_partial', '{{done}} restored, {{failed}} failed', { done: done.length, failed }), tone: 'error' })
  }

  async function deleteMany(keys: string[], clear: () => void) {
    const ids = keys.map(Number)
    const approved = await confirm({
      title: t('customers.archive.delete_many_title', 'Delete {{count}} customers for good?', { count: ids.length }),
      description: t('customers.archive.delete_many_description', 'The selected customers are removed with all their data and can’t be restored.'),
      confirmLabel: t('customers.archive.delete_confirm', 'Delete for good'),
      cancelLabel: t('common.cancel', 'Cancel'),
      tone: 'danger',
    })
    if (!approved) return
    setBulkBusy('delete')
    try {
      await crmService.bulkHardDelete(ids)
      removeLocally(ids)
      clear()
      showToast({ title: t('customers.archive.deleted_many', '{{count}} customers deleted', { count: ids.length }), tone: 'success' })
    } catch (error) {
      showToast({ title: t('customers.archive.delete_failed', 'Could not delete'), description: getApiErrorMessage(error), tone: 'error' })
      void archivedQuery.refetch()
    } finally {
      setBulkBusy(null)
    }
  }

  /* table */
  const columns: GridColumn<CustomerSummary>[] = [
    {
      key: 'name',
      header: t('customers.table.client', 'Customer'),
      width: 240,
      hideable: false,
      sortValue: (row) => getCustomerDisplayName(row),
      render: (row) => {
        const name = getCustomerDisplayName(row)
        return (
          <span className="flex min-w-0 items-center gap-2.5">
            <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10.5px] font-bold opacity-80 ring-2 ring-[var(--surface)] grayscale-[35%]', avatarTone(name))}>{initialsFor(name)}</span>
            <span className="truncate font-semibold text-[var(--foreground)]">{name}</span>
          </span>
        )
      },
    },
    {
      key: 'phone',
      header: t('customers.table.phone', 'Phone'),
      width: 180,
      sortValue: (row) => row.phone_number ?? row.phone ?? '',
      render: (row) => {
        const phone = row.phone_number ?? row.phone ?? ''
        return phone ? (
          <span className="flex items-center gap-1">
            <span className="tabular-nums text-[var(--foreground)]">{phone}</span>
            <CopyButton value={phone} label={t('customers.table.copy_phone', 'Copy phone')} />
          </span>
        ) : <span className="text-[var(--caption)]">—</span>
      },
    },
    {
      key: 'platform',
      header: t('customers.table.platform', 'Platform'),
      width: 150,
      sortValue: (row) => getCustomerDisplayPlatform(row) ?? '',
      render: (row) => {
        const platform = getCustomerDisplayPlatform(row)
        if (!platform) return <span className="text-[var(--caption)]">—</span>
        const { icon: Icon, color } = platformVisual(platform)
        return (
          <span className="flex min-w-0 items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white shadow-[0_2px_6px_-2px_rgba(14,21,37,0.4)]" style={{ background: color }}>
              <Icon size={13} strokeWidth={2.2} />
            </span>
            <span className="truncate">{platform}</span>
          </span>
        )
      },
    },
    {
      key: 'status',
      header: t('customers.archive.last_status', 'Last status'),
      width: 200,
      sortValue: (row) => row.status,
      exportValue: (row) => statusMeta(row.status).label,
      render: (row) => {
        const meta = statusMeta(row.status)
        return <StatusPill label={meta.label} color={meta.color} icon={meta.icon} />
      },
    },
    {
      key: 'created',
      header: t('common.created', 'Created'),
      width: 160,
      sortValue: (row) => row.created_at,
      exportValue: (row) => formatNumericDate(row.created_at),
      render: (row) => <span className="tabular-nums text-[var(--muted-strong)]">{formatNumericDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      header: t('customers.table.actions', 'Actions'),
      width: 170,
      hideable: false,
      align: 'right',
      exportValue: () => '',
      render: (row) => {
        const busy = busyIds.has(row.id)
        return (
          <span className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            {canRestore ? <button
              type="button"
              onClick={() => void restore(row)}
              disabled={busy}
              className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-[var(--success-border)] bg-[var(--surface)] px-2.5 text-[12px] font-semibold text-[var(--success-text)] transition-colors hover:bg-[var(--success-dim)] disabled:opacity-50"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <ArchiveRestore size={13} />}
              {t('customers.archive.restore', 'Restore')}
            </button> : null}
            {canHardDelete ? <button
              type="button"
              onClick={() => void hardDelete(row)}
              disabled={busy}
              title={t('customers.archive.delete_confirm', 'Delete for good')}
              aria-label={t('customers.archive.delete_confirm', 'Delete for good')}
              className="grid h-7 w-7 place-items-center rounded-[7px] text-[var(--muted)] transition-colors hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)] disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button> : null}
          </span>
        )
      },
    },
  ]

  return (
    <section className="stagger-in flex flex-col gap-4">
      {/* Title row */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`${routeBasePath}/customers`)}
            aria-label={t('customers.archive.back', 'Back to customers')}
            title={t('customers.archive.back', 'Back to customers')}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-strong)] shadow-[0_1px_2px_rgba(14,21,37,0.04)] transition-[color,border-color,transform] hover:-translate-x-0.5 hover:border-[var(--border-hover)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[24px] leading-8 font-bold tracking-[-0.025em] text-[var(--foreground)]">{t('customers.archive.title', 'Archive')}</h1>
              <span className="rounded-[6px] bg-[var(--muted-surface)] px-2 py-0.5 text-[12px] font-semibold text-[var(--muted-strong)] tabular-nums">
                {t('customers.list_page.records', '{{count}} records', { count: customers.length })}
              </span>
              {kind === 'outbound' ? <span className="rounded-[6px] bg-[var(--muted-surface)] px-2 py-0.5 text-[12px] font-semibold text-[var(--muted-strong)]">Outbound</span> : null}
            </div>
            <p className="mt-0.5 text-[13px] text-[var(--muted)]">{t('customers.archive.subtitle', 'Hidden from the customers list. Restore them, or delete them for good.')}</p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="group/search relative flex h-10 min-w-0 flex-1 items-center sm:w-[300px] sm:flex-none">
            <Search size={16} className="pointer-events-none absolute left-3 text-[var(--muted)] transition-colors group-focus-within/search:text-[var(--primary)]" />
            <input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder={t('customers.archive.search', 'Name, phone or platform')}
              aria-label={t('customers.filters.search_label', 'Search')}
              className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] pr-9 pl-9 text-[13.5px] text-[var(--foreground)] shadow-[0_1px_2px_rgba(14,21,37,0.04)] transition-[border-color,box-shadow] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:shadow-[0_0_0_4px_rgba(43,89,255,0.12)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {search ? (
              <button type="button" onClick={() => { setSearch(''); setPage(1) }} aria-label={t('common.clear', 'Clear')} className="absolute right-2.5 grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--muted-surface)] hover:text-[var(--foreground)]">
                <X size={14} />
              </button>
            ) : null}
          </label>
          <button type="button" onClick={() => void archivedQuery.refetch()} className={cn(gridButton, 'h-10 px-3.5')}>
            <RefreshCw size={15} className={cn(archivedQuery.isLoading && 'animate-spin')} />
            {t('customers.actions.refresh', 'Refresh')}
          </button>
        </div>
      </header>

      {/* Metrics */}
      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricTile
          label={t('customers.archive.metric_total', 'In archive')}
          value={customers.length}
          caption={t('customers.archive.metric_total_caption', 'Not shown in the customers list')}
          icon={Archive}
          accent="#64748B"
        />
        <MetricTile
          label={t('customers.archive.metric_recent', 'Added in the last 30 days')}
          value={recentCount}
          caption={t('customers.archive.metric_recent_caption', 'Recent leads that ended up here')}
          icon={CalendarPlus}
          accent="#2B59FF"
        />
        <MetricTile
          label={topPlatform ? t('customers.archive.metric_platform', 'Top source: {{platform}}', { platform: topPlatform }) : t('customers.archive.metric_platform_none', 'Top source')}
          value={topPlatformCount}
          caption={customers.length ? t('customers.archive.metric_platform_caption', '{{percent}}% of the archive', { percent: Math.round((topPlatformCount / customers.length) * 100) }) : '—'}
          icon={topLook?.icon ?? Archive}
          accent={topLook?.color ?? '#8A90A2'}
        />
      </div>

      {archivedQuery.isError && !archivedQuery.data ? (
        <ErrorStateBlock
          eyebrow={t('customers.archive.title', 'Archive')}
          title={t('customers.archive.load_failed', 'The archive could not be loaded')}
          description={getApiErrorMessage(archivedQuery.error)}
          actionLabel={t('common.retry', 'Retry')}
          onAction={() => void archivedQuery.refetch()}
        />
      ) : (
        <DataGrid
          id={`${storageKey}-archive`}
          rowNumbers
          selectable={canRestore || canHardDelete}
          exportName={canExport ? (kind === 'outbound' ? 'outbound-archive' : 'customers-archive') : undefined}
          selectionActions={(keys, clear) => (
            <>
              {canRestore ? <button
                type="button"
                onClick={() => void restoreMany(keys, clear)}
                disabled={Boolean(bulkBusy)}
                className={cn(gridButton, 'grid-row-in border-[var(--success-border)] text-[var(--success-text)] hover:bg-[var(--success-dim)]')}
              >
                {bulkBusy === 'restore' ? <Loader2 size={14} className="animate-spin" /> : <ArchiveRestore size={14} />}
                {t('customers.archive.restore', 'Restore')}
              </button> : null}
              {canHardDelete ? <button
                type="button"
                onClick={() => void deleteMany(keys, clear)}
                disabled={Boolean(bulkBusy)}
                className={cn(gridButton, 'grid-row-in border-[var(--danger-border)] text-[var(--danger-text)] hover:bg-[var(--danger-dim)]')}
              >
                {bulkBusy === 'delete' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {t('customers.archive.delete_confirm', 'Delete for good')}
              </button> : null}
            </>
          )}
          columns={columns}
          rows={filtered}
          getRowKey={(row) => String(row.id)}
          loading={archivedQuery.isLoading && !archivedQuery.data}
          page={page}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          emptyState={(
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-[var(--muted-surface)] text-[var(--muted-strong)]">
                {search ? <Search size={24} /> : <Archive size={24} />}
              </span>
              <p className="mt-4 text-[15px] font-semibold text-[var(--foreground)]">
                {search ? t('customers.archive.no_match', 'Nothing matches “{{query}}”', { query: search }) : t('customers.archive.empty_title', 'The archive is empty')}
              </p>
              <p className="mt-1 max-w-sm text-[13px] text-[var(--muted)]">
                {search ? t('customers.archive.no_match_hint', 'Try another name or phone number.') : t('customers.archive.empty_hint', 'Customers you archive show up here, and can be restored at any time.')}
              </p>
              <button
                type="button"
                onClick={() => (search ? setSearch('') : navigate(`${routeBasePath}/customers`))}
                className={cn(gridButton, 'mt-4 h-9 px-3.5')}
              >
                {search ? <X size={14} /> : <ArrowLeft size={14} />}
                {search ? t('common.clear', 'Clear') : t('customers.archive.back', 'Back to customers')}
              </button>
            </div>
          )}
        />
      )}
    </section>
  )
}
