import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { outboundCrmService } from '../../../shared/api/services/crm.service'
import type { ManagementStatusRecord } from '../../../shared/api/types'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { formatShortDate } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card'
import { DataTable } from '../../../shared/ui/data-table'
import { Dialog } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { Textarea } from '../../../shared/ui/textarea'

type StatusFormState = {
  name: string
  displayName: string
  description: string
  color: string
  order: string
  isActive: boolean
  isSystem: boolean
}

const statusColorPresets = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6']

const initialStatusForm: StatusFormState = {
  name: '',
  displayName: '',
  description: '',
  color: '#2563EB',
  order: '0',
  isActive: true,
  isSystem: false,
}

function toStatusFormState(item: ManagementStatusRecord): StatusFormState {
  return {
    name: item.name,
    displayName: item.display_name,
    description: item.description ?? '',
    color: item.color || '#2563EB',
    order: String(item.order ?? 0),
    isActive: item.is_active,
    isSystem: item.is_system,
  }
}

function toStatusName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function BooleanToggle({
  value,
  onChange,
  trueLabel,
  falseLabel,
}: {
  value: boolean
  onChange: (next: boolean) => void
  trueLabel: string
  falseLabel: string
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          'rounded-xl border px-4 py-3 text-left text-sm transition',
          value
            ? 'border-emerald-400/35 bg-emerald-500/10 text-(--foreground)'
            : 'border-(--border) bg-(--surface-elevated) text-(--muted-strong) hover:border-(--border-hover)',
        )}
      >
        {trueLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          'rounded-xl border px-4 py-3 text-left text-sm transition',
          !value
            ? 'border-amber-400/35 bg-amber-500/10 text-(--foreground)'
            : 'border-(--border) bg-(--surface-elevated) text-(--muted-strong) hover:border-(--border-hover)',
        )}
      >
        {falseLabel}
      </button>
    </div>
  )
}

