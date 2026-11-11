import { useEffect, useMemo, useState } from 'react'
import { ArrowRightIcon, TrashIcon, WarningIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { CustomerSummary, ManagementStatusRecord } from '../../../shared/api/types'
import { getApiErrorMessage, getApiErrorStatus } from '../../../shared/lib/api-error'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { SelectField } from '../../../shared/ui/select-field'

/** What the dialog needs from a CRM (main or outbound). */
export type StatusDeleteApi = {
  filterByStatus: (status: string) => Promise<CustomerSummary[]>
  archivedCustomers: () => Promise<CustomerSummary[]>
  patchCustomer: (customerId: number, formData: FormData) => Promise<unknown>
  deleteStatus: (statusId: number) => Promise<unknown>
  /** Fallback when the backend refuses to delete: make the status inactive (hidden from pickers). */
  deactivateStatus: (statusId: number) => Promise<unknown>
}

type Props = {
  status: ManagementStatusRecord
  /** All statuses of the same CRM (the replacement is picked from these). */
  statuses: ManagementStatusRecord[]
  api: StatusDeleteApi
  onClose: () => void
  onDeleted: (moved: number) => void
  onDeactivated: () => void
}

type Usage = { customers: CustomerSummary[]; archived: number }

/**
 * Safe status delete: the backend cannot delete a status that customers still have,
 * so customers (incl. archived) are moved to another status first, then the status is deleted.
 */
export function StatusDeleteDialog({ status, statuses, api, onClose, onDeleted, onDeactivated }: Props) {
  const { t } = useLocale()
  const [usage, setUsage] = useState<Usage | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [picked, setTarget] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // System statuses: first try a plain delete without touching customers.
  const [directTried, setDirectTried] = useState(false)

  const replacements = useMemo(
    () => statuses.filter((item) => item.id !== status.id && item.is_active).sort((a, b) => a.order - b.order),
    [status.id, statuses],
  )

  useEffect(() => {
    let alive = true
    Promise.all([
      api.filterByStatus(status.name),
      api.archivedCustomers().then((list) => list.filter((item) => item.status === status.name)).catch(() => [] as CustomerSummary[]),
    ])
      .then(([active, archived]) => {
        if (!alive) return
        const seen = new Set(active.map((item) => item.id))
        setUsage({ customers: [...active, ...archived.filter((item) => !seen.has(item.id))], archived: archived.length })
      })
      .catch((cause) => {
        if (!alive) return
        // Counting failed (e.g. no CRM permission) — still allow a plain delete attempt.
        setUsage({ customers: [], archived: 0 })
        setUsageError(getApiErrorMessage(cause))
      })
    return () => { alive = false }
  }, [api, status.name])

  const count = usage?.customers.length ?? 0
  // Default: the first active status (by order) until the user picks one.
  const target = replacements.some((item) => item.name === picked) ? picked : replacements[0]?.name ?? ''

  function explain(cause: unknown) {
    const code = getApiErrorStatus(cause)
    const message = getApiErrorMessage(cause)
    if (code === 403) return t('status_delete.err_forbidden', 'You do not have permission to delete statuses. ({{message}})', { message })
    if (code === 404) return t('status_delete.err_missing', 'This status no longer exists — refresh the list.')
    if (code && code >= 500) return t('status_delete.err_server', 'The server failed while deleting ({{code}}). Usually customers still have this status: move them and try again. Details: {{message}}', { code, message })
    if (status.is_system) return t('status_delete.err_system', 'The backend refused to delete a system status: {{message}}. Turn it off (inactive) instead.', { message })
    return t('status_delete.err_refused', 'The backend refused: {{message}}', { message })
  }

  async function run() {
    setBusy(true)
    setError(null)
    let moved = 0
    if (status.is_system && !directTried) {
      try {
        await api.deleteStatus(status.id)
        onDeleted(0)
      } catch (cause) {
        setDirectTried(true)
        setError(explain(cause))
      } finally {
        setBusy(false)
      }
      return
    }
    try {
      if (count > 0) {
        if (!target) throw new Error(t('status_delete.pick_target', 'Choose where to move the customers.'))
        const customers = usage?.customers ?? []
        setProgress({ done: 0, total: customers.length })
        const failed: string[] = []
        // A few at a time, so a big status does not flood the API.
        for (let index = 0; index < customers.length; index += 5) {
          const chunk = customers.slice(index, index + 5)
          const results = await Promise.allSettled(chunk.map((customer) => {
            const formData = new FormData()
            formData.append('status', target)
            formData.append('customer_status', target)
            return api.patchCustomer(customer.id, formData)
          }))
          results.forEach((result, position) => {
            if (result.status === 'fulfilled') moved += 1
            else failed.push(chunk[position].full_name || `#${chunk[position].id}`)
          })
          setProgress({ done: Math.min(index + chunk.length, customers.length), total: customers.length })
        }
        if (failed.length) {
          throw new Error(t('status_delete.move_failed', 'Could not move {{count}} customer(s): {{names}}. The status was not deleted.', { count: failed.length, names: failed.slice(0, 5).join(', ') }))
        }
      }
      await api.deleteStatus(status.id)
      onDeleted(moved)
    } catch (cause) {
      setError(cause instanceof Error && !('status' in cause) ? cause.message : explain(cause))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function deactivate() {
    setBusy(true)
    setError(null)
    try {
      await api.deactivateStatus(status.id)
      onDeactivated()
    } catch (cause) {
      setError(getApiErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const moveFirst = count > 0 && (!status.is_system || directTried)
  const targetLabel = replacements.find((item) => item.name === target)?.display_name ?? target

  return (
    <Dialog
      open
      onClose={busy ? () => {} : onClose}
      tone="danger"
      title={t('status_delete.title', 'Delete status “{{name}}”', { name: status.display_name })}
      description={t('status_delete.description', 'Customers with this status are moved to another status first, then the status is deleted.')}
      headerIcon={<TrashIcon size={18} weight="duotone" />}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancel')}</Button>
          {(status.is_system || error) && status.is_active ? (
            <Button variant="secondary" onClick={() => void deactivate()} disabled={busy}>{t('status_delete.deactivate', 'Make inactive')}</Button>
          ) : null}
          <Button variant="danger" onClick={() => void run()} loading={busy} disabled={!usage || (moveFirst && !target)}>
            {moveFirst ? t('status_delete.move_and_delete', 'Move {{count}} and delete', { count }) : t('status_delete.delete', 'Delete status')}
          </Button>
        </>
      )}
    >
      <div className="space-y-3.5">
        {status.is_system ? (
          <p className="flex items-start gap-2 rounded-[12px] bg-[var(--warning-dim)] px-3 py-2.5 text-[12.5px] leading-snug text-[var(--warning-text)]">
            <WarningIcon size={16} weight="duotone" className="mt-px shrink-0" />
            {t('status_delete.system', 'This is a system status. The backend may refuse to delete it — then make it inactive instead.')}
          </p>
        ) : null}

        {!usage ? (
          <span className="skeleton block h-16 rounded-[12px]" />
        ) : count === 0 || !moveFirst ? (
          <p className="rounded-[12px] bg-[var(--muted-surface)] px-3.5 py-3 text-[13px] text-[var(--muted-strong)]">
            {count > 0
              ? t('status_delete.system_first', '{{count}} customer(s) have this status. First we try to delete it as is; if the backend refuses, you can move them or make the status inactive.', { count })
              : usageError
              ? t('status_delete.count_unknown', 'Could not check which customers have this status ({{message}}). You can still try to delete it.', { message: usageError })
              : t('status_delete.no_customers', 'No customers have this status — it can be deleted right away.')}
          </p>
        ) : (
          <div className="space-y-3 rounded-[12px] border border-[var(--border)] p-3.5">
            <p className="text-[13px] text-[var(--foreground)]">
              {t('status_delete.has_customers', '{{count}} customer(s) have this status', { count })}
              {usage.archived ? <span className="text-[var(--muted)]"> · {t('status_delete.archived', '{{count}} archived', { count: usage.archived })}</span> : null}
            </p>
            {replacements.length === 0 ? (
              <p className="text-[12.5px] text-[var(--danger-text)]">{t('status_delete.no_target', 'There is no other active status to move them to. Create one first.')}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-white" style={{ background: status.color || '#64748b' }}>{status.display_name}</span>
                <ArrowRightIcon size={15} className="text-[var(--muted)]" />
                <div className="min-w-[200px] flex-1">
                  <SelectField
                    value={target}
                    onValueChange={setTarget}
                    options={replacements.map((item) => ({ value: item.name, label: item.display_name || item.name, color: item.color || undefined }))}
                    aria-label={t('status_delete.target', 'Move to')}
                    disabled={busy}
                  />
                </div>
              </div>
            )}
            {progress ? (
              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted-surface)]">
                  <div className="h-full rounded-full bg-[var(--primary)] transition-[width]" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
                </div>
                <p className="mt-1 text-[11.5px] text-[var(--muted)] tabular-nums">
                  {t('status_delete.moving', 'Moving to “{{target}}”: {{done}} / {{total}}', { target: targetLabel, done: progress.done, total: progress.total })}
                </p>
              </div>
            ) : null}
          </div>
        )}

        {error ? <p role="alert" className="rounded-[12px] bg-[var(--danger-dim)] px-3.5 py-2.5 text-[12.5px] leading-snug text-[var(--danger-text)]">{error}</p> : null}
      </div>
    </Dialog>
  )
}
