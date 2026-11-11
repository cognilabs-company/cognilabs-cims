/* eslint-disable @typescript-eslint/no-unused-vars */
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlarmClock, Archive as ArchiveIcon, ArrowRight, Bot, CircleDashed, ListTodo, NotebookPen, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { env } from '../../../shared/config/env'
import type { CustomerSummary, DynamicStatusOption } from '../../../shared/api/types'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { isNotFoundError } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import {
  formatUsernameHandle,
  getCustomerDisplayName,
  getCustomerDisplayPlatform,
  getCustomerPlatforms,
} from '../../../shared/lib/customer-display'
import { formatNumericDateTime } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { getRecallTimeTone, getRecallTimeToneClasses } from '../lib/recallTime'
import { Button } from '../../../shared/ui/button'
import { DataGrid, type GridColumn } from '../../../shared/ui/data-grid'
import type { SelectFieldOption } from '../../../shared/ui/select-field'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { crmService as baseCrmService } from '../../../shared/api/services/crm.service'
import { AudioPlayerModal } from '../components/AudioPlayerModal'
import { CrmDashboardOverview } from '../components/CrmDashboardOverview'
import { CopyButton, FilterPanel, FilterToken, FlagTag, StatusPill, StatusSelect } from '../components/CustomerFilters'
import { useAuth } from '../../auth/hooks/useAuth'
import { platformVisual } from '../lib/platformIcon'
import { avatarTone, initialsFor } from '../lib/customerAvatar'
import { MetricTile } from '../../../shared/ui/metric-tile'
import { gridButton } from '../../../shared/ui/data-grid-styles'
import { statusIconFor, statusKpiIconFor } from '../lib/statusIcon'
import { CustomerDetailDrawer } from '../components/CustomerDetailDrawer'
import { CustomerFormModal, type CustomerFormValues } from '../components/CustomerFormModal'
import { useCrmScope } from '../lib/crmScope'
import { getCustomerActionErrorMessage, getCustomerUnavailableTitle } from '../lib/customerErrors'
const emptyCustomers: CustomerSummary[] = []
const emptyStatuses: DynamicStatusOption[] = []
function getCrmReturnStateKey(scopeKey: string) {
  return `cims:${scopeKey}-return-state`
}

const initialFormValues: CustomerFormValues = {
  full_name: '',
  platform: '',
  phone_number: '',
  status: '',
  username: '',
  assistant_name: '',
  notes: '',
  recall_time: '',
  clear_recall_time: false,
  customer_type: '',
  conversation_language: 'uz',
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

function toApiDateTimeWithOffset(value: string) {
  const [datePart, timePart] = value.split('T')

  if (!datePart || !timePart) {
    return value
  }

  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)
  const date = new Date(year, month - 1, day, hours, minutes, 0)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absoluteOffset = Math.abs(offsetMinutes)
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, '0')
  const offsetMins = String(absoluteOffset % 60).padStart(2, '0')

  return `${datePart}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00${sign}${offsetHours}:${offsetMins}`
}

function toFormValues(customer?: CustomerSummary | null): CustomerFormValues {
  if (!customer) {
    return initialFormValues
  }

  return {
    full_name: customer.full_name ?? '',
    platform: getCustomerDisplayPlatform(customer) ?? '',
    phone_number: customer.phone_number ?? customer.phone ?? '',
    status: customer.status ?? '',
    username: customer.username ?? '',
    assistant_name: customer.assistant_name ?? '',
    notes: customer.notes ?? '',
    recall_time: toDateTimeLocalValue(customer.recall_time),
    clear_recall_time: false,
    customer_type: '',
    conversation_language: customer.conversation_language ?? 'uz',
  }
}

function buildCustomerFormData(
  values: CustomerFormValues,
  mode: 'create' | 'edit',
  audioFile: File | null,
) {
  const formData = new FormData()
  const normalizedStatus = values.status.trim()

  const mappedFields: Array<[string, string]> = [
    ['full_name', values.full_name.trim()],
    ['platform', values.platform.trim()],
    ['phone_number', values.phone_number.trim()],
    ['username', values.username.trim()],
    ['assistant_name', values.assistant_name.trim()],
    ['notes', values.notes.trim()],
    ['conversation_language', values.conversation_language.trim()],
    ['customer_type', values.customer_type.trim()],
  ]

  mappedFields.forEach(([key, value]) => {
    if (value) {
      formData.append(key, value)
    }
  })

  if (normalizedStatus) {
    formData.append('status', normalizedStatus)

    // Some CRM update endpoints still expect the legacy field name on edit.
    if (mode === 'edit') {
      formData.append('customer_status', normalizedStatus)
    }
  }

  if (values.recall_time) {
    formData.append('recall_time', toApiDateTimeWithOffset(values.recall_time))
  }

  if (mode === 'edit' && values.clear_recall_time) {
    formData.append('clear_recall_time', 'true')
  }

  if (audioFile) {
    formData.append('audio', audioFile)
  }

  return formData
}

function buildCustomerDraft(customer: CustomerSummary, values: CustomerFormValues) {
  const normalizedRecallTime = values.clear_recall_time
    ? null
    : values.recall_time
      ? toApiDateTimeWithOffset(values.recall_time)
      : customer.recall_time ?? null

  return {
    ...customer,
    full_name: values.full_name.trim(),
    platform: values.platform.trim(),
    phone_number: values.phone_number.trim(),
    status: values.status.trim(),
    username: values.username.trim(),
    assistant_name: values.assistant_name.trim(),
    notes: values.notes.trim(),
    recall_time: normalizedRecallTime,
    conversation_language: values.conversation_language.trim(),
  }
}

function formatDateTime(value?: string | null) {
  return formatNumericDateTime(value)
}

function renderRecallTime(value?: string | null) {
  const tone = getRecallTimeTone(value)
  const formatted = formatDateTime(value)

  if (!tone || formatted === '-') {
    return formatted
  }

  const toneLabels: Record<typeof tone, string> = {
    past: 'Passed',
    active: 'Now',
    future: 'Upcoming',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs leading-none font-semibold',
        getRecallTimeToneClasses(tone),
      )}
      title={toneLabels[tone]}
    >
      {formatted}
    </span>
  )
}

type CrmReturnState = {
  search: string
  statusFilters: string[]
  platformFilter: string
  dateStart: string
  dateEnd: string
  pageSize: string
  selectedPeriod: '' | 'today' | '3d' | '7d' | '30d' | '90d'
  tablePage: number
  customerId: number
  customerIndex: number
}

type CrmViewState = Omit<CrmReturnState, 'customerId' | 'customerIndex'>

function readCrmReturnState(scopeKey: string): CrmReturnState | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(getCrmReturnStateKey(scopeKey))
    if (!raw) return null

    const parsed = JSON.parse(raw) as CrmReturnState
    if (
      !parsed
      || !Number.isFinite(parsed.customerId)
      || parsed.customerId <= 0
      || !Number.isFinite(parsed.customerIndex)
      || parsed.customerIndex < 0
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function saveCrmReturnState(scopeKey: string, state: CrmReturnState) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(getCrmReturnStateKey(scopeKey), JSON.stringify(state))
}

