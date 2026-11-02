import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { auditService, type AuditLogItem } from '../../../shared/api/services/audit.service'
import { ceoService } from '../../../shared/api/services/ceo.service'
import { Button } from '../../../shared/ui/button'
import { Badge } from '../../../shared/ui/badge'
import { Card } from '../../../shared/ui/card'
import { Input } from '../../../shared/ui/input'
import { MemberAvatar } from '../../../shared/ui/member-avatar'
import { PageHeader } from '../../../shared/ui/page-header'
import { DataTable } from '../../../shared/ui/data-table'
import { LoadingStateBlock, ErrorStateBlock, EmptyStateBlock } from '../../../shared/ui/state-block'
import { Dialog } from '../../../shared/ui/dialog'
import { SelectField, type SelectFieldOption } from '../../../shared/ui/select-field'
import type { Tone } from '../../../shared/ui/tone'

type ActionTone = Extract<Tone, 'success' | 'warning' | 'danger' | 'blue'>

const actionTones: Record<string, ActionTone> = {
  create: 'success',
  update: 'warning',
  delete: 'danger',
}

function ActionBadge({ action }: { action: string | null }) {
  return (
    <Badge variant={actionTones[action ?? ''] ?? 'blue'} className="capitalize">
      {action ?? 'action'}
    </Badge>
  )
}

