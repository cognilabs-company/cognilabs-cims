import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ceoService, type CeoUserRecord, type CompanyPaymentRecord } from '../../../shared/api/services/ceo.service'
import { projectsService, type UserOpenCardRecord } from '../../../shared/api/services/projects.service'
import type { PaymentItem } from '../../../shared/api/types'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { formatCurrency, formatShortDate, formatShortDateTime } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { Badge } from '../../../shared/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card'
import { ActionsMenu } from '../../../shared/ui/actions-menu'
import { DataTable } from '../../../shared/ui/data-table'
import { Dialog } from '../../../shared/ui/dialog'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { CrmDashboardCharts } from '../../crm/components/CrmDashboardCharts'
import { MessageComposerModal, type MessageComposerValues } from '../components/MessageComposerModal'
import { PaymentFormModal, type PaymentFormValues } from '../components/PaymentFormModal'
import { CompanyPaymentFormModal, type CompanyPaymentFormValues } from '../components/CompanyPaymentFormModal'
import { WorkdayOverrideFormDialog } from '../components/WorkdayOverrideFormDialog'
import { crmService } from '../../../shared/api/services/crm.service'
import { Avatar } from '../../projects/components/Avatar'
import { isDueDateOverdue } from '../../projects/lib/format'

const initialBroadcastMessage: MessageComposerValues = {
  subject: '',
  body: '',
}

const initialPaymentForm: PaymentFormValues = {
  project: '',
  date: new Date().toISOString().slice(0, 10),
  summ: 0,
  payment: false,
}

const initialCompanyPaymentForm: CompanyPaymentFormValues = {
  title: '',
  amount: 0,
  paymentDay: 1,
  paymentTime: '10:00',
  note: '',
  isActive: true,
}

const emptyPayments: PaymentItem[] = []
const emptyCompanyPayments: CompanyPaymentRecord[] = []
const emptyUsers: CeoUserRecord[] = []
const emptyUserTasks: UserOpenCardRecord[] = []
const doneColumnNamePattern = /\b(done|complete|completed|closed|finished|resolved)\b/i

function isDoneTask(task: Pick<UserOpenCardRecord, 'column_name'>) {
  return doneColumnNamePattern.test(task.column_name.trim())
}

function filterOpenTasks(tasks: UserOpenCardRecord[]) {
  return tasks.filter((task) => !isDoneTask(task))
}

function getTaskPath(task: UserOpenCardRecord) {
  return `/projects/${task.project_id}?board=${task.board_id}&card=${task.id}`
}