function clearCrmReturnState(scopeKey: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(getCrmReturnStateKey(scopeKey))
}

function resolveAudioUrl(customer: CustomerSummary, apiBasePath: string) {
  if (customer.audio_url) {
    return customer.audio_url
  }

  if (!customer.audio_file_id) {
    return null
  }

  return `${env.apiBaseUrl.replace(/\/$/, '')}${apiBasePath}/customers/audio/${customer.audio_file_id}`
}

function normalizeDateValue(value?: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function getConversationIdFromChatUrl(value?: string | null) {
  const match = value?.match(/conversation_id=(\d+)/)
  return match ? Number(match[1]) : null
}

function normalizeStatusKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeFilterValue(value?: string | null) {
  return (value ?? '').trim().toLowerCase()
}

function summarizeCustomerNotes(value?: string | null, wordLimit = 3) {
  const notes = (value ?? '').replace(/\s+/g, ' ').trim()

  if (!notes) {
    return '-'
  }

  const aiBotJobMatch = notes.match(/Lead from AI Bot\s*\|\s*Job:\s*(.+?)(?:\s*\|\s*|$)/i)
  const sourceText = aiBotJobMatch?.[1]?.trim() || notes
  const words = sourceText.split(/\s+/).filter(Boolean)

  if (words.length <= wordLimit) {
    return sourceText
  }

  return `${words.slice(0, wordLimit).join(' ')}...`
}

function buildNormalizedStatusMetaMap(statusOptions: DynamicStatusOption[]) {
  const map = new Map<string, DynamicStatusOption>()

  for (const option of statusOptions) {
    const normalizedValue = normalizeStatusKey(option.value)
    const normalizedLabel = normalizeStatusKey(option.label)

    if (normalizedValue) {
      map.set(normalizedValue, option)
    }

    if (normalizedLabel) {
      map.set(normalizedLabel, option)
    }
  }

  return map
}

function buildSelectableStatusOptions(
  dynamicStatuses: DynamicStatusOption[],
  statusChoices: SelectFieldOption[],
  currentStatuses: string[] = [],
  currentValue?: string | null,
) {
  const optionsByKey = new Map<string, { value: string; label: string; order: number }>()

  const register = (value?: string | null, label?: string | null, order = Number.POSITIVE_INFINITY) => {
    const normalizedKey = normalizeStatusKey(value || label || '')
    const trimmedValue = (value ?? '').trim()
    const trimmedLabel = (label ?? value ?? '').trim()

    if (!normalizedKey || !trimmedValue || optionsByKey.has(normalizedKey)) {
      return
    }

    optionsByKey.set(normalizedKey, {
      value: trimmedValue,
      label: trimmedLabel,
      order,
    })
  }

  dynamicStatuses.forEach((status) => {
    register(status.value, status.label, status.order)
  })

  statusChoices.forEach((status) => {
    register(status.value, status.label)
  })

  currentStatuses.forEach((status) => {
    register(status, status)
  })

  register(currentValue, currentValue)

  return [...optionsByKey.values()]
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
    .map(({ value, label }) => ({ value, label }))
}

function getCustomerStatusKeys(customer: CustomerSummary, statusMetaMap: Map<string, DynamicStatusOption>) {
  const keys = new Set<string>()
  const rawStatusKey = normalizeStatusKey(customer.status)

  if (rawStatusKey) {
    keys.add(rawStatusKey)
  }

  const meta = statusMetaMap.get(rawStatusKey)

  if (meta) {
    const metaValueKey = normalizeStatusKey(meta.value)
    const metaLabelKey = normalizeStatusKey(meta.label)

    if (metaValueKey) {
      keys.add(metaValueKey)
    }

    if (metaLabelKey) {
      keys.add(metaLabelKey)
    }
  }

  return keys
}

function TableAudioControl({
  src,
  customerName,
  onOpenPlayer,
}: {
  src: string
  customerName: string
  onOpenPlayer: (src: string, name: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => onOpenPlayer(src, customerName)}
        className="inline-flex h-9 items-center gap-2 rounded-[11px] bg-[var(--input-surface)] px-3 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface-hover)]"
        aria-label={t('common.play', 'Play')}
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--blue-dim)] text-[var(--blue-text)]">
          <svg viewBox="0 0 16 16" className="ml-0.5 h-3 w-3 fill-current" aria-hidden="true">
            <path d="M5 3.8v8.4a.6.6 0 0 0 .93.5l6.2-4.2a.6.6 0 0 0 0-1L5.93 3.3A.6.6 0 0 0 5 3.8Z" />
          </svg>
        </span>
        {t('common.play', 'Play')}
      </button>
    </div>
  )
}



type CrmPageView = 'overview' | 'customers'
/** Customers page cards: need to call → meeting → KP/TZ → payment (normalised status keys). */
const statusCardKeys = ['needtocall', 'meetingscheduled', 'creatingkptz', 'paymentpending']
const periodKeys = ['today', '3d', '7d', '30d', '90d'] as const

/** /crm — the CRM dashboard (overview only). */
export function CrmDashboardPage() {
  return <CrmWorkspace view="overview" />
}

/** /crm/customers — the customer list with the customisable table. */
export function CrmCustomersPage() {
  return <CrmWorkspace view="customers" />
}

