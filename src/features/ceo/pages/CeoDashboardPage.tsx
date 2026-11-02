import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ceoService, type CeoUserRecord, type CompanyPaymentRecord, type DashboardResponse } from '../../../shared/api/services/ceo.service'
import { projectsService, type UserOpenCardRecord } from '../../../shared/api/services/projects.service'
import type { PaymentItem } from '../../../shared/api/types'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { formatCompactNumber, formatCurrency, formatShortDate, formatShortDateTime } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { Alert } from '../../../shared/ui/alert'
import { Badge } from '../../../shared/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card'
import { ActionsMenu } from '../../../shared/ui/actions-menu'
import { DataTable } from '../../../shared/ui/data-table'
import { Dialog } from '../../../shared/ui/dialog'
import { IconButton } from '../../../shared/ui/icon-button'
import { Skeleton } from '../../../shared/ui/skeleton'
import { StatCard } from '../../../shared/ui/stat-card'
import type { TabItem } from '../../../shared/ui/tabs'
import type { Tone } from '../../../shared/ui/tone'
import { BarChartCard, type BarDatum } from '../../../shared/ui/charts/bar-chart-card'
import { FunnelStages, type FunnelStage } from '../../../shared/ui/charts/funnel-stages'
import { GaugeDonut, type GaugeSegment } from '../../../shared/ui/charts/gauge-donut'
import { Leaderboard, type LeaderboardEntry } from '../../../shared/ui/charts/leaderboard'
import { TaskList, type TaskRow } from '../../../shared/ui/charts/task-list'
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

type MediaPostRecord = NonNullable<DashboardResponse['statistics']['instagram_media_posts']>[number]

type MediaMetric = 'sent' | 'lead' | 'contacted'

const emptyPayments: PaymentItem[] = []
const emptyCompanyPayments: CompanyPaymentRecord[] = []
const emptyUsers: CeoUserRecord[] = []
const emptyUserTasks: UserOpenCardRecord[] = []
const emptyMediaPosts: MediaPostRecord[] = []
const doneColumnNamePattern = /\b(done|complete|completed|closed|finished|resolved)\b/i

const mediaMetricFields: Record<MediaMetric, keyof Pick<MediaPostRecord, 'sent_count' | 'lead_count' | 'contacted_count'>> = {
  sent: 'sent_count',
  lead: 'lead_count',
  contacted: 'contacted_count',
}

function isDoneTask(task: Pick<UserOpenCardRecord, 'column_name'>) {
  return doneColumnNamePattern.test(task.column_name.trim())
}

function filterOpenTasks(tasks: UserOpenCardRecord[]) {
  return tasks.filter((task) => !isDoneTask(task))
}

function getTaskPath(task: UserOpenCardRecord) {
  return `/projects/${task.project_id}?board=${task.board_id}&card=${task.id}`
}

function shortLabel(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return '—'
  }

  return trimmed.length > 14 ? `${trimmed.slice(0, 13)}…` : trimmed
}

function initialsOf(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase() || '—'
}

const statPanelClassName = 'min-h-0 gap-3 rounded-[18px] bg-[var(--accent-soft)] p-4'