export function CeoDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { confirm } = useConfirm()

  const dashboardQuery = useAsyncData(() => ceoService.getDashboard(), [])
  const paymentsQuery = useAsyncData(() => ceoService.listPayments(), [])
  const companyPaymentsQuery = useAsyncData(() => ceoService.listCompanyPayments(), [])
  const [chartCustomerType, setChartCustomerType] = useState('')
  const chartsQuery = useAsyncData(
    async () => {
      const selectedCustomerType = chartCustomerType || undefined
      const [weekly, monthly] = await Promise.all([
        crmService.salesDashboardCharts({
          days: 7,
          customer_type: selectedCustomerType,
          platform_limit: 8,
        }),
        crmService.salesDashboardCharts({
          days: 30,
          customer_type: selectedCustomerType,
          platform_limit: 10,
        }),
      ])

      return { weekly, monthly }
    },
    [chartCustomerType],
  )

  const [broadcastValues, setBroadcastValues] = useState<MessageComposerValues>(initialBroadcastMessage)
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false)
  const [isBroadcastSubmitting, setIsBroadcastSubmitting] = useState(false)

  const [paymentValues, setPaymentValues] = useState<PaymentFormValues>(initialPaymentForm)
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false)

  const [companyPaymentValues, setCompanyPaymentValues] = useState<CompanyPaymentFormValues>(initialCompanyPaymentForm)
  const [selectedCompanyPayment, setSelectedCompanyPayment] = useState<CompanyPaymentRecord | null>(null)
  const [isCompanyPaymentOpen, setIsCompanyPaymentOpen] = useState(false)
  const [isCompanyPaymentSubmitting, setIsCompanyPaymentSubmitting] = useState(false)
  const [companyPaymentMode, setCompanyPaymentMode] = useState<'create' | 'edit'>('create')
  const [isOverrideOpen, setIsOverrideOpen] = useState(false)

  // Task overview state
  const [userTaskCounts, setUserTaskCounts] = useState<Record<number, number>>({})
  const [isLoadingTaskCounts, setIsLoadingTaskCounts] = useState(false)
  const [selectedTaskUserId, setSelectedTaskUserId] = useState<number | null>(null)
  const [userTasksData, setUserTasksData] = useState<UserOpenCardRecord[]>(emptyUserTasks)
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [isLoadingUserTasks, setIsLoadingUserTasks] = useState(false)
  const [isCompletingTaskId, setIsCompletingTaskId] = useState<number | null>(null)

  const payments = paymentsQuery.data?.payments ?? emptyPayments
  const companyPayments = companyPaymentsQuery.data?.payments ?? emptyCompanyPayments
  const users = dashboardQuery.data?.users ?? emptyUsers
  const selectedUser = users.find((u) => u.id === selectedTaskUserId)

  // Load task counts for all users when dashboard data loads
  useEffect(() => {
    let cancelled = false

    async function loadTaskCounts() {
      if (users.length === 0) {
        if (!cancelled) {
          setUserTaskCounts({})
          setIsLoadingTaskCounts(false)
        }
        return
      }

      if (!cancelled) {
        setIsLoadingTaskCounts(true)
      }

      const userIds = users.map((u) => u.id)

      try {
        const results = await Promise.allSettled(userIds.map((userId) => projectsService.listUserOpenCards(userId)))

        if (cancelled) {
          return
        }

        const counts: Record<number, number> = {}
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            counts[userIds[idx]] = filterOpenTasks(result.value.cards).length
          }
        })
        setUserTaskCounts(counts)
      } finally {
        if (!cancelled) {
          setIsLoadingTaskCounts(false)
        }
      }
    }

    void loadTaskCounts()

    return () => {
      cancelled = true
    }
  }, [users])

  async function loadUserTasks(userId: number) {
    const result = await projectsService.listUserOpenCards(userId)
    return filterOpenTasks(result.cards)
  }

  async function handleOpenUserTasks(userId: number) {
    setSelectedTaskUserId(userId)
    setIsTaskDialogOpen(true)
    setIsLoadingUserTasks(true)
    setUserTasksData(emptyUserTasks)

    try {
      const tasks = await loadUserTasks(userId)
      setUserTasksData(tasks)
    } catch {
      setUserTasksData(emptyUserTasks)
    } finally {
      setIsLoadingUserTasks(false)
    }
  }

  function handleCloseTaskDialog() {
    setIsTaskDialogOpen(false)
    setSelectedTaskUserId(null)
    setUserTasksData(emptyUserTasks)
    setIsCompletingTaskId(null)
  }

  async function refreshCurrentUserTasks() {
    if (selectedTaskUserId === null) {
      return
    }

    setIsLoadingUserTasks(true)

    try {
      const tasks = await loadUserTasks(selectedTaskUserId)
      setUserTasksData(tasks)
    } catch {
      setUserTasksData(emptyUserTasks)
    } finally {
      setIsLoadingUserTasks(false)
    }
  }

  async function refreshTaskCounts() {
    if (users.length === 0) {
      setUserTaskCounts({})
      return
    }

    const userIds = users.map((u) => u.id)
    const results = await Promise.allSettled(userIds.map((userId) => projectsService.listUserOpenCards(userId)))
    const counts: Record<number, number> = {}

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        counts[userIds[idx]] = filterOpenTasks(result.value.cards).length
      }
    })

    setUserTaskCounts(counts)
  }

  async function handleMarkTaskDone(task: UserOpenCardRecord) {
    if (isCompletingTaskId !== null) {
      return
    }

    setIsCompletingTaskId(task.id)

    try {
      const board = await projectsService.getBoard(task.board_id)
      const doneColumn = board.columns.find((column) => doneColumnNamePattern.test(column.name.trim()))

      if (!doneColumn) {
        showToast({
          title: t('ceo.dashboard.tasks.done_column_missing_title', 'Done column not found'),
          description: t('ceo.dashboard.tasks.done_column_missing_description', 'This board does not have a Done column.'),
          tone: 'error',
        })
        return
      }

      await projectsService.moveCard(task.id, doneColumn.id, doneColumn.cards.length)

      await Promise.allSettled([
        refreshTaskCounts(),
        selectedTaskUserId !== null ? refreshCurrentUserTasks() : Promise.resolve(),
      ])

      showToast({
        title: t('ceo.dashboard.tasks.mark_done_title', 'Task marked as done'),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: t('ceo.dashboard.tasks.mark_done_failed_title', 'Failed to mark task as done'),
        description: error instanceof Error ? error.message : t('common.try_again', 'Please try again'),
        tone: 'error',
      })
    } finally {
      setIsCompletingTaskId(null)
    }
  }

  async function refreshAll() {
    await Promise.allSettled([
      dashboardQuery.refetch(),
      paymentsQuery.refetch(),
      companyPaymentsQuery.refetch(),
      chartsQuery.refetch(),
    ])
  }

  async function handleSendBroadcast() {
    if (!broadcastValues.subject.trim() || !broadcastValues.body.trim()) {
      showToast({
        title: t('ceo.dashboard.validation.broadcast_title'),
        description: t('ceo.dashboard.validation.broadcast_description'),
        tone: 'error',
      })
      return
    }

    setIsBroadcastSubmitting(true)

    try {
      await ceoService.sendMessageToAll({
        subject: broadcastValues.subject.trim(),
        body: broadcastValues.body.trim(),
      })
      await dashboardQuery.refetch()
      setBroadcastValues(initialBroadcastMessage)
      setIsBroadcastOpen(false)
      showToast({
        title: t('ceo.dashboard.toast.broadcast_sent_title'),
        description: t('ceo.dashboard.toast.broadcast_sent_description'),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: t('ceo.dashboard.toast.broadcast_failed_title'),
        description: error instanceof Error ? error.message : t('ceo.dashboard.toast.broadcast_failed_description'),
        tone: 'error',
      })
    } finally {
      setIsBroadcastSubmitting(false)
    }
  }

  async function handleSubmitPayment() {
    if (!paymentValues.project.trim() || !paymentValues.date.trim()) {
      showToast({
        title: t('ceo.dashboard.validation.payment_title'),
        description: t('ceo.dashboard.validation.payment_description'),
        tone: 'error',
      })
      return
    }

    setIsPaymentSubmitting(true)

    try {
      if (!selectedPayment) {
        await ceoService.createPayment({
          project: paymentValues.project.trim(),
          date: paymentValues.date,
          summ: Number(paymentValues.summ),
          payment: paymentValues.payment,
        })
      } else {
        await ceoService.updatePayment(selectedPayment.id, {
          project: paymentValues.project.trim(),
          date: paymentValues.date || null,
          summ: Number(paymentValues.summ),
          payment: paymentValues.payment,
        })
      }

      await paymentsQuery.refetch()
      setIsPaymentOpen(false)
      showToast({
        title: !selectedPayment
          ? t('ceo.dashboard.toast.payment_created_title')
          : t('ceo.dashboard.toast.payment_updated_title'),
        description: t('ceo.dashboard.toast.payment_saved_description'),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: t('ceo.dashboard.toast.payment_failed_title'),
        description: error instanceof Error ? error.message : t('ceo.dashboard.toast.payment_failed_description'),
        tone: 'error',
      })
    } finally {
      setIsPaymentSubmitting(false)
    }
  }

  async function handleSubmitCompanyPayment() {
    if (!companyPaymentValues.title.trim()) {
      showToast({
        title: t('ceo.dashboard.validation.reminder_title'),
        description: t('ceo.dashboard.validation.reminder_description'),
        tone: 'error',
      })
      return
    }

    setIsCompanyPaymentSubmitting(true)

    try {
      const payload = {
        title: companyPaymentValues.title.trim(),
        amount: Number(companyPaymentValues.amount),
        payment_day: Number(companyPaymentValues.paymentDay),
        payment_time: companyPaymentValues.paymentTime,
        note: companyPaymentValues.note.trim() || undefined,
        is_active: companyPaymentValues.isActive,
      }

      if (companyPaymentMode === 'create') {
        await ceoService.createCompanyPayment(payload)
      } else if (selectedCompanyPayment) {
        await ceoService.updateCompanyPayment(selectedCompanyPayment.id, payload)
      }

      await companyPaymentsQuery.refetch()
      setIsCompanyPaymentOpen(false)
      showToast({
        title: companyPaymentMode === 'create'
          ? t('ceo.dashboard.toast.reminder_created_title')
          : t('ceo.dashboard.toast.reminder_updated_title'),
        description: t('ceo.dashboard.toast.reminder_saved_description'),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: t('ceo.dashboard.toast.reminder_failed_title'),
        description: error instanceof Error ? error.message : t('ceo.dashboard.toast.reminder_failed_description'),
        tone: 'error',
      })
    } finally {
      setIsCompanyPaymentSubmitting(false)
    }
  }

  function openCreatePaymentModal() {
    setSelectedPayment(null)
    setPaymentValues(initialPaymentForm)
    setIsPaymentOpen(true)
  }

  function openEditPaymentModal(payment: PaymentItem) {
    setSelectedPayment(payment)
    setPaymentValues({
        project: payment.project ?? '',
        date: payment.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        summ: Number(payment.summ ?? 0),
        payment: Boolean(payment.payment),
    })
    setIsPaymentOpen(true)
  }

  function openCreateCompanyPaymentModal() {
    setCompanyPaymentMode('create')
    setSelectedCompanyPayment(null)
    setCompanyPaymentValues(initialCompanyPaymentForm)
    setIsCompanyPaymentOpen(true)
  }

  function openEditCompanyPaymentModal(payment: CompanyPaymentRecord) {
    setCompanyPaymentMode('edit')
    setSelectedCompanyPayment(payment)
    setCompanyPaymentValues({
      title: payment.title,
      amount: payment.amount,
      paymentDay: payment.payment_day,
      paymentTime: payment.payment_time,
      note: payment.note ?? '',
      isActive: payment.is_active,
    })
    setIsCompanyPaymentOpen(true)
  }

  async function handleTogglePayment(payment: PaymentItem) {
    try {
      await ceoService.togglePayment(payment.id)
      await paymentsQuery.refetch()
      showToast({
        title: t('ceo.dashboard.toast.payment_status_title'),
        description: t('ceo.dashboard.toast.payment_status_description', { project: payment.project }),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: t('ceo.dashboard.toast.payment_toggle_failed_title'),
        description: error instanceof Error ? error.message : t('ceo.dashboard.toast.payment_toggle_failed_description'),
        tone: 'error',
      })
    }
  }

  async function handleDeletePayment(payment: PaymentItem) {
    const approved = await confirm({
      title: t('ceo.dashboard.confirm.payment_delete_title', { project: payment.project }),
      description: t('ceo.dashboard.confirm.payment_delete_description'),
      confirmLabel: t('ceo.dashboard.confirm.payment_delete_confirm'),
      cancelLabel: t('common.cancel'),
      tone: 'danger',
    })

    if (!approved) {
      return
    }

    try {
      await ceoService.deletePayment(payment.id)
      await paymentsQuery.refetch()
      showToast({
        title: t('ceo.dashboard.toast.payment_deleted_title'),
        description: t('ceo.dashboard.toast.payment_deleted_description'),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: t('ceo.dashboard.toast.payment_delete_failed_title'),
        description: error instanceof Error ? error.message : t('ceo.dashboard.toast.payment_delete_failed_description'),
        tone: 'error',
      })
    }
  }

  async function handleDeleteCompanyPayment(payment: CompanyPaymentRecord) {
    const approved = await confirm({
      title: t('ceo.dashboard.confirm.reminder_delete_title').replace('{{title}}', payment.title),
      description: t('ceo.dashboard.confirm.reminder_delete_description'),
      confirmLabel: t('ceo.dashboard.confirm.reminder_delete_confirm'),
      cancelLabel: t('common.cancel'),
      tone: 'danger',
    })

    if (!approved) {
      return
    }

    try {
      await ceoService.deleteCompanyPayment(payment.id)
      await companyPaymentsQuery.refetch()
      showToast({
        title: t('ceo.dashboard.toast.reminder_deleted_title'),
        description: t('ceo.dashboard.toast.reminder_deleted_description'),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: t('ceo.dashboard.toast.reminder_delete_failed_title'),
        description: error instanceof Error ? error.message : t('ceo.dashboard.toast.reminder_delete_failed_description'),
        tone: 'error',
      })
    }
  }

  if (dashboardQuery.isLoading && !dashboardQuery.data) {
    return (
      <LoadingStateBlock
        eyebrow={t('ceo.dashboard.header.eyebrow', 'CEO Workspace')}
        title={t('ceo.dashboard.loading.title')}
        description={t('ceo.dashboard.loading.description')}
      />
    )
  }

  if (dashboardQuery.isError && !dashboardQuery.data) {
    return (
      <ErrorStateBlock
        eyebrow={t('ceo.dashboard.header.eyebrow', 'CEO Workspace')}
        title={t('ceo.dashboard.error.title')}
        description={t('ceo.dashboard.error.description')}
        actionLabel={t('common.retry')}
        onAction={() => {
          void refreshAll()
        }}
      />
    )
  }

  return (
    <section className="space-y-4">
      <CrmDashboardCharts
        weekly={chartsQuery.data?.weekly}
        monthly={chartsQuery.data?.monthly}
        customerType={chartCustomerType}
        onCustomerTypeChange={setChartCustomerType}
        isLoading={chartsQuery.isLoading}
        isError={chartsQuery.isError}
        onRetry={() => {
          void chartsQuery.refetch()
        }}
        headerActions={
          <ActionsMenu
            label={t('common.actions')}
            items={[
              {
                label: t('common.refresh'),
                icon: (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5">
                    <path d="M1.84998 7.46254C1.84998 4.3586 4.37103 1.83754 7.47498 1.83754C8.91301 1.83754 10.2222 2.37681 11.218 3.26444L10.375 4.10744C10.2773 4.20517 10.2773 4.36346 10.375 4.46119C10.4727 4.55892 10.631 4.55892 10.7287 4.46119L12.1287 3.06119C12.2264 2.96346 12.2264 2.80517 12.1287 2.70744L10.7287 1.30744C10.631 1.20971 10.4727 1.20971 10.375 1.30744C10.2773 1.40517 10.2773 1.56346 10.375 1.66119L11.0821 2.36831C10.1064 1.5034 8.8507 0.987539 7.47498 0.987539C3.90164 0.987539 1 3.88918 1 7.46254C1 11.0359 3.90164 13.9375 7.47498 13.9375C11.0483 13.9375 13.95 11.0359 13.95 7.46254H13.1C13.1 10.5665 10.579 13.0875 7.47498 13.0875C4.37103 13.0875 1.84998 10.5665 1.84998 7.46254Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                  </svg>
                ),
                onSelect: () => void refreshAll(),
              },
              {
                label: t('ceo.dashboard.actions.send_broadcast'),
                icon: (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5">
                    <path d="M1.20308 1.04312C1.17743 1.0114 1.14304 0.998483 1.10954 1.0003C1.07604 1.00212 1.0428 1.01861 1.02217 1.04482C1.00147 1.07112 0.993416 1.10425 0.99966 1.13524C1.0059 1.16623 1.02613 1.1942 1.05562 1.21175L13.8056 8.71175C13.8407 8.73238 13.8824 8.7332 13.918 8.71392C13.9536 8.69464 13.9774 8.65851 13.982 8.61802C13.9867 8.57753 13.9714 8.53924 13.9416 8.51478L1.20308 1.04312ZM1.00391 13.9961L1.00391 13.9961C1.00366 13.9961 1.00341 13.9961 1.00316 13.9961C0.96346 13.9959 0.925828 13.9782 0.90151 13.9482C0.877192 13.9182 0.868725 13.8791 0.878413 13.8423L2.24357 8.61833L8.00004 7.5L2.24357 6.38167L0.878413 1.15774C0.868725 1.1209 0.877192 1.08179 0.90151 1.05182C0.925828 1.02185 0.96346 1.00407 1.00316 1.00388C1.00341 1.00388 1.00366 1.00388 1.00391 1.00388C1.03664 1.00388 1.06913 1.01639 1.09241 1.03967L13.9124 13.8597C13.9405 13.8878 13.9536 13.9261 13.9479 13.9649C13.9422 14.0037 13.9184 14.0372 13.8839 14.0551C13.8493 14.0729 13.8087 14.0726 13.7744 14.0543L1.00391 13.9961Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                  </svg>
                ),
                onSelect: () => setIsBroadcastOpen(true),
              },
              {
                label: t('ceo.dashboard.actions.create_payment'),
                icon: (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5">
                    <path d="M7.5 0.75C3.77208 0.75 0.75 3.77208 0.75 7.5C0.75 11.2279 3.77208 14.25 7.5 14.25C11.2279 14.25 14.25 11.2279 14.25 7.5C14.25 3.77208 11.2279 0.75 7.5 0.75ZM7.5 1.75C4.32436 1.75 1.75 4.32436 1.75 7.5C1.75 10.6756 4.32436 13.25 7.5 13.25C10.6756 13.25 13.25 10.6756 13.25 7.5C13.25 4.32436 10.6756 1.75 7.5 1.75ZM7.5 4.5C7.77614 4.5 8 4.72386 8 5V7H10C10.2761 7 10.5 7.22386 10.5 7.5C10.5 7.77614 10.2761 8 10 8H8V10C8 10.2761 7.77614 10.5 7.5 10.5C7.22386 10.5 7 10.2761 7 10V8H5C4.72386 8 4.5 7.77614 4.5 7.5C4.5 7.22386 4.72386 7 5 7H7V5C7 4.72386 7.22386 4.5 7.5 4.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                  </svg>
                ),
                onSelect: openCreatePaymentModal,
              },
              {
                label: t('ceo.dashboard.recurring.create'),
                icon: (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5">
                    <path d="M7.5 0.75C3.77208 0.75 0.75 3.77208 0.75 7.5C0.75 11.2279 3.77208 14.25 7.5 14.25C11.2279 14.25 14.25 11.2279 14.25 7.5C14.25 3.77208 11.2279 0.75 7.5 0.75ZM7.5 1.75C4.32436 1.75 1.75 4.32436 1.75 7.5C1.75 10.6756 4.32436 13.25 7.5 13.25C10.6756 13.25 13.25 10.6756 13.25 7.5C13.25 4.32436 10.6756 1.75 7.5 1.75ZM7.5 4.5C7.77614 4.5 8 4.72386 8 5V7H10C10.2761 7 10.5 7.22386 10.5 7.5C10.5 7.77614 10.2761 8 10 8H8V10C8 10.2761 7.77614 10.5 7.5 10.5C7.22386 10.5 7 10.2761 7 10V8H5C4.72386 8 4.5 7.77614 4.5 7.5C4.5 7.22386 4.72386 7 5 7H7V5C7 4.72386 7.22386 4.5 7.5 4.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                  </svg>
                ),
                onSelect: openCreateCompanyPaymentModal,
              },
              {
                label: t('ceo.workday.dialog.create_action', { defaultValue: 'Create Override' }),
                icon: (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5">
                    <path d="M4.5 1C4.22386 1 4 1.22386 4 1.5C4 1.77614 4.22386 2 4.5 2H7V7H2V4.5C2 4.22386 1.77614 4 1.5 4C1.22386 4 1 4.22386 1 4.5V7.5C1 7.63807 1.05268 7.76321 1.14645 7.85355C1.23679 7.94732 1.36193 8 1.5 8H7V13.5C7 13.7761 7.22386 14 7.5 14C7.77614 14 8 13.7761 8 13.5V8H13.5C13.7761 8 14 7.77614 14 7.5C14 7.22386 13.7761 7 13.5 7H8V2H10.5C10.7761 2 11 1.77614 11 1.5C11 1.22386 10.7761 1 10.5 1H4.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                  </svg>
                ),
                onSelect: () => setIsOverrideOpen(true),
              },
            ]}
          />
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Task Overview */}
        <Card noPadding>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>{t('ceo.dashboard.tasks.title', 'Task Overview')}</CardTitle>
            <Badge variant="blue" dot>
              {t('ceo.dashboard.tasks.user_count', { count: users.filter((u) => u.is_active).length, defaultValue: '{{count}} users' })}
            </Badge>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <EmptyStateBlock
                eyebrow={t('ceo.dashboard.header.eyebrow', 'CEO Workspace')}
                title={t('ceo.dashboard.tasks.empty_users', 'No users found')}
              />
            ) : (
              <div className="grid grid-cols-2 gap-2 py-1 sm:grid-cols-3">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => void handleOpenUserTasks(user.id)}
                    className="flex flex-col items-center gap-2 rounded-xl border border-(--border) bg-(--accent-soft)/20 p-3 text-center transition-colors hover:border-(--border-active,var(--border)) hover:bg-(--accent-soft)"
                  >
                    <Avatar
                      name={user.name}
                      surname={user.surname}
                      imageUrl={(user.profile_image as string | null | undefined) ?? null}
                      size="lg"
                    />
                    <div className="w-full min-w-0">
                      <p className="truncate text-sm font-semibold leading-snug">
                        {user.name} {user.surname}
                      </p>
                      {user.job_title && (
                        <p className="mt-0.5 truncate text-xs text-(--muted)">{user.job_title as string}</p>
                      )}
                      <div className="mt-1.5 flex justify-center">
                        {isLoadingTaskCounts ? (
                          <Badge variant="outline" size="sm">...</Badge>
                        ) : (
                          <Badge
                            variant={userTaskCounts[user.id] ? 'warning' : 'outline'}
                            dot={Boolean(userTaskCounts[user.id])}
                            size="sm"
                          >
                            {userTaskCounts[user.id] ?? 0} {t('ceo.dashboard.tasks.task_label', 'task')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column: Company Payment Reminders + CEO Payment List */}
        <div className="flex flex-col gap-4">
          <Card noPadding>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle>{t('ceo.dashboard.recurring.title')}</CardTitle>
              </div>
              <Badge variant="blue" dot>
                {formatCurrency(companyPaymentsQuery.data?.totalAmount || 0)}
              </Badge>
            </CardHeader>
            <CardContent>
              <DataTable
                caption={t('ceo.dashboard.recurring.title')}
                rows={companyPayments}
                getRowKey={(row) => String(row.id)}
                zebra
                emptyState={
                  <EmptyStateBlock
                    eyebrow={t('ceo.dashboard.header.eyebrow', 'CEO Workspace')}
                    title={t('ceo.dashboard.recurring.empty_title')}
                  />
                }
                columns={[
                  {
                    key: 'title',
                    header: t('ceo.recurring.form.title'),
                    render: (row) => (
                      <div>
                        <p className="font-semibold text-white">{row.title}</p>
                        {row.note && <p className="mt-1 text-xs text-(--muted) line-clamp-1">{row.note}</p>}
                      </div>
                    ),
                  },
                  {
                    key: 'amount',
                    header: t('ceo.recurring.form.amount'),
                    align: 'right',
                    render: (row) => formatCurrency(row.amount),
                  },
                  {
                    key: 'day',
                    header: t('ceo.recurring.form.payment_day'),
                    align: 'center',
                    render: (row) => (
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-bold text-blue-400">{row.payment_day}</span>
                        <span className="text-[10px] uppercase text-(--muted)">{row.payment_time}</span>
                      </div>
                    ),
                  },
                  {
                    key: 'status',
                    header: t('common.status'),
                    render: (row) => (
                      <Badge variant={row.is_active ? 'success' : 'outline'}>
                        {row.is_active ? t('status.active') : t('status.inactive')}
                      </Badge>
                    ),
                  },
                  {
                    key: 'actions',
                    header: t('common.actions'),
                    render: (row) => (
                      <div className="flex items-center gap-1">
                        <button type="button" title={t('common.edit')} onClick={() => openEditCompanyPaymentModal(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button type="button" title={t('customers.actions.delete')} onClick={() => void handleDeleteCompanyPayment(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>

          <Card noPadding>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>{t('ceo.dashboard.payments.title')}</CardTitle>
              <div className="flex wrap gap-2">
                <Badge variant="success" dot>
                  {t('ceo.dashboard.payments.paid_count', { count: payments.filter((row) => row.payment).length })}
                </Badge>
                <Badge variant="warning" dot pulse={payments.some((row) => !row.payment)}>
                  {t('ceo.dashboard.payments.pending_count', { count: payments.filter((row) => !row.payment).length })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                caption={t('ceo.dashboard.payments.title')}
                rows={payments}
                getRowKey={(row) => String(row.id)}
                zebra
                emptyState={
                  <EmptyStateBlock
                    eyebrow={t('ceo.dashboard.header.eyebrow', 'CEO Workspace')}
                    title={t('ceo.dashboard.payments.empty_title')}
                  />
                }
                columns={[
                  {
                    key: 'project',
                    header: t('ceo.dashboard.table.project'),
                    render: (row) => row.project,
                  },
                  {
                    key: 'date',
                    header: t('ceo.dashboard.table.date'),
                    render: (row) => (row.date ? formatShortDate(row.date) : '-'),
                  },
                  {
                    key: 'amount',
                    header: t('ceo.dashboard.table.amount'),
                    align: 'right',
                    render: (row) => formatCurrency(Number(row.summ ?? 0)),
                  },
                  {
                    key: 'status',
                    header: t('common.status'),
                    render: (row) => (
                      <Badge variant={row.payment ? 'success' : 'warning'} dot pulse={!row.payment}>
                        {row.payment ? t('status.paid') : t('status.pending')}
                      </Badge>
                    ),
                  },
                  {
                    key: 'actions',
                    header: t('common.actions'),
                    render: (row) => (
                      <div className="flex items-center gap-1">
                        <button type="button" title={t('common.edit')} onClick={() => openEditPaymentModal(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button type="button" title={t('ceo.dashboard.actions.toggle')} onClick={() => void handleTogglePayment(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                        </button>
                        <button type="button" title={t('customers.actions.delete')} onClick={() => void handleDeletePayment(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Instagram Media Funnel */}
      {dashboardQuery.data?.statistics?.instagram_media_posts !== undefined && (
        <Card noPadding>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Instagram Media Funnel</CardTitle>
            <Badge variant="blue" dot>
              {dashboardQuery.data.statistics.instagram_media_posts.length} media
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {([
                { label: 'Jami yuborildi', value: dashboardQuery.data.statistics.instagram_media_total_sent_count ?? 0, color: 'text-blue-400' },
                { label: 'Jami lead', value: dashboardQuery.data.statistics.instagram_media_total_lead_count ?? 0, color: 'text-emerald-400' },
                { label: 'Contacted', value: dashboardQuery.data.statistics.instagram_media_total_contacted_count ?? 0, color: 'text-sky-400' },
                { label: 'Continuing', value: dashboardQuery.data.statistics.instagram_media_total_continuing_count ?? 0, color: 'text-violet-400' },
                { label: 'Noaniq yuborildi', value: dashboardQuery.data.statistics.instagram_media_unknown_sent_count ?? 0, color: 'text-amber-400' },
                { label: 'Noaniq lead', value: dashboardQuery.data.statistics.instagram_media_unknown_lead_count ?? 0, color: 'text-orange-400' },
              ] as const).map((item) => (
                <div key={item.label} className="rounded-xl border border-(--border) bg-(--accent-soft)/30 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--muted)">{item.label}</p>
                  <p className={`mt-2 text-2xl font-semibold leading-none ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
            {dashboardQuery.data.statistics.instagram_media_posts.length === 0 ? (
              <p className="py-4 text-center text-sm text-(--muted)">Hali media context qo'shilmagan.</p>
            ) : (
              <>
                {(dashboardQuery.data.statistics.instagram_media_unknown_sent_count ?? 0) > 0 && (
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                    Ba'zi Instagram media xabarlari contextga bog'lanmagan. Media Contexts sahifasidan post/reel/story link qo'shing.
                  </p>
                )}
                <DataTable
                  caption="Instagram media posts"
                  rows={dashboardQuery.data.statistics.instagram_media_posts}
                  getRowKey={(row) => String(row.post_id)}
                  zebra
                  emptyState={<EmptyStateBlock eyebrow="CEO Workspace" title="No media" />}
                  columns={[
                    {
                      key: 'title',
                      header: 'Post',
                      render: (row) => (
                        <div className="min-w-0">
                          <p className="font-semibold text-white text-sm truncate">{row.title}</p>
                          <p className="text-xs text-(--muted) capitalize">{row.media_type}</p>
                        </div>
                      ),
                    },
                    { key: 'sent', header: 'Yuborildi', align: 'center', render: (row) => <span className="font-semibold text-blue-400">{row.sent_count}</span> },
                    { key: 'leads', header: 'Lead', align: 'center', render: (row) => <span className="font-semibold text-emerald-400">{row.lead_count}</span> },
                    { key: 'contacted', header: 'Contacted', align: 'center', render: (row) => <span className="font-semibold text-sky-400">{row.contacted_count}</span> },
                    { key: 'continuing', header: 'Continuing', align: 'center', render: (row) => <span className="font-semibold text-violet-400">{row.continuing_count}</span> },
                    {
                      key: 'conversion',
                      header: 'Conversion',
                      align: 'right',
                      render: (row) => {
                        const pct = row.sent_count > 0 ? ((row.lead_count / row.sent_count) * 100).toFixed(1) : '0.0'
                        return <span className="font-semibold text-emerald-400">{pct}%</span>
                      },
                    },
                    {
                      key: 'link',
                      header: '',
                      render: (row) => (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-(--muted) hover:text-blue-400 transition-colors underline-offset-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Instagram
                        </a>
                      ),
                    },
                  ]}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lead Response Metrics */}
      {(dashboardQuery.data?.statistics?.lead_response_total_count ?? 0) > 0 && (
        <Card noPadding>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Lead Javob Vaqti</CardTitle>
            <Badge variant="blue" dot>
              SLA: {dashboardQuery.data?.statistics?.lead_response_limit_minutes ?? 5} min
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {([
                { label: 'Jami lead', value: dashboardQuery.data?.statistics?.lead_response_total_count ?? 0, color: 'text-blue-400', border: 'border-blue-500/20' },
                { label: "O'z vaqtida", value: dashboardQuery.data?.statistics?.lead_response_on_time_count ?? 0, color: 'text-emerald-400', border: 'border-emerald-500/20' },
                { label: 'Kech boglanildi', value: dashboardQuery.data?.statistics?.lead_response_late_count ?? 0, color: 'text-red-400', border: 'border-red-500/20' },
                { label: "Status o'zgarmadi", value: dashboardQuery.data?.statistics?.lead_response_no_status_change_count ?? 0, color: 'text-amber-400', border: 'border-amber-500/20' },
                { label: 'Note yozilgan', value: dashboardQuery.data?.statistics?.lead_response_note_written_count ?? 0, color: 'text-sky-400', border: 'border-sky-500/20' },
                { label: 'Note yozilmagan', value: dashboardQuery.data?.statistics?.lead_response_note_missing_count ?? 0, color: 'text-orange-400', border: 'border-orange-500/20' },
                { label: 'Note yoqsiz status', value: dashboardQuery.data?.statistics?.lead_response_status_changed_without_note_count ?? 0, color: 'text-fuchsia-400', border: 'border-fuchsia-500/20' },
                { label: "O'rtacha vaqt", value: dashboardQuery.data?.statistics?.lead_response_average_human ?? '-', color: 'text-violet-400', border: 'border-violet-500/20' },
              ] as const).map((item) => (
                <div key={item.label} className={`rounded-xl border ${item.border} bg-(--accent-soft)/20 px-4 py-3`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--muted)">{item.label}</p>
                  <p className={`mt-2 text-xl font-semibold leading-none ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task list dialog */}
      <Dialog
        open={isTaskDialogOpen}
        onClose={handleCloseTaskDialog}
        title={
          selectedUser
            ? `${selectedUser.name} ${selectedUser.surname}`
            : t('ceo.dashboard.tasks.dialog_title', 'Tasks')
        }
        description={t('ceo.dashboard.tasks.dialog_desc', 'Open tasks (To-Do list)')}
        size="lg"
      >
        {isLoadingUserTasks ? (
          <div className="flex items-center justify-center py-10 text-sm text-(--muted)">
            {t('common.loading', 'Loading...')}
          </div>
        ) : userTasksData.length === 0 ? (
          <div className="py-10 text-center text-sm text-(--muted)">
            {t('ceo.dashboard.tasks.no_tasks', 'No open tasks')}
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {userTasksData.map((task) => {
              const isOverdue = isDueDateOverdue(task.due_date)
              return (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(getTaskPath(task))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      navigate(getTaskPath(task))
                    }
                  }}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-(--border) p-3 text-left transition-colors hover:bg-(--accent-soft)/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleMarkTaskDone(task)
                    }}
                    onMouseDown={(event) => {
                      event.stopPropagation()
                    }}
                    disabled={isCompletingTaskId === task.id}
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-(--border) text-green-400 transition-colors hover:border-green-400 hover:bg-green-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={t('ceo.dashboard.tasks.mark_done', 'Mark task as done')}
                    title={t('ceo.dashboard.tasks.mark_done', 'Mark task as done')}
                  >
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">{task.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-(--muted)">
                      <span>{task.project_name}</span>
                      <span>·</span>
                      <span>{task.column_name}</span>
                      {task.due_date && (
                        <>
                          <span>·</span>
                          <span className={isOverdue ? 'text-red-400' : ''}>
                            {formatShortDateTime(task.due_date)}
                            {isOverdue ? ` (${t('ceo.dashboard.tasks.overdue', 'overdue')})` : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {task.priority && (
                    <Badge
                      variant={
                        task.priority === 'urgent' ? 'danger' :
                        task.priority === 'high' ? 'warning' :
                        'outline'
                      }
                      size="sm"
                      className="shrink-0"
                    >
                      {task.priority}
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Dialog>

      <MessageComposerModal
        open={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
        values={broadcastValues}
        isBroadcast
        isSubmitting={isBroadcastSubmitting}
        onChange={(field, value) =>
          setBroadcastValues((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onSubmit={() => void handleSendBroadcast()}
      />

      <PaymentFormModal
        open={isPaymentOpen}
        mode={selectedPayment ? 'edit' : 'create'}
        values={paymentValues}
        onClose={() => setIsPaymentOpen(false)}
        onChange={(field, value) =>
          setPaymentValues((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onSubmit={() => void handleSubmitPayment()}
        isSubmitting={isPaymentSubmitting}
      />

      <CompanyPaymentFormModal
        open={isCompanyPaymentOpen}
        mode={companyPaymentMode}
        values={companyPaymentValues}
        onClose={() => setIsCompanyPaymentOpen(false)}
        onChange={(field, value) =>
          setCompanyPaymentValues((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onSubmit={() => void handleSubmitCompanyPayment()}
        isSubmitting={isCompanyPaymentSubmitting}
      />
      <WorkdayOverrideFormDialog
        open={isOverrideOpen}
        onClose={() => setIsOverrideOpen(false)}
      />
    </section>
  )
}
