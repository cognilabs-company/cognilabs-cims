import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { crmService, type SalesManagerLead, type SalesManagerStatusStat } from '../../../shared/api/services/crm.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Input } from '../../../shared/ui/input'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-emerald-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={cn(
      'flex flex-col gap-1 rounded-xl border p-4',
      accent
        ? 'border-(--blue-border) bg-(--blue-dim) text-(--blue-text)'
        : 'border-(--border) bg-(--surface-elevated)',
    )}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-(--muted)">{label}</p>
      <p className="text-2xl font-black tracking-tight text-(--foreground)">{value}</p>
    </div>
  )
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
    <div className="flex flex-col gap-6 page-enter">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-(--muted)">CRM</p>
          <h1 className="text-2xl font-bold tracking-tight text-(--foreground)">My Leads</h1>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-(--muted-strong) cursor-pointer">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => { setIncludeArchived(e.target.checked); setPage(1) }}
            className="h-4 w-4 rounded border-(--border)"
          />
          Include archived
        </label>
      </div>

      {statsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-(--border) bg-(--surface-elevated)" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Assigned" value={summary.total_assigned} accent />
          <StatCard label="Active Leads" value={summary.active_leads} />
          <StatCard label="Archived" value={summary.archived_leads} />
          <StatCard label="Counted" value={summary.counted_leads} />
        </div>
      ) : null}

      {statusStats.length > 0 && (
        <Card className="flex flex-wrap gap-2 p-4">
          {statusStats.map((stat) => (
            <button
              key={stat.status}
              type="button"
              onClick={() => {
                setStatusFilter((prev) => prev === stat.status ? '' : stat.status)
                setPage(1)
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
                statusFilter === stat.status
                  ? 'border-(--blue-border) bg-(--blue-soft) text-(--blue-text)'
                  : 'border-(--border) bg-(--surface) text-(--muted-strong) hover:border-(--border-hover) hover:text-(--foreground)',
              )}
            >
              {stat.status}
              <span className="rounded-full bg-(--accent-soft) px-1.5 py-0.5 text-[10px] font-bold">
                {stat.count}
              </span>
            </button>
          ))}
          {statusFilter && (
            <button
              type="button"
              onClick={() => { setStatusFilter(''); setPage(1) }}
              className="rounded-lg border border-(--border) px-3 py-1.5 text-xs font-semibold text-(--muted) hover:text-(--foreground) transition-all"
            >
              Clear filter
            </button>
          )}
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name, phone or username..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="h-9 w-full max-w-xs text-sm"
        />
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}
          className="h-9 rounded-xl border border-(--border) bg-(--surface) px-3 text-xs font-semibold text-(--foreground) focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {totalCount > 0 && (
          <p className="ml-auto text-xs font-semibold text-(--muted)">
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
          <div className="overflow-hidden rounded-xl border border-(--border)">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--border) bg-(--muted-surface)">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-(--muted)">Name</th>
                  <th className="hidden px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-(--muted) sm:table-cell">Phone</th>
                  <th className="hidden px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-(--muted) md:table-cell">Platform</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-(--muted)">Status</th>
                  <th className="hidden px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-(--muted) lg:table-cell">Priority</th>
                  <th className="hidden px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-(--muted) xl:table-cell">Assigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)">
                {filteredLeads.map((lead: SalesManagerLead) => (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/crm/customers/${lead.id}`)}
                    className="cursor-pointer transition-colors hover:bg-(--accent-soft)"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-(--foreground)">{lead.full_name}</p>
                        {lead.username && (
                          <p className="text-xs text-(--muted)">{lead.username}</p>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-(--muted-strong) sm:table-cell">
                      {lead.phone_number ?? '—'}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {lead.platform ? (
                        <Badge variant="outline" className="text-xs">{lead.platform}</Badge>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-lg border border-(--border) bg-(--surface) px-2 py-1 text-xs font-semibold text-(--muted-strong)">
                        {lead.status_name || lead.status}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {lead.priority_level ? (
                        <span className={cn('text-xs font-bold', PRIORITY_COLOR[lead.priority_level])}>
                          {PRIORITY_LABEL[lead.priority_level]}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-(--muted) xl:table-cell">
                      {formatDate(lead.assigned_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
              <p className="text-xs font-semibold text-(--muted)">
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