function LogDetailModal({ log, onClose }: { log: AuditLogItem; onClose: () => void }) {
  const lt = translateCurrentLiteral

  return (
    <Dialog
      open
      onClose={onClose}
      title={lt('Log Detail')}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          {lt('Close')}
        </Button>
      }
    >
      <div className="space-y-[18px]">
        <div className="grid gap-4 rounded-[18px] bg-[var(--accent-soft)] p-[18px] sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="ui-card-label">{lt('Action')}</p>
            <ActionBadge action={log.action} />
          </div>
          <div className="space-y-1.5">
            <p className="ui-card-label">{lt('Entity Type')}</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">{log.entity_type}</p>
          </div>
          <div className="space-y-1.5">
            <p className="ui-card-label">{lt('Entity ID')}</p>
            <p className="text-sm font-semibold text-[var(--foreground)]" data-ui-number="true">#{log.entity_id}</p>
          </div>
          <div className="space-y-1.5">
            <p className="ui-card-label">{lt('Timestamp')}</p>
            <p className="text-sm font-semibold text-[var(--foreground)]" data-ui-number="true">{new Date(log.created_at).toLocaleString()}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="ui-card-label">{lt('User')}</p>
          <div className="flex items-center gap-3 rounded-[18px] bg-[var(--accent-soft)] p-[18px]">
            <MemberAvatar name={log.actor_name} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)]">{log.actor_name}</p>
              <p className="text-[12.5px] text-[var(--muted)]">{log.actor_email}</p>
            </div>
          </div>
        </div>

        {(log.after_data || log.before_data) ? (
          <div className="space-y-2">
            <p className="ui-card-label">{lt('Data Changes')}</p>
            <div className="max-h-80 overflow-auto rounded-[18px] bg-[var(--muted-surface)] p-[18px]">
              <div className="space-y-4">
                {Object.entries(log.after_data || {}).map(([key, afterValue]) => {
                  const beforeValue = log.before_data?.[key]
                  const hasChanged = beforeValue !== afterValue

                  return (
                    <div key={key} className="border-b border-[var(--border-hover)] pb-4 last:border-0 last:pb-0">
                      <p className="mb-3 text-[11px] font-semibold tracking-[0.08em] uppercase text-[var(--muted-strong)]">{key}</p>

                      {hasChanged ? (
                        <div className="space-y-2">
                          <div className="rounded-[11px] bg-[var(--danger-dim)] px-3 py-2.5">
                            <p className="mb-1 text-[11px] font-semibold tracking-[0.08em] uppercase text-[var(--danger-text)]">{lt('Before')}</p>
                            <p className="text-sm break-all text-[var(--muted-strong)]">{String(beforeValue || '-')}</p>
                          </div>
                          <div className="rounded-[11px] bg-[var(--success-dim)] px-3 py-2.5">
                            <p className="mb-1 text-[11px] font-semibold tracking-[0.08em] uppercase text-[var(--success-text)]">{lt('After')}</p>
                            <p className="text-sm font-medium break-all text-[var(--foreground)]">{String(afterValue || '-')}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--muted-strong)]">{String(afterValue || '-')}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <EmptyStateBlock
            eyebrow={lt('Data Changes')}
            title={lt('No change data available')}
            className="rounded-[18px]"
          />
        )}
      </div>
    </Dialog>
  )
}

export function AuditLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const lt = translateCurrentLiteral

  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [module, setModule] = useState(searchParams.get('module') || '')
  const [tableName, setTableName] = useState(searchParams.get('table_name') || '')
  const [action, setAction] = useState(searchParams.get('action') || '')
  const [actorUserId, setActorUserId] = useState(searchParams.get('actor_user_id') || '')
  const [entityType, setEntityType] = useState(searchParams.get('entity_type') || '')
  const [entityId, setEntityId] = useState(searchParams.get('entity_id') || '')
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)

  const dashboardQuery = useAsyncData(() => ceoService.getDashboard(), [])

  const userOptions = useMemo<SelectFieldOption[]>(() => {
    const users = dashboardQuery.data?.users ?? []
    const options = users.map((u) => ({
      value: String(u.id),
      label: `${u.name} ${u.surname} (${u.email})`,
    }))
    return [{ value: '', label: lt('All Users') }, ...options]
  }, [dashboardQuery.data?.users, lt])

  const logsQuery = useAsyncData(
    () => auditService.list({
      page,
      module: module || undefined,
      table_name: tableName || undefined,
      action: action || undefined,
      actor_user_id: actorUserId ? Number(actorUserId) : undefined,
      entity_type: entityType || undefined,
      entity_id: entityId || undefined,
    }),
    [page, module, tableName, action, actorUserId, entityType, entityId]
  )

  useEffect(() => {
    const params: Record<string, string> = {}
    if (page > 1) params.page = String(page)
    if (module) params.module = module
    if (tableName) params.table_name = tableName
    if (action) params.action = action
    if (actorUserId) params.actor_user_id = actorUserId
    if (entityType) params.entity_type = entityType
    if (entityId) params.entity_id = entityId
    setSearchParams(params, { replace: true })
  }, [page, module, tableName, action, actorUserId, entityType, entityId, setSearchParams])

  const logs = logsQuery.data?.items ?? []
  const total = logsQuery.data?.total_items ?? 0
  const totalPages = Math.ceil(total / 20)

  return (
    <div className="page-enter space-y-[18px]">
      <PageHeader
        eyebrow={lt('System Administration')}
        title={lt('Audit Logs')}
        description={lt('Track and monitor all changes and activities across the platform.')}
      />

      <Card>
        <div className="stagger-children grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          <Input
            placeholder={lt('Module')}
            value={module}
            onChange={(e) => { setModule(e.target.value); setPage(1) }}
          />
          <Input
            placeholder={lt('Table Name')}
            value={tableName}
            onChange={(e) => { setTableName(e.target.value); setPage(1) }}
          />
          <Input
            placeholder={lt('Action')}
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1) }}
          />
          <SelectField
            placeholder={lt('Select User')}
            value={actorUserId}
            options={userOptions}
            onValueChange={(val) => { setActorUserId(val); setPage(1) }}
          />
          <Input
            placeholder={lt('Entity Type')}
            value={entityType}
            onChange={(e) => { setEntityType(e.target.value); setPage(1) }}
          />
          <Input
            placeholder={lt('Entity ID')}
            value={entityId}
            onChange={(e) => { setEntityId(e.target.value); setPage(1) }}
          />
        </div>
      </Card>

      <Card>
        {logsQuery.isLoading ? (
          <LoadingStateBlock
            eyebrow={lt('Loading')}
            title={lt('Loading logs...')}
            description={lt('Retrieving latest system activities.')}
            className="rounded-[18px]"
          />
        ) : logsQuery.isError ? (
          <ErrorStateBlock
            eyebrow={lt('Error')}
            title={lt('Failed to load logs')}
            className="rounded-[18px]"
          />
        ) : logs.length === 0 ? (
          <EmptyStateBlock
            eyebrow={lt('Audit Logs')}
            title={lt('No logs found')}
            description={lt('Adjust your filters or try a different search term.')}
            className="rounded-[18px]"
          />
        ) : (
          <>
            <DataTable
              rows={logs}
              getRowKey={(log) => String(log.id)}
              onRowClick={setSelectedLog}
              columns={[
                {
                  key: 'user',
                  header: lt('User'),
                  minWidth: '220px',
                  render: (row) => (
                    <div className="flex items-center gap-3">
                      <MemberAvatar name={row.actor_name} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-[var(--foreground)]">{row.actor_name}</p>
                        <p className="truncate text-[12.5px] text-[var(--muted)]">{row.actor_email}</p>
                      </div>
                    </div>
                  )
                },
                {
                  key: 'action',
                  header: lt('Action'),
                  render: (row) => (
                    <ActionBadge action={row.action} />
                  )
                },
                {
                  key: 'entity',
                  header: lt('Entity'),
                  render: (row) => (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13.5px] font-semibold text-[var(--foreground)]">{row.entity_type}</span>
                      <span className="text-[12.5px] text-[var(--muted)]">ID: #{row.entity_id}</span>
                    </div>
                  )
                },
                {
                  key: 'timestamp',
                  header: lt('Time'),
                  align: 'right',
                  render: (row) => (
                    <div className="text-[12.5px] tabular-nums text-[var(--muted-strong)]" data-ui-number="true">
                      {new Date(row.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  )
                }
              ]}
            />

            {totalPages > 1 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                <p className="text-xs tabular-nums text-[var(--muted)]">
                  {lt('Page')} {page} {lt('of')} {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← {lt('Prev')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {lt('Next')} →
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {selectedLog && (
        <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  )
}