export function OutboundCrmStatusesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState<StatusFormState>(initialStatusForm)
  const [editingStatus, setEditingStatus] = useState<ManagementStatusRecord | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const statusesQuery = useAsyncData(() => outboundCrmService.listStatuses(), [])
  const statuses = useMemo(
    () => [...(statusesQuery.data ?? [])].sort((left, right) => left.order - right.order || left.display_name.localeCompare(right.display_name)),
    [statusesQuery.data],
  )
  const activeCount = statuses.filter((status) => status.is_active).length

  function openCreateDialog() {
    setDialogMode('create')
    setEditingStatus(null)
    setForm({ ...initialStatusForm, order: String(statuses.length) })
    setIsDialogOpen(true)
  }

  function openEditDialog(item: ManagementStatusRecord) {
    setDialogMode('edit')
    setEditingStatus(item)
    setForm(toStatusFormState(item))
    setIsDialogOpen(true)
  }

  function closeDialog() {
    setIsDialogOpen(false)
    setEditingStatus(null)
    setForm(initialStatusForm)
  }

  async function handleSubmit() {
    const name = toStatusName(form.name || form.displayName)

    if (!name || !form.displayName.trim()) {
      showToast({
        title: t('outbound_crm.statuses.errors.required.title', 'Required fields missing'),
        description: t('outbound_crm.statuses.errors.required.description', 'Name and display name are required.'),
        tone: 'error',
      })
      return
    }

    setIsSubmitting(true)

    try {
      if (dialogMode === 'create') {
        await outboundCrmService.createStatus({
          name,
          display_name: form.displayName.trim(),
          description: form.description.trim() || undefined,
          color: form.color,
          order: Number(form.order) || 0,
          is_active: form.isActive,
          is_system: form.isSystem,
        })
      } else if (editingStatus) {
        await outboundCrmService.updateStatus(editingStatus.id, {
          display_name: form.displayName.trim(),
          description: form.description.trim() || undefined,
          color: form.color,
          order: Number(form.order) || 0,
          is_active: form.isActive,
        })
      }

      await statusesQuery.refetch()
      closeDialog()
      showToast({
        title: dialogMode === 'create'
          ? t('outbound_crm.statuses.toast.created', 'Status created')
          : t('outbound_crm.statuses.toast.updated', 'Status updated'),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: t('outbound_crm.statuses.errors.save_failed', 'Status save failed'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(item: ManagementStatusRecord) {
    const approved = await confirm({
      title: t('outbound_crm.statuses.confirm.delete_title', 'Delete {{name}}?', { name: item.display_name }),
      description: item.is_system
        ? t('outbound_crm.statuses.confirm.delete_system', 'System statuses may be protected by the backend.')
        : t('outbound_crm.statuses.confirm.delete_description', 'The status will be removed from Outbound CRM.'),
      confirmLabel: t('outbound_crm.statuses.actions.delete', 'Delete status'),
      cancelLabel: t('common.cancel', 'Cancel'),
      tone: 'danger',
    })

    if (!approved) {
      return
    }

    try {
      await outboundCrmService.deleteStatus(item.id)
      await statusesQuery.refetch()
      showToast({ title: t('outbound_crm.statuses.toast.deleted', 'Status deleted'), tone: 'success' })
    } catch (error) {
      showToast({
        title: t('outbound_crm.statuses.errors.delete_failed', 'Delete failed'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    }
  }

  if (statusesQuery.isLoading && !statusesQuery.data) {
    return (
      <LoadingStateBlock
        eyebrow="Outbound CRM"
        title={t('outbound_crm.statuses.loading', 'Statuses loading')}
        description={t('outbound_crm.statuses.loading_description', 'Retrieving Outbound CRM statuses.')}
      />
    )
  }

  if (statusesQuery.isError && !statusesQuery.data) {
    return (
      <ErrorStateBlock
        eyebrow="Outbound CRM"
        title={t('outbound_crm.statuses.errors.load_failed', 'Statuses failed to load')}
        description={getApiErrorMessage(statusesQuery.error)}
        actionLabel={t('common.retry', 'Retry')}
        onAction={() => void statusesQuery.refetch()}
      />
    )
  }

  return (
    <section className="space-y-4 page-enter">
      <Card variant="glass" noPadding className="overflow-hidden rounded-xl">
        <div className="px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--blue-text)]">Outbound CRM</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-[1.75rem]">
                {t('outbound_crm.statuses.title', 'Statuses')}
              </h1>
              <p className="mt-1 text-[13px] text-[var(--muted-strong)]">
                {t('outbound_crm.statuses.description', 'Lead pipeline stages used only by Outbound CRM.')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => navigate('/outbound-crm')}>
                {t('customers.detail.back_to', 'Back to {{title}}', { title: 'Outbound CRM' })}
              </Button>
              <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => void statusesQuery.refetch()}>
                {t('common.refresh', 'Refresh')}
              </Button>
              <Button size="sm" className="rounded-xl" onClick={openCreateDialog}>
                {t('outbound_crm.statuses.actions.create', 'Create status')}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card noPadding>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>{t('outbound_crm.statuses.list_title', 'Pipeline statuses')}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="success">{activeCount} {t('outbound_crm.statuses.active', 'Active')}</Badge>
            <Badge variant="secondary">{statuses.length} {t('outbound_crm.statuses.total', 'Total')}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {statuses.length === 0 ? (
            <EmptyStateBlock
              eyebrow="Outbound CRM"
              title={t('outbound_crm.statuses.empty.title', 'No statuses yet')}
              description={t('outbound_crm.statuses.empty.description', 'Create the first status to start tracking outbound leads.')}
              actionLabel={t('outbound_crm.statuses.actions.create', 'Create status')}
              onAction={openCreateDialog}
            />
          ) : (
            <DataTable
              caption={t('outbound_crm.statuses.list_title', 'Pipeline statuses')}
              rows={statuses}
              getRowKey={(row) => String(row.id)}
              zebra
              columns={[
                {
                  key: 'status',
                  header: t('customers.table.status', 'Status'),
                  render: (row) => (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color || '#64748b' }} />
                        <p className="font-semibold text-(--foreground)">{row.display_name}</p>
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-(--muted)">{row.name}</p>
                    </div>
                  ),
                },
                {
                  key: 'description',
                  header: t('outbound_crm.statuses.fields.description', 'Description'),
                  render: (row) => (
                    <span className="text-sm text-(--muted-strong)">{row.description || '-'}</span>
                  ),
                },
                {
                  key: 'order',
                  header: t('outbound_crm.statuses.fields.order', 'Order'),
                  align: 'right',
                  render: (row) => row.order,
                },
                {
                  key: 'flags',
                  header: t('outbound_crm.statuses.fields.state', 'State'),
                  render: (row) => (
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={row.is_active ? 'success' : 'outline'}>
                        {row.is_active ? t('outbound_crm.statuses.active', 'Active') : t('outbound_crm.statuses.inactive', 'Inactive')}
                      </Badge>
                      {row.is_system ? <Badge variant="warning">{t('outbound_crm.statuses.system', 'System')}</Badge> : null}
                    </div>
                  ),
                },
                {
                  key: 'updated',
                  header: t('outbound_crm.statuses.fields.updated', 'Updated'),
                  render: (row) => formatShortDate(row.updated_at),
                },
                {
                  key: 'actions',
                  header: t('customers.table.actions', 'Actions'),
                  render: (row) => (
                    <div className="flex items-center gap-1">
                      <button type="button" title={t('common.edit', 'Edit')} onClick={() => openEditDialog(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button type="button" title={t('outbound_crm.statuses.actions.delete', 'Delete status')} onClick={() => void handleDelete(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onClose={closeDialog}
        title={dialogMode === 'create'
          ? t('outbound_crm.statuses.actions.create', 'Create status')
          : t('outbound_crm.statuses.actions.edit', 'Edit status')}
        description="Outbound CRM"
        size="xl"
        footer={(
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={isSubmitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={() => void handleSubmit()} loading={isSubmitting}>
              {dialogMode === 'create'
                ? t('outbound_crm.statuses.actions.create', 'Create status')
                : t('common.save_changes', 'Save changes')}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block text-sm font-semibold text-(--foreground)">
                {t('outbound_crm.statuses.fields.display_name', 'Display name')}
              </Label>
              <Input
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="Contacted"
              />
            </div>

            <div>
              <Label className="mb-2 block text-sm font-semibold text-(--foreground)">
                {t('outbound_crm.statuses.fields.name', 'System name')}
              </Label>
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                disabled={dialogMode === 'edit'}
                placeholder={toStatusName(form.displayName) || 'contacted'}
              />
              {dialogMode === 'create' ? (
                <p className="mt-1.5 text-xs text-(--muted)">
                  {t('outbound_crm.statuses.fields.name_hint', 'Leave empty to generate from display name.')}
                </p>
              ) : null}
            </div>

            <div>
              <Label className="mb-2 block text-sm font-semibold text-(--foreground)">
                {t('outbound_crm.statuses.fields.description', 'Description')}
              </Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block text-sm font-semibold text-(--foreground)">
                {t('outbound_crm.statuses.fields.color', 'Color')}
              </Label>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="color"
                  value={form.color}
                  onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                  className="h-12 w-18 rounded-xl p-2"
                />
                <div className="flex flex-wrap gap-2">
                  {statusColorPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, color }))}
                      className={cn(
                        'h-8 w-8 rounded-full border-2 transition',
                        form.color === color ? 'border-(--foreground)' : 'border-transparent',
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={color}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-2 block text-sm font-semibold text-(--foreground)">
                {t('outbound_crm.statuses.fields.order', 'Order')}
              </Label>
              <Input
                type="number"
                value={form.order}
                onChange={(event) => setForm((current) => ({ ...current, order: event.target.value }))}
              />
            </div>

            <div>
              <p className="mb-2 block text-sm font-semibold text-(--foreground)">
                {t('outbound_crm.statuses.fields.state', 'State')}
              </p>
              <BooleanToggle
                value={form.isActive}
                onChange={(isActive) => setForm((current) => ({ ...current, isActive }))}
                trueLabel={t('outbound_crm.statuses.active', 'Active')}
                falseLabel={t('outbound_crm.statuses.inactive', 'Inactive')}
              />
            </div>
          </div>
        </div>
      </Dialog>
    </section>
  )
}
