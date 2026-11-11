import { useEffect, useState } from 'react'
import { ArrowClockwiseIcon, CaretLeftIcon, CaretRightIcon, MagnifyingGlassIcon, TrayIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import {
  REGISTRATION_STATUSES,
  registrationsService,
  type RegistrationForm,
  type RegistrationStatus,
  type RegistrationSubmissionPage,
} from '../../../shared/api/services/registrations.service'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { formatShortDateTime } from '../../../shared/lib/format'
import { cn } from '../../../shared/lib/cn'
import { Button } from '../../../shared/ui/button'
import { SelectField } from '../../../shared/ui/select-field'
import { statusLabel } from '../lib/labels'
import { ApplicantAvatar } from './ApplicantAvatar'
import { ApplicationPanel } from './ApplicationPanel'
import { RegistrationStatusBadge } from './StatusBadge'

type ApplicationsViewProps = {
  forms: RegistrationForm[] | null
  formId: string | null
  status: RegistrationStatus | null
  onFiltersChange: (next: { formId: string | null; status: RegistrationStatus | null }) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  canReview: boolean
  /** Bumped by the page (e.g. the Refresh button) to reload the list. */
  reloadToken: number
  /** An application was approved / rejected — the page refreshes the link counters. */
  onReviewed: () => void
}

const PAGE_SIZES = [20, 50, 100]
const GRID = 'md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,150px)_118px_20px]'

/** Applications tab: filters (link, status, search), a paginated list and the detail panel. */
export function ApplicationsView({ forms, formId, status, onFiltersChange, selectedId, onSelect, canReview, reloadToken, onReviewed }: ApplicationsViewProps) {
  const { t, locale } = useLocale()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [reload, setReload] = useState(0)
  const debounced = useDebouncedValue(search.trim(), 350)
  const key = JSON.stringify([formId, status, debounced, page, pageSize, reload, reloadToken])
  const [result, setResult] = useState<{ key: string; data?: RegistrationSubmissionPage; failed?: boolean } | null>(null)

  useEffect(() => {
    let alive = true
    const requestKey = JSON.stringify([formId, status, debounced, page, pageSize, reload, reloadToken])
    registrationsService.listSubmissions({ form_id: formId, status, search: debounced, page, page_size: pageSize })
      .then((data) => { if (alive) setResult({ key: requestKey, data }) })
      .catch(() => { if (alive) setResult((current) => ({ key: requestKey, data: current?.data, failed: true })) })
    return () => { alive = false }
  }, [debounced, formId, page, pageSize, reload, reloadToken, status])

  const loading = result?.key !== key
  const data = result?.data ?? null
  const failed = !loading && result?.failed === true
  const rows = data?.items ?? []
  const total = data?.total ?? 0
  const pages = Math.max(1, data?.pages ?? 1)
  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(total, page * pageSize)

  const scope = formId ? forms?.filter((form) => form.id === formId) ?? [] : forms ?? []
  const counts = scope.reduce(
    (sum, form) => ({ total: sum.total + form.counts.total, pending: sum.pending + form.counts.pending, approved: sum.approved + form.counts.approved, rejected: sum.rejected + form.counts.rejected }),
    { total: 0, pending: 0, approved: 0, rejected: 0 },
  )
  const formTitle = (id: string | null) => forms?.find((form) => form.id === id)?.title ?? null

  function changeFilters(next: { formId?: string | null; status?: RegistrationStatus | null }) {
    setPage(1)
    onFiltersChange({ formId: next.formId !== undefined ? next.formId : formId, status: next.status !== undefined ? next.status : status })
  }

  const statusTabs: Array<{ value: RegistrationStatus | null; label: string; count: number }> = [
    { value: null, label: t('registrations.applications.all', 'All'), count: counts.total },
    ...REGISTRATION_STATUSES.map((value) => ({ value, label: statusLabel(t, value), count: counts[value] })),
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div role="tablist" aria-label={t('registrations.applications.status_filter', 'Status')} className="no-scrollbar flex w-full gap-1 overflow-x-auto rounded-[14px] bg-[var(--surface)] p-1 ring-1 ring-[var(--border)] lg:w-auto">
          {statusTabs.map((tab) => {
            const selected = tab.value === status
            return (
              <button
                key={tab.value ?? 'all'}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => changeFilters({ status: tab.value })}
                className={cn(
                  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold whitespace-nowrap transition-colors',
                  selected ? 'bg-[var(--surface-inverse)] text-[var(--on-inverse)]' : 'text-[var(--muted-strong)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
                )}
              >
                {tab.label}
                {forms ? (
                  <span className={cn('rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums', selected ? 'bg-white/15' : tab.value === 'pending' && tab.count ? 'bg-[var(--warning-dim)] text-[var(--warning-text)]' : 'bg-[var(--muted-surface)] text-[var(--muted)]')}>
                    {tab.count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row lg:justify-end">
          <div className="w-full sm:w-[240px]" data-i18n-skip="true">
            <SelectField
              value={formId ?? ''}
              onValueChange={(value) => changeFilters({ formId: value || null })}
              options={[
                { value: '', label: t('registrations.applications.all_links', 'All links') },
                ...(forms ?? []).map((form) => ({ value: form.id, label: form.title || form.slug, hint: form.is_active ? undefined : t('registrations.links.inactive', 'Closed') })),
              ]}
              searchable={(forms?.length ?? 0) > 7}
              searchPlaceholder={t('registrations.common.search', 'Search…')}
              emptyMessage={t('registrations.common.nothing_found', 'Nothing found')}
              aria-label={t('registrations.applications.link_filter', 'Link')}
              className="h-11 rounded-[12px]"
            />
          </div>
          <label className="relative flex h-11 w-full items-center sm:max-w-[320px]">
            <MagnifyingGlassIcon size={16} className="pointer-events-none absolute left-3.5 text-[var(--muted)]" />
            <input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder={t('registrations.applications.search', 'Name or email…')}
              aria-label={t('registrations.applications.search', 'Name or email…')}
              className="control-field h-11 w-full rounded-[12px] pr-3 pl-10 text-[13.5px] placeholder:text-[var(--caption)]"
            />
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--card)]">
        <div className={cn('hidden items-center gap-3 border-b border-[var(--border)] bg-[var(--muted-surface)] px-4 py-2.5 text-[11.5px] font-semibold tracking-[0.02em] text-[var(--muted)] md:grid', GRID)}>
          <span>{t('registrations.applications.col_applicant', 'Applicant')}</span>
          <span>{t('registrations.applications.col_link', 'Link')}</span>
          <span>{t('registrations.applications.col_submitted', 'Submitted')}</span>
          <span>{t('registrations.applications.col_status', 'Status')}</span>
          <span />
        </div>

        {failed && !data ? (
          <div className="grid place-items-center px-6 py-14 text-center">
            <WarningCircleIcon size={28} weight="duotone" className="text-[var(--danger-text)]" />
            <p className="mt-2 text-[14px] font-semibold text-[var(--foreground)]">{t('registrations.applications.list_failed', 'Could not load applications')}</p>
            <Button variant="secondary" size="sm" className="mt-3" leftIcon={<ArrowClockwiseIcon size={14} />} onClick={() => setReload((value) => value + 1)}>
              {t('registrations.common.retry', 'Try again')}
            </Button>
          </div>
        ) : !data ? (
          <ul aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index} className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0">
                <span className="skeleton h-9 w-9 rounded-full" />
                <span className="flex-1 space-y-1.5"><span className="skeleton block h-3 w-40 rounded-full" /><span className="skeleton block h-2.5 w-56 rounded-full" /></span>
              </li>
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-[var(--muted-surface)] text-[var(--muted)]"><TrayIcon size={24} weight="duotone" /></span>
            <p className="mt-3 text-[14.5px] font-semibold text-[var(--foreground)]">
              {debounced || formId || status ? t('registrations.applications.empty_filtered', 'No applications match the filters') : t('registrations.applications.empty', 'No applications yet')}
            </p>
            <p className="mt-1 max-w-xs text-[12.5px] text-[var(--muted)]">
              {debounced || formId || status ? t('registrations.applications.empty_filtered_text', 'Change the filters or clear the search.') : t('registrations.applications.empty_text', 'Share a registration link — new applications appear here.')}
            </p>
          </div>
        ) : (
          <>
            {failed ? (
              <div role="alert" className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--danger-dim)] px-4 py-2 text-[12.5px] font-medium text-[var(--danger-text)]">
                <span className="inline-flex items-center gap-1.5"><WarningCircleIcon size={15} weight="fill" />{t('registrations.applications.list_failed', 'Could not load applications')}</span>
                <button type="button" onClick={() => setReload((value) => value + 1)} className="inline-flex h-7 items-center gap-1 rounded-[8px] px-2 font-semibold hover:bg-[var(--surface)]">
                  <ArrowClockwiseIcon size={13} /> {t('registrations.common.retry', 'Try again')}
                </button>
              </div>
            ) : null}
            <ul className={cn('transition-opacity', loading && 'opacity-60')} aria-busy={loading || undefined}>
              {rows.map((row) => {
                const name = [row.name, row.surname].filter(Boolean).join(' ')
                const link = row.form_title ?? formTitle(row.form_id)
                return (
                  <li key={row.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onSelect(row.id)}
                      className={cn(
                        'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--card-hover)]',
                        GRID,
                        selectedId === row.id && 'bg-[var(--blue-dim)] hover:bg-[var(--blue-dim)]',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <ApplicantAvatar name={name || row.email} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold text-[var(--foreground)]" data-i18n-skip="true">{name || '—'}</span>
                          <span className="block truncate text-[12px] text-[var(--muted)]" data-i18n-skip="true">{row.email}</span>
                          <span className="block truncate text-[11.5px] text-[var(--muted)] md:hidden" data-i18n-skip="true">
                            {[link, row.created_at ? formatShortDateTime(row.created_at, locale) : null].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </span>
                      <span className="hidden truncate text-[13px] text-[var(--muted-strong)] md:block" data-i18n-skip="true">{link ?? '—'}</span>
                      <span className="hidden text-[12.5px] text-[var(--muted-strong)] tabular-nums md:block">{row.created_at ? formatShortDateTime(row.created_at, locale) : '—'}</span>
                      <span className="justify-self-end md:justify-self-start"><RegistrationStatusBadge status={row.status} size="sm" /></span>
                      <CaretRightIcon size={14} className="hidden text-[var(--caption)] md:block" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {data && total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-2.5">
            <span className="text-[12.5px] text-[var(--muted)] tabular-nums">{t('registrations.applications.range', '{{from}}–{{to}} of {{total}}', { from, to, total })}</span>
            <div className="flex items-center gap-2">
              <div className="w-[118px]">
                <SelectField
                  size="sm"
                  value={String(pageSize)}
                  onValueChange={(value) => { setPageSize(Number(value)); setPage(1) }}
                  options={PAGE_SIZES.map((size) => ({ value: String(size), label: t('registrations.applications.per_page', '{{count}} / page', { count: size }) }))}
                  aria-label={t('registrations.applications.page_size', 'Rows per page')}
                />
              </div>
              <span className="text-[12.5px] text-[var(--muted-strong)] tabular-nums">{t('registrations.applications.page', 'Page {{page}} of {{pages}}', { page, pages })}</span>
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} aria-label={t('registrations.applications.prev', 'Previous page')} className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--border-hover)] text-[var(--muted-strong)] hover:bg-[var(--input-surface)] disabled:opacity-35">
                <CaretLeftIcon size={14} />
              </button>
              <button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages || loading} aria-label={t('registrations.applications.next', 'Next page')} className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--border-hover)] text-[var(--muted-strong)] hover:bg-[var(--input-surface)] disabled:opacity-35">
                <CaretRightIcon size={14} />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {selectedId ? (
        <ApplicationPanel
          key={selectedId}
          submissionId={selectedId}
          canReview={canReview}
          onClose={() => onSelect(null)}
          onReviewed={() => { setReload((value) => value + 1); onReviewed() }}
        />
      ) : null}
    </div>
  )
}
