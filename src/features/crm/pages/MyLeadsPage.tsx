import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArchiveIcon, ListChecksIcon, TrendUpIcon, UsersThreeIcon } from '@phosphor-icons/react'
import { crmService, type SalesManagerLead, type SalesManagerStatusStat } from '../../../shared/api/services/crm.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Checkbox } from '../../../shared/ui/checkbox'
import { Input } from '../../../shared/ui/input'
import { PageHeader } from '../../../shared/ui/page-header'
import { SelectField } from '../../../shared/ui/select-field'
import { Skeleton } from '../../../shared/ui/skeleton'
import { StatCard } from '../../../shared/ui/stat-card'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { resolveTone, tonePill } from '../../../shared/ui/tone'

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

const PRIORITY_VARIANT: Record<string, 'secondary' | 'blue' | 'warning' | 'danger'> = {
  low: 'secondary',
  medium: 'blue',
  high: 'warning',
  critical: 'danger',
}

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const headCell =
  'bg-[var(--muted-surface)] px-4 py-3 text-left text-xs font-medium whitespace-nowrap text-[var(--muted)]'

const bodyCell = 'border-b border-[var(--border-subtle)] px-4 py-3 align-middle'

const statChip =
  'inline-flex h-[30px] items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors'

const statusPill = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap'

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function MyLeadsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 20

  const deferredSearch = useDeferredValue(search)

  const leadsQuery = useAsyncData(
    () => crmService.myCustomers({
      page,
      limit,
      search: deferredSearch || undefined,
      status: statusFilter || undefined,
      priority_level: (priorityFilter as 'low' | 'medium' | 'high' | 'critical') || undefined,
      include_archived: includeArchived || undefined,
    }),
    [page, deferredSearch, statusFilter, priorityFilter, includeArchived],
  )

  const statsQuery = useAsyncData(
    () => crmService.myCustomerStats({ include_archived: includeArchived }),
    [includeArchived],
  )

  const leads = leadsQuery.data?.items ?? []
  const totalCount = leadsQuery.data?.total_count ?? 0
  const totalPages = Math.ceil(totalCount / limit)
  const summary = statsQuery.data?.summary
  const statusStats: SalesManagerStatusStat[] = statsQuery.data?.status_stats ?? []

  const filteredLeads = useMemo(() => {
    if (!deferredSearch) return leads
    const q = deferredSearch.toLowerCase()
    return leads.filter(
      (l) =>
        l.full_name.toLowerCase().includes(q) ||
        (l.phone_number ?? '').includes(q) ||
        (l.username ?? '').toLowerCase().includes(q),
    )
  }, [leads, deferredSearch])

  return (
    <div className="page-enter space-y-[18px]">
      <PageHeader
        eyebrow="CRM"
        title="My Leads"
        actions={
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-[var(--muted-strong)]">
            <Checkbox
              size="sm"
              checked={includeArchived}
              onChange={(e) => { setIncludeArchived(e.target.checked); setPage(1) }}
            />
            Include archived
          </label>
        }
      />

      {statsQuery.isLoading ? (
        <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[168px] rounded-[24px]" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            solid
            label="Total Assigned"
            value={summary.total_assigned}
            icon={<UsersThreeIcon />}
          />
          <StatCard
            label="Active Leads"
            value={summary.active_leads}
            iconTone="success"
            icon={<TrendUpIcon />}
          />
          <StatCard
            label="Archived"
            value={summary.archived_leads}
            iconTone="neutral"
            icon={<ArchiveIcon />}
          />
          <StatCard
            label="Counted"
            value={summary.counted_leads}
            iconTone="violet"
            icon={<ListChecksIcon />}
          />
        </div>
      ) : null}

      {statusStats.length > 0 && (
        <Card className="flex flex-wrap gap-2">
          {statusStats.map((stat) => (
            <button
              key={stat.status}
              type="button"
              onClick={() => {
                setStatusFilter((prev) => prev === stat.status ? '' : stat.status)
                setPage(1)
              }}
              className={cn(
                statChip,
                statusFilter === stat.status
                  ? 'bg-[var(--blue-soft)] text-[var(--blue-text)]'
                  : 'bg-[var(--input-surface)] text-[var(--muted-strong)] hover:bg-[var(--input-surface-hover)] hover:text-[var(--foreground)]',
              )}
            >
              {stat.status}
              <span className="rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
                {stat.count}
              </span>
            </button>
          ))}
          {statusFilter && (
            <button
              type="button"
              onClick={() => { setStatusFilter(''); setPage(1) }}
              className={cn(statChip, 'text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]')}
            >
              Clear filter
            </button>
          )}
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <Input
          placeholder="Search by name, phone or username..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-full sm:max-w-xs"
        />
        <SelectField
          value={priorityFilter}
          options={PRIORITY_OPTIONS}
          onValueChange={(value) => { setPriorityFilter(value); setPage(1) }}
          className="w-full sm:w-44"
        />
        {totalCount > 0 && (
          <p className="ml-auto text-[12.5px] font-medium text-[var(--muted)]">
            {totalCount} lead{totalCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {leadsQuery.isLoading ? (
        <LoadingStateBlock eyebrow="My Leads" title="Loading your leads..." />
      ) : leadsQuery.isError ? (
        <ErrorStateBlock
          eyebrow="Error"
          title="Failed to load leads"
          description={getApiErrorMessage(leadsQuery.error)}
          actionLabel="Retry"
          onAction={() => void leadsQuery.refetch()}
        />
      ) : filteredLeads.length === 0 ? (
        <EmptyStateBlock
          eyebrow="My Leads"
          title="No leads found"
          description="No leads match your current filters."
        />
      ) : (
        <>
          <Card noPadding className="overflow-hidden">
            <div className="custom-scrollbar-visible overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className={headCell}>Name</th>
                    <th className={cn(headCell, 'hidden sm:table-cell')}>Phone</th>
                    <th className={cn(headCell, 'hidden md:table-cell')}>Platform</th>
                    <th className={headCell}>Status</th>
                    <th className={cn(headCell, 'hidden lg:table-cell')}>Priority</th>
                    <th className={cn(headCell, 'hidden xl:table-cell')}>Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead: SalesManagerLead) => (
                    <tr
                      key={lead.id}
                      onClick={() => navigate(`/crm/customers/${lead.id}`)}
                      className="cursor-pointer transition-colors hover:bg-[var(--card-hover)]"
                    >
                      <td className={bodyCell}>
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">{lead.full_name}</p>
                          {lead.username && (
                            <p className="text-[12.5px] text-[var(--muted)]">{lead.username}</p>
                          )}
                        </div>
                      </td>
                      <td className={cn(bodyCell, 'hidden text-[var(--muted-strong)] sm:table-cell')}>
                        {lead.phone_number ?? '—'}
                      </td>
                      <td className={cn(bodyCell, 'hidden md:table-cell')}>
                        {lead.platform ? (
                          <Badge variant="secondary">{lead.platform}</Badge>
                        ) : '—'}
                      </td>
                      <td className={bodyCell}>
                        <span className={cn(statusPill, tonePill(resolveTone(lead.status_name || lead.status)))}>
                          {lead.status_name || lead.status}
                        </span>
                      </td>
                      <td className={cn(bodyCell, 'hidden lg:table-cell')}>
                        {lead.priority_level ? (
                          <Badge variant={PRIORITY_VARIANT[lead.priority_level]}>
                            {PRIORITY_LABEL[lead.priority_level]}
                          </Badge>
                        ) : '—'}
                      </td>
                      <td className={cn(bodyCell, 'hidden text-[12.5px] text-[var(--muted)] xl:table-cell')}>
                        {formatDate(lead.assigned_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <p className="text-[12.5px] font-medium text-[var(--muted)]">
                Page {page} of {totalPages}
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