const glyphPaths = {
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  lead: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 1 0 8 4 4 0 0 1 0-8M19 8v6M22 11h-6',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M9.5 9.2a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7.5v5l3 2',
  check: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M8.4 12.2l2.5 2.4 4.7-4.9',
  alert: 'M12 3.5l8.5 15H3.5l8.5-15zM12 9.5v4M12 16.5h.01',
  note: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5M9 13h6M9 17h4',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 4.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4M17 11.2a3 3 0 0 0 0-6M20 19v-1.2a3.4 3.4 0 0 0-2.4-3.2',
  tasks: 'M9 11.5l2 2 4.2-4.4M5 3.5h14A1.5 1.5 0 0 1 20.5 5v14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5z',
  wallet: 'M3.5 8.5h17v10a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5zM3.5 8.5 6 4.5h12l2.5 4M16 13.5h2',
  repeat: 'M4 9a5 5 0 0 1 5-5h7M4 9l3-3M4 9l3 3M20 15a5 5 0 0 1-5 5H8M20 15l-3-3M20 15l-3 3',
  plus: 'M12 5v14M5 12h14',
}

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function GlyphSmall({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function SwapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M1 4v6h6" />
      <path d="M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
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
  const [mediaMetric, setMediaMetric] = useState<MediaMetric>('sent')

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

  const statistics = dashboardQuery.data?.statistics
  const mediaPosts = statistics?.instagram_media_posts ?? emptyMediaPosts
  const hasMedia = statistics?.instagram_media_posts !== undefined
  const mediaSent = statistics?.instagram_media_total_sent_count ?? 0
  const mediaLead = statistics?.instagram_media_total_lead_count ?? 0
  const mediaContacted = statistics?.instagram_media_total_contacted_count ?? 0
  const mediaContinuing = statistics?.instagram_media_total_continuing_count ?? 0
  const mediaUnknownSent = statistics?.instagram_media_unknown_sent_count ?? 0
  const mediaUnknownLead = statistics?.instagram_media_unknown_lead_count ?? 0
  const mediaConversion = mediaSent > 0 ? (mediaLead / mediaSent) * 100 : 0

  const slaLimit = statistics?.lead_response_limit_minutes ?? 5
  const slaTotal = statistics?.lead_response_total_count ?? 0
  const slaOnTime = statistics?.lead_response_on_time_count ?? 0
  const slaLate = statistics?.lead_response_late_count ?? 0
  const slaNoChange = statistics?.lead_response_no_status_change_count ?? 0
  const slaNoteWritten = statistics?.lead_response_note_written_count ?? 0
  const slaNoteMissing = statistics?.lead_response_note_missing_count ?? 0
  const slaNoNote = statistics?.lead_response_status_changed_without_note_count ?? 0
  const slaAverage = statistics?.lead_response_average_human ?? '-'
  const hasSla = slaTotal > 0

  const totalUserCount = statistics?.user_count ?? users.length
  const activeUserCount = statistics?.active_user_count ?? users.filter((user) => user.is_active).length
  const inactiveUserCount = statistics?.inactive_user_count ?? 0
  const totalOpenTasks = Object.values(userTaskCounts).reduce((sum, count) => sum + count, 0)
  const paidPaymentsCount = payments.filter((row) => row.payment).length
  const pendingPaymentsCount = payments.length - paidPaymentsCount

  const mediaMetricField = mediaMetricFields[mediaMetric]
  const mediaMetricTotal = mediaMetric === 'sent' ? mediaSent : mediaMetric === 'lead' ? mediaLead : mediaContacted

  const mediaMetricTabs = useMemo<TabItem<MediaMetric>[]>(
    () => [
      { value: 'sent', label: t('ceo.overview.metric_sent', 'Sent') },
      { value: 'lead', label: t('ceo.overview.metric_lead', 'Leads') },
      { value: 'contacted', label: t('ceo.overview.metric_contacted', 'Reached') },
    ],
    [t],
  )

  const mediaBars = useMemo<BarDatum[]>(
    () => mediaPosts
      .filter((post) => post[mediaMetricField] > 0)
      .sort((left, right) => right[mediaMetricField] - left[mediaMetricField])
      .slice(0, 5)
      .map((post) => ({
        key: String(post.post_id),
        label: shortLabel(post.title),
        value: post[mediaMetricField],
        amount: String(post[mediaMetricField]),
        delta: post.sent_count > 0 ? `${Math.round((post.lead_count / post.sent_count) * 100)}%` : undefined,
      })),
    [mediaMetricField, mediaPosts],
  )

  const workloadRanking = useMemo(
    () => users
      .map((user) => ({ user, count: userTaskCounts[user.id] ?? 0 }))
      .filter((row) => row.count > 0)
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    [userTaskCounts, users],
  )

  const workloadBars = useMemo<BarDatum[]>(
    () => workloadRanking.map(({ user, count }) => ({
      key: String(user.id),
      label: shortLabel(user.name),
      value: count,
      amount: String(count),
    })),
    [workloadRanking],
  )

  const workloadEntries = useMemo<LeaderboardEntry[]>(() => {
    const max = workloadRanking.length > 0 ? workloadRanking[0].count : 1

    return workloadRanking.map(({ user, count }) => {
      const fullName = `${user.name} ${user.surname}`.trim()
      const jobTitle = typeof user.job_title === 'string' ? user.job_title.trim() : ''

      return {
        key: String(user.id),
        name: fullName,
        initials: initialsOf(fullName),
        caption: jobTitle || t('ceo.overview.open_tasks_caption', '{{count}} open tasks', { count }),
        amount: count,
        percent: Math.round((count / max) * 100),
      }
    })
  }, [t, workloadRanking])

  const slaSegments = useMemo<GaugeSegment[]>(
    () => [
      { key: 'on_time', label: "O'z vaqtida", value: slaOnTime, color: '#A6E83B' },
      { key: 'late', label: 'Kech boglanildi', value: slaLate, color: '#C6D4FF' },
      { key: 'no_status', label: "Status o'zgarmadi", value: slaNoChange, color: '#2B59FF' },
    ],
    [slaLate, slaNoChange, slaOnTime],
  )

  const teamSegments = useMemo<GaugeSegment[]>(
    () => [
      { key: 'active', label: t('status.active', 'Active'), value: activeUserCount, color: '#A6E83B' },
      { key: 'inactive', label: t('status.inactive', 'Inactive'), value: inactiveUserCount, color: '#C6D4FF' },
    ],
    [activeUserCount, inactiveUserCount, t],
  )

  const funnelStages = useMemo<FunnelStage[]>(() => {
    const mediaSteps = [
      { key: 'sent', label: 'Jami yuborildi', count: mediaSent, glyph: glyphPaths.send, hero: false },
      { key: 'lead', label: 'Jami lead', count: mediaLead, glyph: glyphPaths.lead, hero: false },
      { key: 'contacted', label: 'Contacted', count: mediaContacted, glyph: glyphPaths.chat, hero: false },
      { key: 'continuing', label: 'Continuing', count: mediaContinuing, glyph: glyphPaths.arrow, hero: true },
    ]
    const slaSteps = [
      { key: 'total', label: 'Jami lead', count: slaTotal, glyph: glyphPaths.lead, hero: false },
      { key: 'on_time', label: "O'z vaqtida", count: slaOnTime, glyph: glyphPaths.check, hero: false },
      { key: 'note', label: 'Note yozilgan', count: slaNoteWritten, glyph: glyphPaths.note, hero: true },
    ]
    const steps = hasMedia ? mediaSteps : hasSla ? slaSteps : []
    const max = steps.reduce((acc, step) => Math.max(acc, step.count), 0) || 1

    return steps.map((step) => ({
      key: step.key,
      label: step.label,
      count: step.count,
      value: step.count,
      percent: Math.round((step.count / max) * 100),
      icon: <GlyphSmall d={step.glyph} />,
      hero: step.hero,
    }))
  }, [hasMedia, hasSla, mediaContacted, mediaContinuing, mediaLead, mediaSent, slaNoteWritten, slaOnTime, slaTotal])

  const funnelTotal = hasMedia ? mediaSent : slaTotal

  const paymentTasks = useMemo<TaskRow[]>(
    () => [...payments]
      .sort((left, right) => (
        Number(left.payment) - Number(right.payment)
        || String(right.date ?? '').localeCompare(String(left.date ?? ''))
      ))
      .slice(0, 6)
      .map((payment) => ({
        key: String(payment.id),
        title: payment.project,
        meta: payment.date ? formatShortDate(payment.date) : '-',
        tag: formatCompactNumber(Number(payment.summ ?? 0)),
        tone: payment.payment ? ('success' as const) : ('warning' as const),
        done: payment.payment,
      })),
    [payments],
  )

  const emptyHint = (
    <p className="py-10 text-center text-[13px] text-[var(--muted)]">
      {t('customers.overview.no_data', 'No data for this period yet.')}
    </p>
  )

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
    <section className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="ui-page-title text-[var(--foreground)]">
            {t('ceo.overview.title', 'CEO dashboard')}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {t('ceo.overview.subtitle', 'Company metrics, lead response and team workload at a glance.')}
          </p>
        </div>

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
      </div>

      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        {hasMedia ? (
          <>
            <StatCard
              solid
              label="Jami yuborildi"
              value={mediaSent}
              icon={<Glyph d={glyphPaths.send} />}
              hint={t('ceo.overview.media_count', '{{count}} media tracked', { count: mediaPosts.length })}
              delta={mediaSent > 0 ? `${mediaConversion.toFixed(1)}%` : undefined}
            />
            <StatCard
              label="Jami lead"
              value={mediaLead}
              icon={<Glyph d={glyphPaths.lead} />}
              iconTone="success"
              hint={t('ceo.overview.contacted_hint', 'Contacted: {{count}}', { count: mediaContacted })}
              delta={mediaContinuing > 0 ? String(mediaContinuing) : undefined}
              deltaTone="neutral"
              onOpen={() => navigate('/crm')}
              openLabel={t('ceo.overview.open_crm', 'Open CRM')}
            />
            <StatCard
              label="Noaniq yuborildi"
              value={mediaUnknownSent}
              icon={<Glyph d={glyphPaths.help} />}
              iconTone="warning"
              hint={t('ceo.overview.unknown_lead_hint', 'Unlinked leads: {{count}}', { count: mediaUnknownLead })}
              delta={mediaSent > 0 ? `${Math.round((mediaUnknownSent / mediaSent) * 100)}%` : undefined}
              deltaTone="danger"
              onOpen={() => navigate('/cognilabsai/media-contexts')}
              openLabel={t('ceo.overview.open_media_contexts', 'Open media contexts')}
            />
          </>
        ) : (
          <>
            <StatCard
              solid
              label={t('ceo.overview.active_users', 'Active users')}
              value={activeUserCount}
              icon={<Glyph d={glyphPaths.users} />}
              hint={t('ceo.overview.total_users_hint', 'Total users: {{count}}', { count: totalUserCount })}
              delta={inactiveUserCount > 0 ? String(inactiveUserCount) : undefined}
            />
            <StatCard
              label={t('ceo.overview.open_tasks', 'Open tasks')}
              value={totalOpenTasks}
              icon={<Glyph d={glyphPaths.tasks} />}
              iconTone="violet"
              hint={t('ceo.overview.task_users_hint', 'Across {{count}} teammates', { count: workloadRanking.length })}
              onOpen={() => navigate('/projects')}
              openLabel={t('ceo.overview.open_projects', 'Open projects')}
            />
            <StatCard
              label={t('ceo.overview.pending_payments', 'Pending payments')}
              value={pendingPaymentsCount}
              icon={<Glyph d={glyphPaths.wallet} />}
              iconTone="warning"
              hint={t('ceo.overview.paid_hint', 'Paid: {{count}}', { count: paidPaymentsCount })}
              delta={pendingPaymentsCount > 0 ? String(pendingPaymentsCount) : undefined}
              deltaTone="danger"
            />
          </>
        )}

        {hasSla ? (
          <StatCard
            label="O'rtacha vaqt"
            value={slaAverage}
            icon={<Glyph d={glyphPaths.clock} />}
            iconTone="violet"
            hint={t('ceo.overview.sla_hint', 'SLA target: {{count}} min', { count: slaLimit })}
            delta={`${Math.round((slaOnTime / slaTotal) * 100)}%`}
          />
        ) : (
          <StatCard
            label={t('ceo.overview.recurring_total', 'Recurring monthly')}
            value={formatCurrency(companyPaymentsQuery.data?.totalAmount ?? 0)}
            icon={<Glyph d={glyphPaths.repeat} />}
            iconTone="blue"
            hint={t('ceo.overview.recurring_hint', '{{count}} reminders', { count: companyPayments.length })}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-[18px]">
        {hasMedia && mediaPosts.length > 0 ? (
          <BarChartCard
            className="min-w-0 flex-[1.5_1_520px]"
            title={t('ceo.overview.media_performance', 'Media performance')}
            deltaBadge={`${mediaConversion.toFixed(1)}%`}
            deltaCaption={t('ceo.overview.media_conversion_caption', 'sent to lead conversion')}
            periods={mediaMetricTabs}
            period={mediaMetric}
            onPeriodChange={setMediaMetric}
            data={mediaBars}
            highlightKey={mediaBars[0]?.key}
            summaryTitle={t('ceo.overview.media_summary', 'Top performing media in the tracked window.')}
            total={mediaMetricTotal}
            totalCaption={t('ceo.overview.media_total_caption', 'across tracked media')}
            emptyState={emptyHint}
          />
        ) : (
          <BarChartCard
            className="min-w-0 flex-[1.5_1_520px]"
            title={t('ceo.overview.workload_chart', 'Workload by teammate')}
            deltaCaption={t('ceo.overview.workload_caption', 'open tasks per teammate')}
            data={workloadBars}
            highlightKey={workloadBars[0]?.key}
            summaryTitle={t('ceo.overview.workload_summary', 'Who carries the most open cards right now.')}
            total={totalOpenTasks}
            totalCaption={t('ceo.overview.open_tasks_total', 'open tasks')}
            emptyState={emptyHint}
          />
        )}

        {hasSla ? (
          <GaugeDonut
            className="min-w-0 flex-[1_1_360px]"
            title="Lead Javob Vaqti"
            action={
              <span className="rounded-full bg-[var(--blue-dim)] px-2.5 py-1 text-xs font-semibold tabular-nums text-[var(--blue-text)]">
                SLA: {slaLimit} min
              </span>
            }
            segments={slaSegments}
            centerValue={slaTotal}
            centerCaption={t('ceo.overview.sla_center_caption', 'measured leads')}
            emptyState={emptyHint}
          />
        ) : (
          <GaugeDonut
            className="min-w-0 flex-[1_1_360px]"
            title={t('ceo.overview.team_state', 'Team status')}
            segments={teamSegments}
            centerValue={totalUserCount}
            centerCaption={t('ceo.overview.team_caption', 'team members')}
            emptyState={emptyHint}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-[18px]">
        {funnelStages.length > 0 ? (
          <div className="flex min-w-0 flex-[1.3_1_440px] flex-col gap-4 rounded-[24px] bg-[var(--card)] p-[22px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
                {t('ceo.overview.funnel', 'Lead funnel')}
              </span>
              <span className="text-[13px] text-[var(--muted)]">
                {t('ceo.overview.funnel_total', 'total')}{' '}
                <b className="font-semibold tabular-nums text-[var(--foreground)]">{funnelTotal}</b>
              </span>
            </div>
            <FunnelStages stages={funnelStages} />
          </div>
        ) : null}

        <TaskList
          className="min-w-0 flex-[1_1_300px]"
          title={t('ceo.overview.payments_tasks', 'Payment checklist')}
          tasks={paymentTasks}
          onToggle={(key) => {
            const match = payments.find((row) => String(row.id) === key)
            if (match) {
              void handleTogglePayment(match)
            }
          }}
          onSelect={(key) => {
            const match = payments.find((row) => String(row.id) === key)
            if (match) {
              openEditPaymentModal(match)
            }
          }}
          action={
            <button
              type="button"
              onClick={openCreatePaymentModal}
              aria-label={t('ceo.dashboard.actions.create_payment')}
              className="grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-[var(--surface-inverse)] text-white transition-colors hover:bg-[var(--primary)]"
            >
              <Glyph d={glyphPaths.plus} />
            </button>
          }
          emptyState={
            <p className="py-8 text-center text-[13px] text-[var(--muted)]">
              {t('ceo.dashboard.payments.empty_title')}
            </p>
          }
        />

        <Leaderboard
          className="min-w-0 flex-[1_1_300px]"
          title={t('ceo.overview.top_workload', 'Busiest teammates')}
          badge={t('ceo.overview.workload_badge', 'Open tasks')}
          entries={workloadEntries}
          emptyState={
            <p className="py-8 text-center text-[13px] text-[var(--on-inverse-muted)]">
              {t('ceo.dashboard.tasks.no_tasks', 'No open tasks')}
            </p>
          }
        />
      </div>

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
      />

      <div className="grid gap-[18px] xl:grid-cols-2">
        <Card noPadding>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => void handleOpenUserTasks(user.id)}
                    className="flex flex-col items-center gap-2.5 rounded-[18px] bg-[var(--accent-soft)] p-4 text-center transition-colors hover:bg-[var(--blue-dim)]"
                  >
                    <Avatar
                      name={user.name}
                      surname={user.surname}
                      imageUrl={(user.profile_image as string | null | undefined) ?? null}
                      size="lg"
                    />
                    <div className="w-full min-w-0">
                      <p className="truncate text-sm font-semibold leading-snug text-[var(--foreground)]">
                        {user.name} {user.surname}
                      </p>
                      {user.job_title && (
                        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{user.job_title as string}</p>
                      )}
                      <div className="mt-2 flex justify-center">
                        {isLoadingTaskCounts ? (
                          <Skeleton rounded="full" className="h-[22px] w-16" />
                        ) : (
                          <Badge
                            variant={userTaskCounts[user.id] ? 'warning' : 'secondary'}
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

        <div className="flex flex-col gap-[18px]">
          <Card noPadding>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
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
                        <p className="font-semibold text-[var(--foreground)]">{row.title}</p>
                        {row.note && <p className="mt-1 text-xs text-[var(--muted)] line-clamp-1">{row.note}</p>}
                      </div>
                    ),
                  },
                  {
                    key: 'amount',
                    header: t('ceo.recurring.form.amount'),
                    align: 'right',
                    render: (row) => (
                      <span className="font-semibold tabular-nums">{formatCurrency(row.amount)}</span>
                    ),
                  },
                  {
                    key: 'day',
                    header: t('ceo.recurring.form.payment_day'),
                    align: 'center',
                    render: (row) => (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-sm font-bold tabular-nums text-[var(--blue-text)]">{row.payment_day}</span>
                        <span className="text-[11px] tabular-nums text-[var(--muted)]">{row.payment_time}</span>
                      </div>
                    ),
                  },
                  {
                    key: 'status',
                    header: t('common.status'),
                    render: (row) => (
                      <Badge variant={row.is_active ? 'success' : 'secondary'} dot>
                        {row.is_active ? t('status.active') : t('status.inactive')}
                      </Badge>
                    ),
                  },
                  {
                    key: 'actions',
                    header: t('common.actions'),
                    render: (row) => (
                      <div className="flex items-center gap-1">
                        <IconButton size="sm" label={t('common.edit')} onClick={() => openEditCompanyPaymentModal(row)}>
                          <PencilIcon />
                        </IconButton>
                        <IconButton size="sm" tone="danger" label={t('customers.actions.delete')} onClick={() => void handleDeleteCompanyPayment(row)}>
                          <TrashIcon />
                        </IconButton>
                      </div>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>

          <Card noPadding>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>{t('ceo.dashboard.payments.title')}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success" dot>
                  {t('ceo.dashboard.payments.paid_count', { count: paidPaymentsCount })}
                </Badge>
                <Badge variant="warning" dot pulse={pendingPaymentsCount > 0}>
                  {t('ceo.dashboard.payments.pending_count', { count: pendingPaymentsCount })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                caption={t('ceo.dashboard.payments.title')}
                rows={payments}
                getRowKey={(row) => String(row.id)}
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
                    render: (row) => <span className="font-medium text-[var(--foreground)]">{row.project}</span>,
                  },
                  {
                    key: 'date',
                    header: t('ceo.dashboard.table.date'),
                    render: (row) => (
                      <span className="tabular-nums text-[var(--muted-strong)]">
                        {row.date ? formatShortDate(row.date) : '-'}
                      </span>
                    ),
                  },
                  {
                    key: 'amount',
                    header: t('ceo.dashboard.table.amount'),
                    align: 'right',
                    render: (row) => (
                      <span className="font-semibold tabular-nums">{formatCurrency(Number(row.summ ?? 0))}</span>
                    ),
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
                        <IconButton size="sm" label={t('common.edit')} onClick={() => openEditPaymentModal(row)}>
                          <PencilIcon />
                        </IconButton>
                        <IconButton size="sm" tone="primary" label={t('ceo.dashboard.actions.toggle')} onClick={() => void handleTogglePayment(row)}>
                          <SwapIcon />
                        </IconButton>
                        <IconButton size="sm" tone="danger" label={t('customers.actions.delete')} onClick={() => void handleDeletePayment(row)}>
                          <TrashIcon />
                        </IconButton>
                      </div>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {hasMedia && (
        <Card noPadding>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Instagram Media Funnel</CardTitle>
            <Badge variant="blue" dot>
              {mediaPosts.length} media
            </Badge>
          </CardHeader>
          <CardContent className="space-y-[18px]">
            {mediaPosts.length === 0 ? (
              <p className="rounded-[18px] bg-[var(--muted-surface)] py-6 text-center text-sm text-[var(--muted)]">Hali media context qo'shilmagan.</p>
            ) : (
              <>
                {mediaUnknownSent > 0 && (
                  <Alert tone="warning">
                    Ba'zi Instagram media xabarlari contextga bog'lanmagan. Media Contexts sahifasidan post/reel/story link qo'shing.
                  </Alert>
                )}
                <DataTable
                  caption="Instagram media posts"
                  rows={mediaPosts}
                  getRowKey={(row) => String(row.post_id)}
                  emptyState={<EmptyStateBlock eyebrow="CEO Workspace" title="No media" />}
                  columns={[
                    {
                      key: 'title',
                      header: 'Post',
                      render: (row) => (
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{row.title}</p>
                          <p className="text-xs capitalize text-[var(--muted)]">{row.media_type}</p>
                        </div>
                      ),
                    },
                    { key: 'sent', header: 'Yuborildi', align: 'center', render: (row) => <span className="font-semibold tabular-nums text-[var(--blue-text)]">{row.sent_count}</span> },
                    { key: 'leads', header: 'Lead', align: 'center', render: (row) => <span className="font-semibold tabular-nums text-[var(--success-text)]">{row.lead_count}</span> },
                    { key: 'contacted', header: 'Contacted', align: 'center', render: (row) => <span className="font-semibold tabular-nums text-[var(--blue-text)]">{row.contacted_count}</span> },
                    { key: 'continuing', header: 'Continuing', align: 'center', render: (row) => <span className="font-semibold tabular-nums text-[var(--violet-text)]">{row.continuing_count}</span> },
                    {
                      key: 'conversion',
                      header: 'Conversion',
                      align: 'right',
                      render: (row) => {
                        const pct = row.sent_count > 0 ? ((row.lead_count / row.sent_count) * 100).toFixed(1) : '0.0'
                        return <span className="rounded-full bg-[var(--success-dim)] px-2.5 py-1 text-xs font-semibold tabular-nums text-[var(--success-text)]">{pct}%</span>
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
                          className="text-xs font-medium text-[var(--muted)] transition-colors underline-offset-2 hover:text-[var(--primary)] hover:underline"
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

      {hasSla && (
        <Card noPadding>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>{t('ceo.overview.note_discipline', 'Note discipline')}</CardTitle>
            <Badge variant="blue" dot>
              {t('ceo.overview.measured_leads', '{{count}} leads measured', { count: slaTotal })}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {([
                { label: 'Jami lead', value: slaTotal, tone: 'blue', glyph: glyphPaths.lead },
                { label: 'Note yozilgan', value: slaNoteWritten, tone: 'success', glyph: glyphPaths.note },
                { label: 'Note yozilmagan', value: slaNoteMissing, tone: 'warning', glyph: glyphPaths.note },
                { label: 'Note yoqsiz status', value: slaNoNote, tone: 'violet', glyph: glyphPaths.alert },
              ] as ReadonlyArray<{ label: string; value: number; tone: Tone; glyph: string }>).map((item) => (
                <StatCard
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  icon={<Glyph d={item.glyph} />}
                  iconTone={item.tone}
                  className={statPanelClassName}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
          <div className="flex items-center justify-center rounded-[18px] bg-[var(--muted-surface)] py-10 text-sm text-[var(--muted)]">
            {t('common.loading', 'Loading...')}
          </div>
        ) : userTasksData.length === 0 ? (
          <div className="rounded-[18px] bg-[var(--muted-surface)] py-10 text-center text-sm text-[var(--muted)]">
            {t('ceo.dashboard.tasks.no_tasks', 'No open tasks')}
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
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
                  className="flex cursor-pointer items-start gap-3 rounded-[18px] bg-[var(--accent-soft)] p-4 text-left transition-colors hover:bg-[var(--blue-dim)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35"
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
                    className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.6px] border-[#D3D7E0] bg-[var(--surface)] text-transparent transition-colors hover:border-transparent hover:bg-[var(--lime)] hover:text-[var(--lime-ink)] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={t('ceo.dashboard.tasks.mark_done', 'Mark task as done')}
                    title={t('ceo.dashboard.tasks.mark_done', 'Mark task as done')}
                  >
                    <CheckIcon />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-[var(--foreground)]">{task.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-[var(--muted)]">
                      <span>{task.project_name}</span>
                      <span>·</span>
                      <span>{task.column_name}</span>
                      {task.due_date && (
                        <>
                          <span>·</span>
                          <span className={isOverdue ? 'font-semibold text-[var(--danger-text)]' : ''}>
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
                        'secondary'
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