function CrmWorkspace({ view }: { view: CrmPageView }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()
  const { service: crmService, apiBasePath, routeBasePath, storageKey, kind: crmKind } = useCrmScope()
  const { can } = useAuth()
  // RBAC "customers" actions (the outbound CRM is not an RBAC module and keeps its own rules).
  const mayCustomers = (action: string) => crmKind === 'outbound' || can('customers', action)
  const canCreateCustomer = mayCustomers('create')
  const canEditCustomer = mayCustomers('edit')
  const canDeleteCustomer = mayCustomers('delete')
  const canExportCustomers = mayCustomers('export')
  const [initialReturnState] = useState(() => readCrmReturnState(storageKey))

  const [search, setSearch] = useState(() => initialReturnState?.search ?? '')
  const deferredSearch = useDeferredValue(search)
  // ?status=… and ?period=… (links from the dashboards) win over the remembered view state.
  const [statusFilters, setStatusFilters] = useState<string[]>(() => {
    const fromUrl = searchParams.get('status')
    return fromUrl ? [fromUrl] : (initialReturnState?.statusFilters ?? [])
  })
  const [platformFilter, setPlatformFilter] = useState(() => initialReturnState?.platformFilter ?? '')
  const [dateStart, setDateStart] = useState(() => initialReturnState?.dateStart ?? '')
  const [dateEnd, setDateEnd] = useState(() => initialReturnState?.dateEnd ?? '')
  const [pageSize, setPageSize] = useState(() => initialReturnState?.pageSize ?? '110')
  const [selectedPeriod, setSelectedPeriod] = useState<'' | 'today' | '3d' | '7d' | '30d' | '90d'>(() => {
    const fromUrl = searchParams.get('period')
    if (fromUrl && (periodKeys as readonly string[]).includes(fromUrl)) return fromUrl as (typeof periodKeys)[number]
    return initialReturnState?.selectedPeriod ?? ''
  })
  const [tablePage, setTablePage] = useState(() => Math.max(1, initialReturnState?.tablePage ?? 1))

  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null)
  const [detailCustomer, setDetailCustomer] = useState<CustomerSummary | null>(null)
  const [formValues, setFormValues] = useState<CustomerFormValues>(initialFormValues)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isFormSubmitting, setIsFormSubmitting] = useState(false)
  const [audioModal, setAudioModal] = useState<{ src: string; name: string } | null>(null)
  const navigate = useNavigate()
  const hasRestoredReturnTargetRef = useRef(false)
  const restoreScrollTimerRef = useRef<number | null>(null)
  const restoreScrollAttemptsRef = useRef(0)
  const latestCrmViewStateRef = useRef<CrmViewState>({
    search: '',
    statusFilters: [],
    platformFilter: '',
    dateStart: '',
    dateEnd: '',
    pageSize: '110',
    selectedPeriod: '',
    tablePage: 1,
  })

  useEffect(() => {
    if (!searchParams.has('status') && !searchParams.has('period')) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('status')
      next.delete('period')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  const searchInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (view !== 'customers') return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key !== '/' || event.metaKey || event.ctrlKey || target?.closest('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])

  const pageSizeValue = Number(pageSize) || 110
  const shouldRestoreReturnState = Boolean(initialReturnState?.customerId)

  useLayoutEffect(() => {
    latestCrmViewStateRef.current = {
      search,
      statusFilters,
      platformFilter,
      dateStart,
      dateEnd,
      pageSize,
      selectedPeriod,
      tablePage,
    }
  }, [dateEnd, dateStart, pageSize, platformFilter, search, selectedPeriod, statusFilters, tablePage])

  const dashboardQuery = useAsyncData(() => crmService.dashboardWithAllCustomers(), [])
  const statusesQuery = useAsyncData(() => crmService.dynamicStatuses(), [])
  const summaryQuery = useAsyncData(() => crmService.summaryStats(), [])
  const statusSummaryQuery = useAsyncData(() => crmService.statusSummary(), [])
  const conversionQuery = useAsyncData(
    () => baseCrmService.conversionRate(),
    [crmKind],
    { enabled: crmKind !== 'outbound' },
  )
  const periodReportPeriodKey = selectedPeriod === 'today' ? '1d' : selectedPeriod
  const periodReportQuery = useAsyncData(
    () => crmService.periodReport({
      period: periodReportPeriodKey || undefined,
      search: deferredSearch || undefined,
    }),
    [periodReportPeriodKey, deferredSearch],
    { enabled: Boolean(periodReportPeriodKey) },
  )

  const periodCustomers = periodReportQuery.data?.customers
  const baseCustomers = selectedPeriod && periodCustomers
    ? periodCustomers
    : (dashboardQuery.data?.customers ?? emptyCustomers)
  const localizeStatus = (value: string, fallback: string) => t(`crm.status_label.${normalizeStatusKey(value)}`, fallback)
  const statusOptions = useMemo(
    () => (statusesQuery.data ?? emptyStatuses).map((option) => ({ ...option, label: t(`crm.status_label.${normalizeStatusKey(option.value)}`, option.label) })),
    [statusesQuery.data, t],
  )

  const statusMetaMap = useMemo(() => buildNormalizedStatusMetaMap(statusOptions), [statusOptions])

  useEffect(() => {
    const customerIdParam = searchParams.get('customer_id')
    if (!customerIdParam) {
      return
    }

    const customerId = Number(customerIdParam)
    if (!Number.isFinite(customerId) || customerId <= 0) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('customer_id')
        return next
      }, { replace: true })
      return
    }

    void crmService.detail(customerId)
      .then((customer) => {
        setDetailCustomer(customer)
      })
      .catch((error: unknown) => {
        setDetailCustomer(null)
        showToast({
          title: getCustomerUnavailableTitle(t),
          description: getCustomerActionErrorMessage(error, t),
          tone: 'error',
        })
      })
      .finally(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.delete('customer_id')
          return next
        }, { replace: true })
      })

  }, [crmService, searchParams, setSearchParams, showToast, t])

  useEffect(() => {
    const conversationIdParam = searchParams.get('conversation_id')
    if (!conversationIdParam) {
      return
    }

    const conversationId = Number(conversationIdParam)
    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('conversation_id')
        return next
      }, { replace: true })
      return
    }

    const allCustomers = dashboardQuery.data?.customers
    if (!allCustomers) {
      return
    }

    const matchedCustomer = allCustomers.find((customer) => getConversationIdFromChatUrl(customer.chat_url) === conversationId)

    if (matchedCustomer) {
      setDetailCustomer(matchedCustomer)
    }

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('conversation_id')
      return next
    }, { replace: true })
  }, [dashboardQuery.data?.customers, searchParams, setSearchParams])

  const statusFilterOptions = useMemo(
    () => buildSelectableStatusOptions(
      statusOptions,
      dashboardQuery.data?.status_choices ?? [],
      baseCustomers.map((customer) => customer.status),
      formValues.status,
    ),
    [baseCustomers, dashboardQuery.data?.status_choices, formValues.status, statusOptions],
  )
  const selectedStatusFilterSet = useMemo(
    () => new Set(statusFilters.map((value) => normalizeStatusKey(value)).filter(Boolean)),
    [statusFilters],
  )
  const selectedStatusFilterValues = useMemo(
    () => statusFilters.map((value) => value.trim()).filter(Boolean),
    [statusFilters],
  )
  const selectedStatusCustomersQuery = useAsyncData(
    () => Promise.all(selectedStatusFilterValues.map((status) => crmService.filterByStatus(status))).then((results) => results.flat()),
    [selectedStatusFilterValues.join('|')],
    { enabled: selectedStatusFilterValues.length > 0 },
  )
  const customers = useMemo(() => {
    if (selectedStatusFilterValues.length === 0) {
      return baseCustomers
    }

    const merged = new Map<number, CustomerSummary>()

    for (const customer of baseCustomers) {
      merged.set(customer.id, customer)
    }

    for (const customer of selectedStatusCustomersQuery.data ?? emptyCustomers) {
      merged.set(customer.id, customer)
    }

    return [...merged.values()]
  }, [baseCustomers, selectedStatusCustomersQuery.data, selectedStatusFilterValues.join('|')])

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of baseCustomers) {
      const key = normalizeStatusKey(c.status)
      if (key) map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [baseCustomers])

  const allChipStatuses = useMemo(() => {
    const seen = new Set<string>()
    const result: Array<{ value: string; label: string; color: string }> = []

    const add = (value: string, label: string, color: string) => {
      const key = normalizeStatusKey(value)
      if (!key || seen.has(key)) return
      seen.add(key)
      result.push({ value, label, color })
    }

    // 1. API-configured statuses with colors (ordered)
    for (const opt of statusOptions) {
      add(opt.value, opt.label, opt.color)
    }

    // 2. All status_choices from dashboard response — includes newly added statuses
    for (const choice of (dashboardQuery.data?.status_choices ?? [])) {
      const meta = statusMetaMap.get(normalizeStatusKey(choice.value))
      add(choice.value, t(`crm.status_label.${normalizeStatusKey(choice.value)}`, choice.label), meta?.color ?? '#8A90A2')
    }

    // 3. Actual customer statuses as final fallback
    for (const c of baseCustomers) {
      const meta = statusMetaMap.get(normalizeStatusKey(c.status))
      add(c.status, meta?.label ?? t(`crm.status_label.${normalizeStatusKey(c.status)}`, c.status), meta?.color ?? '#8A90A2')
    }

    return result
  }, [statusOptions, dashboardQuery.data?.status_choices, baseCustomers, statusMetaMap, t])


  const displayedCustomers = useMemo(() => {
    const normalizedSearch = normalizeFilterValue(deferredSearch)
    const normalizedPlatformFilter = normalizeFilterValue(platformFilter)
    const statusFilterActive = selectedStatusFilterSet.size > 0
    const startDate = dateStart ? new Date(`${dateStart}T00:00:00`) : null
    const endDate = dateEnd ? new Date(`${dateEnd}T23:59:59.999`) : null

    return customers.filter((customer) => {
      const customerPlatforms = getCustomerPlatforms(customer)
      const matchesSearch = normalizedSearch
        ? [
            getCustomerDisplayName(customer),
            formatUsernameHandle(customer.username),
            customer.phone_number,
            customer.phone,
            customer.notes,
            getCustomerDisplayPlatform(customer),
            customer.status,
            customer.assistant_name,
            customer.conversation_language,
          ]
            .filter(Boolean)
            .some((value) => normalizeFilterValue(String(value)).includes(normalizedSearch))
        : true

      const matchesStatus = statusFilterActive
        ? [...getCustomerStatusKeys(customer, statusMetaMap)].some((key) => selectedStatusFilterSet.has(key))
        : true
      const matchesPlatform = normalizedPlatformFilter
        ? customerPlatforms.some((platform) => normalizeFilterValue(platform) === normalizedPlatformFilter)
        : true

      const createdAt = normalizeDateValue(customer.created_at)
      const matchesStart = startDate && createdAt ? createdAt >= startDate : !startDate
      const matchesEnd = endDate && createdAt ? createdAt <= endDate : !endDate

      return matchesSearch && matchesStatus && matchesPlatform && matchesStart && matchesEnd
    })
  }, [customers, dateEnd, dateStart, deferredSearch, platformFilter, selectedStatusFilterSet, statusMetaMap])

  useEffect(() => {
    const targetCustomerId = initialReturnState?.customerId
    const isDashboardReady = Boolean(dashboardQuery.data)
    const isPeriodReady = !selectedPeriod || Boolean(periodReportQuery.data)
    const isSelectedStatusReady = selectedStatusFilterValues.length === 0 || Boolean(selectedStatusCustomersQuery.data)
    const isDataReady = isDashboardReady && isPeriodReady && isSelectedStatusReady

    if (restoreScrollTimerRef.current !== null) {
      window.clearTimeout(restoreScrollTimerRef.current)
      restoreScrollTimerRef.current = null
    }

    if (!shouldRestoreReturnState || !targetCustomerId || hasRestoredReturnTargetRef.current) {
      return
    }

    if (!isDataReady) {
      return
    }

    const targetIndex = displayedCustomers.findIndex((customer) => customer.id === targetCustomerId)
    if (targetIndex < 0) {
      hasRestoredReturnTargetRef.current = true
      clearCrmReturnState(storageKey)
      return
    }

    const expectedPage = Math.max(1, Math.floor(targetIndex / pageSizeValue) + 1)
    if (tablePage !== expectedPage) {
      setTablePage(expectedPage)
      return
    }

    const tryScroll = () => {
      const row = document.querySelector<HTMLElement>(`tr[data-row-key="${targetCustomerId}"]`)
      if (row) {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' })
        hasRestoredReturnTargetRef.current = true
        restoreScrollAttemptsRef.current = 0
        clearCrmReturnState(storageKey)
        restoreScrollTimerRef.current = null
        return
      }

      restoreScrollAttemptsRef.current += 1
      if (restoreScrollAttemptsRef.current >= 20) {
        return
      }

      restoreScrollTimerRef.current = window.setTimeout(tryScroll, 100)
    }

    restoreScrollTimerRef.current = window.setTimeout(tryScroll, 0)

    return () => {
      if (restoreScrollTimerRef.current !== null) {
        window.clearTimeout(restoreScrollTimerRef.current)
        restoreScrollTimerRef.current = null
      }
    }
  }, [
    dashboardQuery.data,
    displayedCustomers,
    initialReturnState,
    pageSizeValue,
    periodReportQuery.data,
    selectedPeriod,
    selectedStatusCustomersQuery.data,
    selectedStatusFilterValues.length,
    shouldRestoreReturnState,
    storageKey,
    tablePage,
  ])

  const [isRefreshing, setIsRefreshing] = useState(false)

  async function refreshAll() {
    setIsRefreshing(true)
    await Promise.allSettled([
      dashboardQuery.refetch(),
      statusesQuery.refetch(),
      summaryQuery.refetch(),
      statusSummaryQuery.refetch(),
      ...(selectedPeriod ? [periodReportQuery.refetch()] : []),
      ...(selectedStatusFilterValues.length > 0 ? [selectedStatusCustomersQuery.refetch()] : []),
    ])
    setIsRefreshing(false)
  }

  function resetFilters() {
    setSearch('')
    setStatusFilters([])
    setPlatformFilter('')
    setDateStart('')
    setDateEnd('')
  }

  function openCreateModal() {
    setModalMode('create')
    setSelectedCustomer(null)
    setFormValues(initialFormValues)
    setAudioFile(null)
    setIsFormOpen(true)
  }

  function openEditModal(customer: CustomerSummary) {
    setModalMode('edit')
    setSelectedCustomer(customer)
    setFormValues(toFormValues(customer))
    setAudioFile(null)
    setIsFormOpen(true)
  }

  function openCustomerDrawer(customer: CustomerSummary) {
    setDetailCustomer(customer)
  }

  function handleSearchTelegramReturn(phoneNumber: string, customerId: number) {
    const currentViewState = latestCrmViewStateRef.current
    const customerIndex = displayedCustomers.findIndex((customer) => customer.id === customerId)
    const effectiveIndex = customerIndex >= 0 ? customerIndex : Math.max(0, (currentViewState.tablePage - 1) * pageSizeValue)

    saveCrmReturnState(storageKey, {
      ...currentViewState,
      customerId,
      customerIndex: effectiveIndex,
    })
    setDetailCustomer(null)
    navigate(`/cognilabsai/chat?telegram_search=${encodeURIComponent(phoneNumber)}&return_customer_id=${customerId}&return_to=${encodeURIComponent(`${routeBasePath}/customers`)}`)
  }

  function syncCustomerInUi(nextCustomer: CustomerSummary) {
    dashboardQuery.setData((current: typeof dashboardQuery.data) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        customers: current.customers.map((customer) =>
          customer.id === nextCustomer.id ? { ...customer, ...nextCustomer } : customer,
        ),
      }
    })

    setSelectedCustomer((current) => (current?.id === nextCustomer.id ? nextCustomer : current))
    setDetailCustomer((current) => (current?.id === nextCustomer.id ? nextCustomer : current))
  }

  async function handleDeleteCustomer(customer: CustomerSummary) {
    const customerName = getCustomerDisplayName(customer)
    const approved = await confirm({
      title: t('customers.confirm.delete_title', 'Delete {{name}}?', { name: customerName }),
      description: t('customers.confirm.delete_description', 'The customer record will be permanently removed and cannot be undone.'),
      confirmLabel: t('customers.confirm.delete_confirm', 'Delete customer'),
      cancelLabel: t('common.cancel', 'Cancel'),
      tone: 'danger',
    })

    if (!approved) {
      return
    }

    try {
      await crmService.deleteCustomer(customer.id)
      await Promise.allSettled([dashboardQuery.refetch(), summaryQuery.refetch()])
      showToast({
        title: t('customers.toast.deleted.title', 'Customer deleted'),
        description: t('customers.toast.deleted.description', '{{name}} has been removed from the CRM list.', { name: customerName }),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: t('customers.errors.delete_failed', 'Delete failed'),
        description: getCustomerActionErrorMessage(error, t),
        tone: 'error',
      })
      if (isNotFoundError(error)) {
        void Promise.allSettled([dashboardQuery.refetch(), summaryQuery.refetch()])
      }
    }
  }

  const [savingStatusId, setSavingStatusId] = useState<number | null>(null)

  async function handleInlineStatusChange(customer: CustomerSummary, nextStatus: string): Promise<boolean> {
    const previous = customer
    const formData = new FormData()
    formData.append('status', nextStatus)
    formData.append('customer_status', nextStatus)
    setSavingStatusId(customer.id)
    syncCustomerInUi({ ...customer, status: nextStatus })
    try {
      await crmService.patchCustomer(customer.id, formData)
      showToast({
        title: t('customers.toast.status_changed', 'Status changed'),
        description: t('customers.toast.status_changed_description', '{{name}} → {{status}}', {
          name: getCustomerDisplayName(customer),
          status: t(`crm.status_label.${normalizeStatusKey(nextStatus)}`, nextStatus),
        }),
        tone: 'success',
      })
      void Promise.allSettled([
        summaryQuery.refetch(),
        statusSummaryQuery.refetch(),
        ...(selectedPeriod ? [periodReportQuery.refetch()] : []),
        ...(selectedStatusFilterValues.length > 0 ? [selectedStatusCustomersQuery.refetch()] : []),
      ])
      return true
    } catch (error) {
      syncCustomerInUi(previous)
      showToast({
        title: t('customers.errors.status_change_failed', 'Could not change the status'),
        description: getCustomerActionErrorMessage(error, t),
        tone: 'error',
      })
      return false
    } finally {
      setSavingStatusId(null)
    }
  }

  async function handleSubmitCustomer() {
    if (
      !formValues.full_name.trim() ||
      !formValues.platform.trim() ||
      !formValues.phone_number.trim() ||
      !formValues.status.trim()
    ) {
      showToast({
        title: t('customers.errors.required_fields.title', 'Required fields missing'),
        description: t('customers.errors.required_fields.description', 'Full name, platform, phone number, and status are required.'),
        tone: 'error',
      })
      return
    }

    setIsFormSubmitting(true)

    try {
      const formData = buildCustomerFormData(formValues, modalMode, audioFile)
      let updatedCustomer: CustomerSummary | null = null

      if (modalMode === 'create') {
        await crmService.createCustomer(formData)
      } else if (selectedCustomer) {
        const draftedCustomer = buildCustomerDraft(selectedCustomer, formValues)

        await crmService.patchCustomer(selectedCustomer.id, formData)
        try {
          updatedCustomer = buildCustomerDraft(await crmService.detail(selectedCustomer.id), formValues)
        } catch {
          updatedCustomer = draftedCustomer
        }

        syncCustomerInUi(updatedCustomer)
      }

      setIsFormOpen(false)
      setAudioFile(null)
      await Promise.allSettled([
        dashboardQuery.refetch(),
        summaryQuery.refetch(),
        statusesQuery.refetch(),
      ])

      if (updatedCustomer) {
        syncCustomerInUi(updatedCustomer)
      }

      showToast({
        title: modalMode === 'create'
          ? t('customers.toast.created.title', 'Customer created')
          : t('customers.toast.updated.title', 'Customer updated'),
        description: updatedCustomer
          ? t('customers.toast.saved.synced_description', 'The customer row and detail panel were refreshed.')
          : t('customers.toast.saved.refreshed_description', 'The CRM list has been refreshed.'),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: t('customers.errors.save_failed', 'Save failed'),
        description: getCustomerActionErrorMessage(error, t),
        tone: 'error',
      })
      if (isNotFoundError(error)) {
        setIsFormOpen(false)
        void Promise.allSettled([dashboardQuery.refetch(), summaryQuery.refetch()])
      }
    } finally {
      setIsFormSubmitting(false)
    }
  }

  if (dashboardQuery.isLoading && !dashboardQuery.data) {
    return (
      <LoadingStateBlock
        eyebrow={crmKind === 'outbound' ? t('outbound_crm.page.eyebrow', 'Outbound CRM workspace') : t('customers.page.eyebrow', 'CRM workspace')}
        title={t('customers.loading.dashboard.title', 'CRM dashboard loading')}
        description={t('customers.loading.dashboard.description', 'Retrieving customers and summary statistics.')}
      />
    )
  }

  if (dashboardQuery.isError && !dashboardQuery.data) {
    return (
      <ErrorStateBlock
        eyebrow={crmKind === 'outbound' ? t('outbound_crm.page.eyebrow', 'Outbound CRM workspace') : t('customers.page.eyebrow', 'CRM workspace')}
        title={t('customers.errors.dashboard.title', 'CRM dashboard failed to load')}
        description={t('customers.errors.dashboard.description', 'Could not retrieve CRM data. Please retry.')}
        actionLabel={t('common.retry', 'Retry')}
        onAction={() => {
          void refreshAll()
        }}
      />
    )
  }

  const periodOptions: Array<{ value: typeof selectedPeriod; label: string }> = [
    { value: '', label: t('customers.period.all', 'All time') },
    { value: 'today', label: t('customers.period.today', 'Today') },
    { value: '3d', label: t('customers.period.last_3_days', 'Last 3 days') },
    { value: '7d', label: t('customers.period.last_7_days', 'Last 7 days') },
    { value: '30d', label: t('customers.period.last_30_days', 'Last 30 days') },
    { value: '90d', label: t('customers.period.last_90_days', 'Last 90 days') },
  ]
  const listTitle = crmKind === 'outbound' ? t('outbound_crm.page.title', 'Outbound CRM') : t('customers.page.title', 'CRM dashboard')
  const periodLabel = periodOptions.find((option) => option.value === selectedPeriod)?.label ?? ''
  const todayKey = new Date().toDateString()
  const createdTodayCount = (dashboardQuery.data?.customers ?? emptyCustomers)
    .filter((customer) => normalizeDateValue(customer.created_at)?.toDateString() === todayKey).length

  const statusChoices = allChipStatuses.map((option) => ({ value: option.value, label: option.label, color: option.color, icon: statusIconFor(option.value) }))

  const modals = (
    <>
      <CustomerDetailDrawer
        open={detailCustomer !== null}
        customerId={detailCustomer?.id ?? null}
        initialCustomer={detailCustomer}
        onClose={() => setDetailCustomer(null)}
        onOpenChat={(id) => {
          setDetailCustomer(null)
          navigate(`/cognilabsai/chat?conversation_id=${id}`)
        }}
        onSearchTelegram={handleSearchTelegramReturn}
        onEdit={(customer) => {
          setDetailCustomer(null)
          setSelectedCustomer(customer)
          setFormValues(toFormValues(customer))
          setModalMode('edit')
          setIsFormOpen(true)
        }}
        statusChoices={statusChoices}
        onStatusChange={handleInlineStatusChange}
        onCustomerUpdated={syncCustomerInUi}
      />

      <CustomerFormModal
        open={isFormOpen}
        mode={modalMode}
        customerId={modalMode === 'edit' ? (selectedCustomer?.id ?? undefined) : undefined}
        values={formValues}
        statusOptions={[...statusFilterOptions]}
        onClose={() => setIsFormOpen(false)}
        onChange={(field, value) =>
          setFormValues((current: CustomerFormValues) => ({
            ...current,
            [field]: value,
          }))
        }
        onFileChange={setAudioFile}
        onSubmit={() => void handleSubmitCustomer()}
        isSubmitting={isFormSubmitting}
      />

      {audioModal && (
        <AudioPlayerModal
          src={audioModal.src}
          name={audioModal.name}
          onClose={() => setAudioModal(null)}
        />
      )}
    </>
  )

  /* ── CRM overview: dashboard only; the list lives on its own page ── */
  if (view === 'overview') {
    return (
      <section className="stagger-in flex flex-col gap-[18px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="ui-page-title text-[var(--foreground)]">{listTitle}</h1>
            <p className="text-sm text-[var(--muted)]">
              {t('customers.page.overview_subtitle', 'Pipeline, callbacks and team results at a glance.')}
            </p>
          </div>
          <Button onClick={() => navigate(`${routeBasePath}/customers`)} rightIcon={<ArrowRight size={16} />}>
            {t('customers.page.open_list', 'Customer list')}
          </Button>
        </div>

        <CrmDashboardOverview
          statusLabels={Object.fromEntries(statusOptions.map((option) => [option.value, option.label]))}
          customers={baseCustomers}
          stats={summaryQuery.data ?? null}
          conversion={conversionQuery.data ?? null}
          createdToday={createdTodayCount}
          onOpenList={(query) => navigate(`${routeBasePath}/customers${query ? `?${query}` : ''}`)}
          period={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
          onOpenCustomer={(customerId) => {
            const match = baseCustomers.find((customer) => customer.id === customerId)
            if (match) setDetailCustomer(match)
          }}
          onFocusStatus={(statusKey) => {
            const match = statusOptions.find((option) => normalizeStatusKey(option.value) === normalizeStatusKey(statusKey))
            navigate(`${routeBasePath}/customers?status=${encodeURIComponent(match?.value ?? statusKey)}`)
          }}
        />
        {modals}
      </section>
    )
  }

  /* ── Customers page: title + search, metric cards, then the CRM table ── */
  const statusMetaFor = (value: string) => {
    const meta = statusMetaMap.get(normalizeStatusKey(value))
    return { label: meta?.label ?? localizeStatus(value, value), color: meta?.color ?? '#8A90A2', icon: statusIconFor(value) }
  }

  const gridColumns: GridColumn<CustomerSummary>[] = [
    {
      key: 'name',
      header: t('customers.table.client', 'Customer'),
      width: 230,
      hideable: false,
      frozen: true,
      sortValue: (row) => getCustomerDisplayName(row),
      render: (row) => {
        const name = getCustomerDisplayName(row)
        return (
          <span className="flex min-w-0 items-center gap-2.5">
            <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10.5px] font-bold ring-2 ring-[var(--surface)]', avatarTone(name))}>{initialsFor(name)}</span>
            <span className="truncate font-semibold text-[var(--foreground)] transition-colors group-hover/row:text-[var(--primary)]">{name}</span>
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
        ) : '—'
      },
    },
    {
      key: 'platform',
      header: t('customers.table.platform', 'Platform'),
      width: 150,
      sortValue: (row) => getCustomerDisplayPlatform(row) ?? '',
      render: (row) => {
        const platform = getCustomerDisplayPlatform(row)
        if (!platform) return '—'
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
      header: t('customers.table.status', 'Status'),
      width: 210,
      sortValue: (row) => row.status,
      exportValue: (row) => statusMetaFor(row.status).label,
      render: (row) => {
        const meta = statusMetaFor(row.status)
        if (!canEditCustomer) return <StatusPill label={meta.label} color={meta.color} icon={meta.icon} />
        return (
          <StatusSelect
            current={row.status}
            label={meta.label}
            color={meta.color}
            icon={meta.icon}
            options={statusChoices}
            saving={savingStatusId === row.id}
            title={t('customers.table.change_status', 'Change status')}
            onChange={(next) => void handleInlineStatusChange(row, next)}
          />
        )
      },
    },
    {
      key: 'flags',
      header: t('customers.table.flags', 'Flags'),
      width: 200,
      exportValue: (row) => [
        row.lead_response_metrics?.is_late_response ? t('customers.table.late', 'Late') : null,
        row.lead_response_metrics && !row.lead_response_metrics.status_changed ? t('customers.table.not_contacted', 'Not contacted') : null,
        row.lead_response_metrics?.status_changed_without_note ? t('customers.table.no_note', 'No note') : null,
      ].filter(Boolean).join(', '),
      render: (row) => {
        const metrics = row.lead_response_metrics
        const late = metrics?.is_late_response
        const notContacted = metrics && !metrics.status_changed
        const noNote = metrics?.status_changed_without_note
        if (!late && !notContacted && !noNote) return <span className="text-[var(--caption)]">—</span>
        return (
          <span className="flex items-center gap-1">
            {late ? <FlagTag tone="danger" icon={AlarmClock}>{`${t('customers.table.late', 'Late')} ${metrics?.late_human ?? ''}`.trim()}</FlagTag> : null}
            {!late && notContacted ? <FlagTag tone="warning" icon={CircleDashed}>{t('customers.table.not_contacted', 'Not contacted')}</FlagTag> : null}
            {noNote ? <FlagTag tone="neutral" icon={NotebookPen}>{t('customers.table.no_note', 'No note')}</FlagTag> : null}
          </span>
        )
      },
    },
    {
      key: 'assistant',
      header: t('customers.table.assistant', 'Assistant'),
      width: 150,
      sortValue: (row) => row.assistant_name ?? '',
      render: (row) => row.assistant_name
        ? <span className="inline-flex items-center gap-1.5"><Bot size={14} className="text-[var(--violet-text)]" />{row.assistant_name}</span>
        : <span className="text-[var(--caption)]">—</span>,
    },
    {
      key: 'username',
      header: t('customers.table.username', 'Username'),
      width: 150,
      defaultHidden: true,
      sortValue: (row) => formatUsernameHandle(row.username) ?? '',
      render: (row) => formatUsernameHandle(row.username) || '—',
    },
    {
      key: 'audio',
      header: t('customers.table.audio', 'Audio'),
      width: 150,
      render: (row) => {
        const audioSource = resolveAudioUrl(row, apiBasePath)
        if (!audioSource) return <span className="text-[var(--caption)]">—</span>
        return (
          <span onClick={(event) => event.stopPropagation()}>
            <TableAudioControl src={audioSource} customerName={getCustomerDisplayName(row)} onOpenPlayer={(src, name) => setAudioModal({ src, name })} />
          </span>
        )
      },
    },
    {
      key: 'notes',
      header: t('customers.table.notes', 'Notes'),
      width: 240,
      exportValue: (row) => row.notes ?? '',
      render: (row) => (
        <span className="text-[var(--muted-strong)]" title={row.notes ?? undefined}>{row.notes?.trim() ? summarizeCustomerNotes(row.notes, 8) : '—'}</span>
      ),
    },
    {
      key: 'recall',
      header: t('customers.table.recall', 'Recall time'),
      width: 170,
      sortValue: (row) => row.recall_time ?? '',
      render: (row) => renderRecallTime(row.recall_time),
    },
    {
      key: 'created',
      header: t('customers.table.created', 'Created'),
      width: 150,
      sortValue: (row) => row.created_at ?? '',
      render: (row) => <span className="tabular-nums text-[var(--muted-strong)]">{formatDateTime(row.created_at)}</span>,
    },
    {
      key: 'actions',
      header: t('customers.table.actions', 'Actions'),
      width: 92,
      align: 'center',
      render: (row) => (
        <span className="flex items-center justify-center gap-0.5" onClick={(event) => event.stopPropagation()}>
          {canEditCustomer ? <button type="button" onClick={() => openEditModal(row)} aria-label={t('customers.actions.edit', 'Edit')} title={t('customers.actions.edit', 'Edit')} className="grid h-7 w-7 place-items-center rounded-[7px] text-[var(--muted)] transition-all hover:bg-[var(--blue-dim)] hover:text-[var(--primary)] active:scale-90">
            <Pencil size={14} />
          </button> : null}
          {canDeleteCustomer ? <button type="button" onClick={() => void handleDeleteCustomer(row)} aria-label={t('customers.actions.delete', 'Delete')} title={t('customers.actions.delete', 'Delete')} className="grid h-7 w-7 place-items-center rounded-[7px] text-[var(--muted)] transition-all hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)] active:scale-90">
            <Trash2 size={14} />
          </button> : null}
        </span>
      ),
    },
  ]

  // Filter options
  const platformCounts = new Map<string, number>()
  for (const customer of baseCustomers) {
    for (const platform of getCustomerPlatforms(customer)) {
      if (platform) platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + 1)
    }
  }
  const platformOptions = [...platformCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([value, count]) => ({ value, label: value, count, ...platformVisual(value) }))
  const statusOptionsForFilter = allChipStatuses.map((option) => ({
    value: option.value,
    label: option.label,
    color: option.color,
    icon: statusIconFor(option.value),
    count: statusCounts.get(normalizeStatusKey(option.value)) ?? 0,
  }))
  const toggleStatus = (value: string) => {
    const key = normalizeStatusKey(value)
    setStatusFilters((prev) => (prev.some((item) => normalizeStatusKey(item) === key) ? prev.filter((item) => normalizeStatusKey(item) !== key) : [...prev, value]))
    setTablePage(1)
  }
  const clearAll = () => { resetFilters(); setSelectedPeriod(''); setTablePage(1) }
  const filterCount = statusFilters.length + (platformFilter ? 1 : 0) + (selectedPeriod ? 1 : 0) + (dateStart || dateEnd ? 1 : 0)
  const hasAnyFilter = filterCount > 0 || Boolean(search)

  // Status cards: the stages a seller acts on, with what is due today and what is overdue.
  const nowDate = new Date()
  const nowMs = nowDate.getTime()
  const todayString = nowDate.toDateString()
  const dueByStatus = new Map<string, { today: number; overdue: number }>()
  for (const customer of baseCustomers) {
    if (!customer.recall_time) continue
    const recall = new Date(customer.recall_time)
    if (Number.isNaN(recall.getTime())) continue
    const key = normalizeStatusKey(customer.status)
    const entry = dueByStatus.get(key) ?? { today: 0, overdue: 0 }
    if (recall.getTime() < nowMs) entry.overdue += 1
    else if (recall.toDateString() === todayString) entry.today += 1
    dueByStatus.set(key, entry)
  }
  const preferredCards = statusCardKeys
    .map((key) => allChipStatuses.find((option) => normalizeStatusKey(option.value) === key))
    .filter((option): option is (typeof allChipStatuses)[number] => Boolean(option))
  const statusCards = [
    ...preferredCards,
    // CRMs with their own statuses (outbound) fill the free slots with their busiest ones.
    ...allChipStatuses
      .filter((option) => !preferredCards.includes(option))
      .sort((left, right) => (statusCounts.get(normalizeStatusKey(right.value)) ?? 0) - (statusCounts.get(normalizeStatusKey(left.value)) ?? 0)),
  ].slice(0, 4).map((option) => {
    const key = normalizeStatusKey(option.value)
    const count = statusCounts.get(key) ?? 0
    const due = dueByStatus.get(key)
    const share = baseCustomers.length > 0 ? Math.round((count / baseCustomers.length) * 100) : 0
    // One caption line: share of all customers, then what is due today / overdue.
    const caption = [
      t('customers.status_card.share', '{{value}}% of customers', { value: share }),
      due?.today ? t('customers.status_card.today', 'Today: {{count}}', { count: due.today }) : null,
      due?.overdue ? t('customers.status_card.overdue', 'Overdue: {{count}}', { count: due.overdue }) : null,
    ].filter(Boolean).join(' · ')
    return {
      key,
      value: option.value,
      meta: statusMetaFor(option.value),
      icon: statusKpiIconFor(option.value),
      count,
      caption,
      active: statusFilters.length === 1 && selectedStatusFilterSet.has(key),
    }
  })

  const tokens = hasAnyFilter ? (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] bg-[var(--card-hover)] px-3 py-2">
      {selectedPeriod ? <FilterToken onRemove={() => { setSelectedPeriod(''); setTablePage(1) }} removeLabel={t('common.clear', 'Clear')}>{periodLabel}</FilterToken> : null}
      {dateStart || dateEnd ? (
        <FilterToken onRemove={() => { setDateStart(''); setDateEnd(''); setTablePage(1) }} removeLabel={t('common.clear', 'Clear')}>{`${dateStart || '…'} – ${dateEnd || '…'}`}</FilterToken>
      ) : null}
      {statusFilters.map((value) => {
        const meta = statusMetaFor(value)
        return <FilterToken key={value} color={meta.color} onRemove={() => toggleStatus(value)} removeLabel={t('common.clear', 'Clear')}>{meta.label}</FilterToken>
      })}
      {platformFilter ? <FilterToken onRemove={() => { setPlatformFilter(''); setTablePage(1) }} removeLabel={t('common.clear', 'Clear')}>{platformFilter}</FilterToken> : null}
      {search ? <FilterToken onRemove={() => { setSearch(''); setTablePage(1) }} removeLabel={t('common.clear', 'Clear')}>“{search}”</FilterToken> : null}
      <button type="button" onClick={() => { clearAll(); setSearch('') }} className="ml-1 text-[12px] font-semibold text-[var(--primary)] hover:underline">
        {t('customers.filters.clear_all', 'Clear all')}
      </button>
    </div>
  ) : null

  return (
    <section className="stagger-in flex flex-col gap-4">
      {/* Title row: name + count on the left, search and archive on the right */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="text-[24px] leading-8 font-bold tracking-[-0.025em] text-[var(--foreground)]">{t('customers.list_page.title', 'Customers')}</h1>
          <span className="rounded-[6px] bg-[var(--blue-dim)] px-2 py-0.5 text-[12px] font-semibold text-[var(--primary)] tabular-nums">
            {t('customers.list_page.records', '{{count}} records', { count: baseCustomers.length })}
          </span>
          {crmKind === 'outbound' ? <span className="rounded-[6px] bg-[var(--muted-surface)] px-2 py-0.5 text-[12px] font-semibold text-[var(--muted-strong)]">Outbound</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="group/search relative flex h-10 w-full items-center sm:w-[320px]">
            <Search size={16} className="pointer-events-none absolute left-3 text-[var(--muted)] transition-colors group-focus-within/search:text-[var(--primary)]" />
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setTablePage(1) }}
              placeholder={t('customers.filters.search_placeholder', 'Name, username, note, or phone')}
              aria-label={t('customers.filters.search_label', 'Search')}
              className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] pr-10 pl-9 text-[13.5px] text-[var(--foreground)] shadow-[0_1px_2px_rgba(14,21,37,0.04)] transition-[border-color,box-shadow] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:shadow-[0_0_0_4px_rgba(43,89,255,0.12)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {search ? (
              <button type="button" onClick={() => { setSearch(''); setTablePage(1) }} aria-label={t('common.clear', 'Clear')} className="absolute right-2.5 grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--muted-surface)] hover:text-[var(--foreground)]">
                <X size={14} />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 hidden rounded-[5px] border border-[var(--border)] bg-[var(--muted-surface)] px-1.5 font-mono text-[11px] text-[var(--muted)] sm:block">/</kbd>
            )}
          </label>
          {crmKind === 'outbound' ? (
            <button type="button" onClick={() => navigate(`${routeBasePath}/statuses`)} className={cn(gridButton, 'h-10 px-3.5')}>
              <ListTodo size={15} /> {t('outbound_crm.actions.statuses', 'Statuses')}
            </button>
          ) : null}
          <button type="button" onClick={() => navigate(`${routeBasePath}/archived`)} className={cn(gridButton, 'h-10 px-3.5')}>
            <ArchiveIcon size={15} /> {t('customers.actions.archive', 'Archive')}
          </button>
        </div>
      </header>

      {/* Status cards — each also works as a quick filter (click again to clear) */}
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        {statusCards.map((card) => (
          <MetricTile
            key={card.key}
            label={card.meta.label}
            value={card.count}
            caption={card.caption}
            icon={card.icon}
            accent={card.meta.color}
            active={card.active}
            onClick={() => { setStatusFilters(card.active ? [] : [card.value]); setTablePage(1) }}
          />
        ))}
      </div>

      <DataGrid
        id={`${storageKey}-customers`}
        rowNumbers
        exportName={canExportCustomers ? (crmKind === 'outbound' ? 'outbound-leads' : 'customers') : undefined}
        toolbarStart={(
          <>
            <button type="button" onClick={() => void refreshAll()} className={cn(gridButton, 'border-[var(--blue-border)] text-[var(--primary)] hover:bg-[var(--blue-dim)]')}>
              <RefreshCw size={14} className={cn(isRefreshing && 'animate-spin')} />
              {t('customers.actions.refresh', 'Refresh')}
            </button>
            <FilterPanel
              labels={{
                filter: t('customers.filters.filter', 'Filter'),
                period: t('customers.filters.period', 'Period'),
                status: t('customers.filters.status_label', 'Status'),
                platform: t('customers.filters.platform_label', 'Platform'),
                custom: t('customers.filters.custom_range', 'Custom range'),
                from: t('customers.filters.start_date_label', 'Start date'),
                to: t('customers.filters.end_date_label', 'End date'),
                clear: t('customers.filters.clear_all', 'Clear all'),
                done: t('customers.filters.done', 'Done'),
              }}
              activeCount={filterCount}
              period={selectedPeriod}
              periodOptions={periodOptions}
              onPeriodChange={(value) => { setSelectedPeriod(value); setTablePage(1) }}
              dateStart={dateStart}
              dateEnd={dateEnd}
              onDatesChange={(start, end) => { setDateStart(start); setDateEnd(end); setTablePage(1) }}
              statusOptions={statusOptionsForFilter}
              isStatusSelected={(value) => selectedStatusFilterSet.has(normalizeStatusKey(value))}
              onStatusToggle={toggleStatus}
              platformOptions={platformOptions}
              platform={platformFilter}
              onPlatformChange={(value) => { setPlatformFilter(value); setTablePage(1) }}
              onClearAll={clearAll}
            />
          </>
        )}
        toolbarEnd={canCreateCustomer ? (
          <button type="button" onClick={openCreateModal} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[var(--primary)] px-3 text-[12.5px] font-semibold text-white shadow-[0_6px_16px_-8px_rgba(43,89,255,0.9)] transition-[background-color,transform] duration-150 hover:bg-[var(--primary-hover)] active:scale-[0.97]">
            <Plus size={15} strokeWidth={2.4} />
            {t('customers.actions.add', 'Add customer')}
          </button>
        ) : null}
        belowToolbar={tokens}
        columns={gridColumns}
        rows={displayedCustomers}
        getRowKey={(row) => String(row.id)}
        onRowClick={openCustomerDrawer}
        loading={dashboardQuery.isLoading || (Boolean(selectedPeriod) && periodReportQuery.isLoading)}
        page={tablePage}
        onPageChange={setTablePage}
        pageSize={pageSizeValue}
        onPageSizeChange={(size) => setPageSize(String(size))}
        emptyState={
          <EmptyStateBlock
            eyebrow={crmKind === 'outbound' ? t('outbound_crm.page.eyebrow', 'Outbound CRM workspace') : t('customers.page.eyebrow', 'CRM workspace')}
            title={t('customers.table.empty_title', 'No customers found')}
            description={t('customers.table.empty_description', 'The current filters returned no customer records.')}
          />
        }
      />

      {modals}
    </section>
  )
}
