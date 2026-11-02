import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCrmScope } from '../lib/crmScope'
import type { CustomerSummary } from '../../../shared/api/types'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { formatShortDate } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card'
import { Checkbox } from '../../../shared/ui/checkbox'
import { DataTable } from '../../../shared/ui/data-table'
import { IconButton } from '../../../shared/ui/icon-button'
import { PageHeader } from '../../../shared/ui/page-header'
import { ErrorStateBlock, LoadingStateBlock, EmptyStateBlock } from '../../../shared/ui/state-block'

const restoreButtonClass = 'hover:bg-[var(--success-dim)] hover:text-[var(--success-text)]'
const deleteButtonClass = 'hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)]'

function getCustomerDisplayName(row: CustomerSummary): string {
  return (
    row.full_name ||
    row.display_name ||
    row.customer_name ||
    (row.first_name ? `${row.first_name} ${row.last_name ?? ''}`.trim() : null) ||
    row.username ||
    `#${row.id}`
  )
}

export function CrmArchivedPage() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { service: crmService, routeBasePath, title } = useCrmScope()
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  const archivedQuery = useAsyncData(() => crmService.archivedCustomers(), [])
  const customers = archivedQuery.data ?? []

  async function handleRestore(row: CustomerSummary) {
    const name = getCustomerDisplayName(row)
    const approved = await confirm({
      title: `Mijozni tiklash?`,
      description: `${name} arxivdan tiklanib, asosiy ro'yxatga qaytadi.`,
      confirmLabel: 'Tiklash',
    })
    if (!approved) return
    try {
      await crmService.restoreCustomer(row.id)
      await archivedQuery.refetch()
      setSelectedIds((prev) => prev.filter((id) => id !== row.id))
      showToast({ title: `${name} tiklandi`, tone: 'success' })
    } catch (error) {
      showToast({ title: 'Tiklashda xato', description: getApiErrorMessage(error), tone: 'error' })
    }
  }

  async function handleHardDelete(row: CustomerSummary) {
    const name = getCustomerDisplayName(row)
    const approved = await confirm({
      title: `Butunlay o'chirish?`,
      description: `${name} ma'lumotlari tizimdan butunlay o'chiriladi va tiklab bo'lmaydi.`,
      tone: 'danger',
      confirmLabel: `Butunlay o'chirish`,
    })
    if (!approved) return
    try {
      await crmService.hardDeleteCustomer(row.id)
      await archivedQuery.refetch()
      setSelectedIds((prev) => prev.filter((id) => id !== row.id))
      showToast({ title: `${name} o'chirildi`, tone: 'success' })
    } catch (error) {
      showToast({ title: "O'chirishda xato", description: getApiErrorMessage(error), tone: 'error' })
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return
    const approved = await confirm({
      title: `${selectedIds.length} ta mijozni butunlay o'chirish?`,
      description: `Tanlangan mijozlar tizimdan butunlay o'chiriladi va tiklab bo'lmaydi.`,
      tone: 'danger',
      confirmLabel: `Butunlay o'chirish`,
    })
    if (!approved) return
    const countToDelete = selectedIds.length
    setIsBulkDeleting(true)
    try {
      await Promise.all(selectedIds.map((id) => crmService.hardDeleteCustomer(Number(id))))
      await archivedQuery.refetch()
      setSelectedIds([])
      showToast({ title: `${countToDelete} ta mijoz o'chirildi`, tone: 'success' })
    } catch (error) {
      await archivedQuery.refetch()
      showToast({ title: "O'chirishda xato", description: getApiErrorMessage(error), tone: 'error' })
    } finally {
      setIsBulkDeleting(false)
    }
  }

  function toggleSelect(id: number) {
    const numId = Number(id)
    setSelectedIds((prev) =>
      prev.includes(numId) ? prev.filter((x) => x !== numId) : [...prev, numId],
    )
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.length === customers.length ? [] : customers.map((c) => Number(c.id)),
    )
  }

  if (archivedQuery.isLoading && !archivedQuery.data) {
    return (
      <LoadingStateBlock
        eyebrow={title}
        title="Arxiv yuklanmoqda"
        description="Arxivlangan mijozlar ro'yxati yuklanmoqda..."
      />
    )
  }

  if (archivedQuery.isError && !archivedQuery.data) {
    return (
      <ErrorStateBlock
        eyebrow={title}
        title="Arxiv yuklanmadi"
        description="Arxivlangan mijozlar ro'yxatini yuklashda xato yuz berdi."
        actionLabel={t('common.retry')}
        onAction={() => void archivedQuery.refetch()}
      />
    )
  }

  return (
    <section className="page-enter space-y-[18px]">
      <PageHeader
        eyebrow={title}
        title="Arxiv"
        description="Arxivlangan mijozlar. Tiklash yoki butunlay o'chirish mumkin."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(routeBasePath)}
            >
              {t('customers.detail.back_to', 'Back to {{title}}', { title })}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void archivedQuery.refetch()}
            >
              {t('common.refresh')}
            </Button>
            {selectedIds.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleBulkDelete()}
                loading={isBulkDeleting}
              >
                {selectedIds.length} ta ni o'chirish
              </Button>
            )}
          </>
        }
      />

      <Card noPadding>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Arxivlangan mijozlar</CardTitle>
          <Badge variant="secondary">{customers.length} ta</Badge>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <EmptyStateBlock
              eyebrow={title}
              title="Arxiv bo'sh"
              description="Hozircha arxivlangan mijozlar yo'q."
              className="rounded-[18px]"
            />
          ) : (
            <DataTable
              caption="Arxivlangan mijozlar"
              rows={customers}
              getRowKey={(row) => String(row.id)}
              columns={[
                {
                  key: 'select',
                  header: (
                    <Checkbox
                      size="sm"
                      checked={selectedIds.length === customers.length && customers.length > 0}
                      onChange={toggleAll}
                    />
                  ),
                  width: '40px',
                  render: (row) => (
                    <Checkbox
                      size="sm"
                      checked={selectedIds.includes(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ),
                },
                {
                  key: 'name',
                  header: t('customers.table.name', 'Name'),
                  render: (row) => (
                    <span className="font-semibold text-[var(--foreground)]">
                      {getCustomerDisplayName(row)}
                    </span>
                  ),
                },
                {
                  key: 'platform',
                  header: t('customers.table.platform', 'Platform'),
                  render: (row) => row.platform ?? '-',
                },
                {
                  key: 'phone',
                  header: t('customers.table.phone', 'Phone'),
                  render: (row) => row.phone_number ?? row.phone ?? '-',
                },
                {
                  key: 'status',
                  header: t('customers.table.status', 'Status'),
                  render: (row) => (
                    <Badge variant="secondary">{row.status}</Badge>
                  ),
                },
                {
                  key: 'created_at',
                  header: t('common.created', 'Created'),
                  render: (row) => formatShortDate(row.created_at),
                },
                {
                  key: 'actions',
                  header: t('customers.table.actions', 'Actions'),
                  render: (row) => (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <IconButton label="Tiklash" size="sm" className={restoreButtonClass} onClick={() => void handleRestore(row)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 7v6h6"/><path d="M3 13C3 8.029 7.029 4 12 4a9 9 0 0 1 9 9 9 9 0 0 1-9 9 9.003 9.003 0 0 1-8.1-5.1"/></svg>
                      </IconButton>
                      <IconButton label="Butunlay o'chirish" size="sm" className={deleteButtonClass} onClick={() => void handleHardDelete(row)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </IconButton>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </section>
  )
}
