/* eslint-disable @typescript-eslint/no-unused-vars */
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Archive as ArchiveIcon, ArrowRight, Filter, ListTodo, Pencil, Percent, PhoneCall, Plus, RefreshCw, Search, Trash2, UserPlus, UsersRound, X } from 'lucide-react'
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
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { DataGrid, type GridColumn } from '../../../shared/ui/data-grid'
import { StatCard } from '../../../shared/ui/stat-card'
import { Input } from '../../../shared/ui/input'
import { CalendarField } from '../../../shared/ui/calendar-field'
import { SelectField, type SelectFieldOption } from '../../../shared/ui/select-field'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { crmService as baseCrmService } from '../../../shared/api/services/crm.service'
import { AudioPlayerModal } from '../components/AudioPlayerModal'
import { CrmDashboardOverview } from '../components/CrmDashboardOverview'
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

function StatusBadge({
  status,
  statusMetaMap,
}: {
  status: string
  statusMetaMap: Map<string, DynamicStatusOption>
}) {
  const meta = statusMetaMap.get(normalizeStatusKey(status))

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs leading-none font-semibold capitalize"
      style={{
        color: meta?.color ?? 'var(--muted-strong)',
        backgroundColor: meta?.color ? `${meta.color}1F` : 'var(--muted-surface)',
      }}
    >
      {meta?.label ?? status}
    </span>
  )
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
  const [pageSize, setPageSize] = useState(() => initialReturnState?.pageSize ?? '75')
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
    pageSize: '75',
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

  const pageSizeValue = Number(pageSize) || 75
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
  const statusOptions = statusesQuery.data ?? emptyStatuses

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
      add(choice.value, choice.label, meta?.color ?? '#8A90A2')
    }

    // 3. Actual customer statuses as final fallback
    for (const c of baseCustomers) {
      const meta = statusMetaMap.get(normalizeStatusKey(c.status))
      add(c.status, meta?.label ?? c.status, meta?.color ?? '#8A90A2')
    }

    return result
  }, [statusOptions, dashboardQuery.data?.status_choices, baseCustomers, statusMetaMap])

  const availablePlatforms = useMemo(() => {
    return Array.from(
      new Set(
        customers
          .flatMap((item) => getCustomerPlatforms(item))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b))
  }, [customers])

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

  async function refreshAll() {
    await Promise.allSettled([
      dashboardQuery.refetch(),
      statusesQuery.refetch(),
      summaryQuery.refetch(),
      statusSummaryQuery.refetch(),
      ...(selectedPeriod ? [periodReportQuery.refetch()] : []),
      ...(selectedStatusFilterValues.length > 0 ? [selectedStatusCustomersQuery.refetch()] : []),
    ])
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
  const platformFilterOptions = [
    { value: '', label: t('customers.filters.all_platforms', 'All platforms') },
    ...availablePlatforms.map((platform: string) => ({ value: platform, label: platform })),
  ]
  const activeFilterCount = [
    search,
    statusFilters.length > 0 ? 1 : 0,
    platformFilter,
    dateStart,
    dateEnd,
  ].filter((value) => Boolean(value)).length

  const resetPageAnd = <V,>(setter: (value: V) => void) => (value: V) => { setter(value); setTablePage(1) }
  const listTitle = crmKind === 'outbound' ? t('outbound_crm.page.title', 'Outbound CRM') : t('customers.page.title', 'CRM dashboard')
  const periodLabel = periodOptions.find((option) => option.value === selectedPeriod)?.label ?? ''
  const todayKey = new Date().toDateString()
  const createdTodayCount = (dashboardQuery.data?.customers ?? emptyCustomers)
    .filter((customer) => normalizeDateValue(customer.created_at)?.toDateString() === todayKey).length
  const needToCallOption = allChipStatuses.find((option) => normalizeStatusKey(option.value) === 'needtocall')
  const needToCallCount = statusCounts.get('needtocall') ?? 0

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
      <section className="flex flex-col gap-[18px]">
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

  /* ── Customers page: key numbers, status pills, then the customisable table ── */
  const gridColumns: GridColumn<CustomerSummary>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 84,
      sortValue: (row) => row.id,
      render: (row) => <span className="font-mono text-[12.5px] font-medium text-[var(--blue-text)]">#{row.id}</span>,
    },
    {
      key: 'name',
      header: t('customers.table.client', 'Customer'),
      width: 220,
      hideable: false,
      sortValue: (row) => getCustomerDisplayName(row),
      render: (row) => (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); openCustomerDrawer(row) }}
          className="truncate text-left font-semibold text-[var(--foreground)] transition-colors hover:text-[var(--primary)]"
        >
          {getCustomerDisplayName(row)}
        </button>
      ),
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
      key: 'phone',
      header: t('customers.table.phone', 'Phone'),
      width: 160,
      sortValue: (row) => row.phone_number ?? row.phone ?? '',
      render: (row) => <span className="tabular-nums">{row.phone_number ?? row.phone ?? '—'}</span>,
    },
    {
      key: 'platform',
      header: t('customers.table.platform', 'Platform'),
      width: 130,
      sortValue: (row) => getCustomerDisplayPlatform(row) ?? '',
      render: (row) => getCustomerDisplayPlatform(row) || '—',
    },
    {
      key: 'status',
      header: t('customers.table.status', 'Status'),
      width: 230,
      sortValue: (row) => row.status,
      render: (row) => (
        <span className="flex items-center gap-1">
          <StatusBadge status={row.status} statusMetaMap={statusMetaMap} />
          {row.lead_response_metrics?.is_late_response ? (
            <Badge variant="danger" size="sm">{t('customers.table.late', 'Late')} {row.lead_response_metrics.late_human ?? ''}</Badge>
          ) : row.lead_response_metrics && !row.lead_response_metrics.status_changed ? (
            <Badge variant="warning" size="sm">{t('customers.table.not_contacted', 'Not contacted')}</Badge>
          ) : null}
          {row.lead_response_metrics?.status_changed_without_note ? (
            <Badge variant="warning" size="sm">{t('customers.table.no_note', 'No note')}</Badge>
          ) : null}
        </span>
      ),
    },
    {
      key: 'assistant',
      header: t('customers.table.assistant', 'Assistant'),
      width: 150,
      sortValue: (row) => row.assistant_name ?? '',
      render: (row) => row.assistant_name || '—',
    },
    {
      key: 'audio',
      header: t('customers.table.audio', 'Audio'),
      width: 150,
      render: (row) => {
        const audioSource = resolveAudioUrl(row, apiBasePath)
        if (!audioSource) return '—'
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
      width: 260,
      render: (row) => (
        <span className="text-[var(--muted-strong)]" title={row.notes ?? undefined}>{summarizeCustomerNotes(row.notes, 8)}</span>
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
      width: 160,
      sortValue: (row) => row.created_at ?? '',
      render: (row) => <span className="tabular-nums text-[var(--muted-strong)]">{formatDateTime(row.created_at)}</span>,
    },
    {
      key: 'actions',
      header: t('customers.table.actions', 'Actions'),
      width: 96,
      align: 'right',
      render: (row) => (
        <span className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => openEditModal(row)} aria-label={t('customers.actions.edit', 'Edit')} title={t('customers.actions.edit', 'Edit')} className="grid h-8 w-8 place-items-center rounded-[9px] text-[var(--muted-strong)] transition-colors hover:bg-[var(--blue-dim)] hover:text-[var(--primary)]">
            <Pencil size={15} />
          </button>
          <button type="button" onClick={() => void handleDeleteCustomer(row)} aria-label={t('customers.actions.delete', 'Delete')} title={t('customers.actions.delete', 'Delete')} className="grid h-8 w-8 place-items-center rounded-[9px] text-[var(--muted-strong)] transition-colors hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)]">
            <Trash2 size={15} />
          </button>
        </span>
      ),
    },
  ]

  const filtersBar = (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(240px,1.5fr)_repeat(5,minmax(150px,1fr))_auto]">
      <div className="relative sm:col-span-2 lg:col-span-1">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--muted)]" />
        <Input
          value={search}
          onChange={(event) => { setSearch(event.target.value); setTablePage(1) }}
          placeholder={t('customers.filters.search_placeholder', 'Name, username, note, or phone')}
          aria-label={t('customers.filters.search_label', 'Search')}
          className="pl-9"
        />
      </div>
      <SelectField
        value={selectedPeriod}
        options={periodOptions}
        onValueChange={(value) => { setSelectedPeriod(value as typeof selectedPeriod); setTablePage(1) }}
      />
      <SelectField
        value={statusFilters[0] ?? ''}
        values={statusFilters}
        multiple
        options={statusFilterOptions}
        onValuesChange={resetPageAnd(setStatusFilters)}
        placeholder={t('customers.filters.all_statuses', 'All statuses')}
      />
      <SelectField
        key={`crm-platform-filter-${platformFilter || 'all'}`}
        value={platformFilter}
        options={platformFilterOptions}
        onValueChange={resetPageAnd(setPlatformFilter)}
      />
      <CalendarField value={dateStart} onValueChange={resetPageAnd(setDateStart)} placeholder={t('customers.filters.start_date_label', 'Start date')} />
      <CalendarField value={dateEnd} onValueChange={resetPageAnd(setDateEnd)} min={dateStart || undefined} placeholder={t('customers.filters.end_date_label', 'End date')} />
      {activeFilterCount > 0 ? (
        <Button variant="ghost" onClick={() => { resetFilters(); setTablePage(1) }} leftIcon={<X size={15} />}>
          {t('common.clear', 'Clear')}
        </Button>
      ) : null}
    </div>
  )

  return (
    <section className="flex min-h-[var(--page-h)] flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="ui-page-title text-[var(--foreground)]">{t('customers.list_page.title', 'Customers')}</h1>
          <p className="text-sm text-[var(--muted)]">
            {crmKind === 'outbound'
              ? t('customers.list_page.subtitle_outbound', 'Every Outbound CRM lead — filter, sort and shape the table your way.')
              : t('customers.list_page.subtitle', 'Every CRM customer — filter, sort and shape the table your way.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => void refreshAll()} leftIcon={<RefreshCw size={15} />}>
            {t('customers.actions.refresh', 'Refresh')}
          </Button>
          {crmKind === 'outbound' ? (
            <Button variant="secondary" onClick={() => navigate(`${routeBasePath}/statuses`)} leftIcon={<ListTodo size={15} />}>
              {t('outbound_crm.actions.statuses', 'Statuses')}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => navigate(`${routeBasePath}/archived`)} leftIcon={<ArchiveIcon size={15} />}>
            {t('customers.actions.archive', 'Archive')}
          </Button>
          <Button onClick={openCreateModal} leftIcon={<Plus size={16} />}>{t('customers.actions.add', 'Add customer')}</Button>
        </div>
      </div>

      {/* Key numbers */}
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        <StatCard
          solid
          className="min-h-[132px]"
          label={t('customers.list_page.total', 'Customers')}
          value={baseCustomers.length}
          icon={<UsersRound />}
          hint={periodLabel}
        />
        <StatCard
          className="min-h-[132px]"
          label={t('customers.list_page.added_today', 'Added today')}
          value={createdTodayCount}
          icon={<UserPlus />}
          iconTone="success"
          hint={t('customers.list_page.added_today_hint', 'New leads since midnight')}
          onOpen={() => { setSelectedPeriod('today'); setTablePage(1) }}
          openLabel={t('customers.period.today', 'Today')}
        />
        <StatCard
          className="min-h-[132px]"
          label={t('customers.list_page.need_to_call', 'Waiting for a call')}
          value={needToCallCount}
          icon={<PhoneCall />}
          iconTone="warning"
          hint={t('customers.list_page.need_to_call_hint', 'Status: Need to call')}
          onOpen={needToCallOption ? () => { setStatusFilters([needToCallOption.value]); setTablePage(1) } : undefined}
          openLabel={needToCallOption?.label}
        />
        <StatCard
          className="min-h-[132px]"
          label={conversionQuery.data ? t('customers.stats.conversion', 'Conversion') : t('customers.list_page.shown', 'Shown')}
          value={conversionQuery.data ? `${Number(conversionQuery.data.conversion_rate ?? 0).toFixed(1)}%` : displayedCustomers.length}
          icon={conversionQuery.data ? <Percent /> : <Filter />}
          iconTone="violet"
          hint={conversionQuery.data
            ? t('customers.list_page.conversion_hint', 'Projects started: {{count}}', { count: conversionQuery.data.project_started_count })
            : t('customers.section.list.filters_badge', '{{count}} filters', { count: activeFilterCount })}
        />
      </div>

      {/* Status pills — click to filter, several can be combined */}
      {allChipStatuses.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('customers.filters.status_label', 'Status')}>
          <button
            type="button"
            onClick={() => { setStatusFilters([]); setTablePage(1) }}
            aria-pressed={statusFilters.length === 0}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
              statusFilters.length === 0
                ? 'border-transparent bg-[var(--surface-inverse)] text-white'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--input-surface)]',
            )}
          >
            {t('customers.filters.all', 'All')}
            <span className={cn('rounded-full px-1.5 text-[11.5px] tabular-nums', statusFilters.length === 0 ? 'bg-white/20' : 'bg-[var(--input-surface)] text-[var(--muted-strong)]')}>{baseCustomers.length}</span>
          </button>
          {allChipStatuses.map((option) => {
            const isActive = selectedStatusFilterSet.has(normalizeStatusKey(option.value))
            const count = statusCounts.get(normalizeStatusKey(option.value)) ?? 0
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  const key = normalizeStatusKey(option.value)
                  setStatusFilters((prev) => (isActive ? prev.filter((s) => normalizeStatusKey(s) !== key) : [...prev, option.value]))
                  setTablePage(1)
                }}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors',
                  isActive ? 'font-semibold' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--input-surface)]',
                  count === 0 && !isActive && 'opacity-60',
                )}
                style={isActive ? { backgroundColor: `${option.color}1F`, borderColor: `${option.color}66`, color: option.color } : undefined}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
                {option.label}
                <span className={cn('rounded-full px-1.5 text-[11.5px] tabular-nums', isActive ? 'bg-white/70' : 'bg-[var(--input-surface)] text-[var(--muted-strong)]')}>{count}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      <DataGrid
        id={`${storageKey}-customers`}
        className="h-[calc(100vh-96px)] min-h-[520px] scroll-mt-4"
        eyebrow={[listTitle, periodLabel].filter(Boolean).join(' · ')}
        title={
          <span className="inline-flex items-center gap-2.5">
            {t('customers.section.list.title', 'Customers')}
            <span className="rounded-full bg-[var(--blue-dim)] px-2.5 py-0.5 text-[13px] font-semibold tabular-nums text-[var(--blue-text)]">{displayedCustomers.length}</span>
          </span>
        }
        filters={filtersBar}
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
