/* eslint-disable @typescript-eslint/no-unused-vars */
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppShell } from '../../../app/hooks/useAppShell'
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
import { Card } from '../../../shared/ui/card'
import { DataTable } from '../../../shared/ui/data-table'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { SelectField, type SelectFieldOption } from '../../../shared/ui/select-field'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { AudioPlayerModal } from '../components/AudioPlayerModal'
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
      className={`inline-flex items-center rounded-sm border px-2.5 py-1 text-[13px] font-medium leading-none ${getRecallTimeToneClasses(tone)}`}
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
      className="inline-flex items-center rounded-md border px-2.5 py-1 text-[13px] font-medium capitalize"
      style={{
        borderColor: meta?.color ?? 'var(--border)',
        color: meta?.color ?? 'var(--foreground)',
        backgroundColor: meta?.color ? `${meta.color}18` : 'var(--muted-surface)',
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
        className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--border-hover)] hover:bg-[var(--input-surface-hover)]"
        aria-label={t('common.play', 'Play')}
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-white/8">
          <svg viewBox="0 0 16 16" className="ml-0.5 h-3.5 w-3.5 fill-current" aria-hidden="true">
            <path d="M5 3.8v8.4a.6.6 0 0 0 .93.5l6.2-4.2a.6.6 0 0 0 0-1L5.93 3.3A.6.6 0 0 0 5 3.8Z" />
          </svg>
        </span>
        {t('common.play', 'Play')}
      </button>
    </div>
  )
}



export function CrmDashboardPage() {
  const { t } = useTranslation()
  const { isSidebarCollapsed } = useAppShell()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()
  const { service: crmService, apiBasePath, routeBasePath, storageKey, kind: crmKind } = useCrmScope()
  const [initialReturnState] = useState(() => readCrmReturnState(storageKey))

  const [search, setSearch] = useState(() => initialReturnState?.search ?? '')
  const deferredSearch = useDeferredValue(search)
  const [statusFilters, setStatusFilters] = useState<string[]>(() => initialReturnState?.statusFilters ?? [])
  const [platformFilter, setPlatformFilter] = useState(() => initialReturnState?.platformFilter ?? '')
  const [dateStart, setDateStart] = useState(() => initialReturnState?.dateStart ?? '')
  const [dateEnd, setDateEnd] = useState(() => initialReturnState?.dateEnd ?? '')
  const [pageSize, setPageSize] = useState(() => initialReturnState?.pageSize ?? '75')
  const [selectedPeriod, setSelectedPeriod] = useState<'' | 'today' | '3d' | '7d' | '30d' | '90d'>(() => initialReturnState?.selectedPeriod ?? '')
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
      add(choice.value, choice.label, meta?.color ?? '#94a3b8')
    }

    // 3. Actual customer statuses as final fallback
    for (const c of baseCustomers) {
      const meta = statusMetaMap.get(normalizeStatusKey(c.status))
      add(c.status, meta?.label ?? c.status, meta?.color ?? '#94a3b8')
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
    navigate(`/cognilabsai/chat?telegram_search=${encodeURIComponent(phoneNumber)}&return_customer_id=${customerId}&return_to=${encodeURIComponent(routeBasePath)}`)
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
  const pageSizeOptions: SelectFieldOption[] = [
    { value: '10', label: t('common.per_page', '{{count}} per page', { count: 10 }) },
    { value: '20', label: t('common.per_page', '{{count}} per page', { count: 20 }) },
    { value: '50', label: t('common.per_page', '{{count}} per page', { count: 50 }) },
    { value: '75', label: t('common.per_page', '{{count}} per page', { count: 75 }) },
  ]
  const activeFilterCount = [
    search,
    statusFilters.length > 0 ? 1 : 0,
    platformFilter,
    dateStart,
    dateEnd,
  ].filter((value) => Boolean(value)).length

  return (
    <section className="flex min-h-[calc(100vh-10rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {periodOptions.map((option) => {
            const isActive = selectedPeriod === option.value
            return (
              <button
                key={option.value || 'all'}
                type="button"
                onClick={() => setSelectedPeriod(option.value)}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition',
                  isActive
                    ? 'border-(--blue-border) bg-(--blue-soft) text-(--blue-text)'
                    : 'border-(--border) bg-(--surface-elevated) text-(--muted-strong) hover:border-(--border-hover) hover:text-(--foreground)',
                )}
              >
                {option.label}
              </button>
            )
          })}
          {selectedPeriod && periodReportQuery.data ? (
            <Badge variant="blue" dot>
              {t('customers.period.range', '{{from}} → {{to}}', {
                from: periodReportQuery.data.from_date,
                to: periodReportQuery.data.to_date,
              })}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => void refreshAll()}>
            {t('customers.actions.refresh', 'Refresh')}
          </Button>
          {crmKind === 'outbound' ? (
            <Button variant="secondary" onClick={() => navigate(`${routeBasePath}/statuses`)}>
              {t('outbound_crm.actions.statuses', 'Statuses')}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => navigate(`${routeBasePath}/archived`)}>
            Arxiv
          </Button>
          <Button onClick={openCreateModal}>{t('customers.actions.add', 'Add customer')}</Button>
        </div>
      </div>

      {allChipStatuses.length > 0 && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {/* All clients card */}
          <button
            type="button"
            onClick={() => setStatusFilters([])}
            className={cn(
              'flex flex-col justify-between rounded-xl border p-4 text-left transition-all min-h-24',
              statusFilters.length === 0
                ? 'border-(--blue-border) bg-(--blue-soft) shadow-sm'
                : 'border-(--border) bg-(--surface-elevated) hover:border-(--border-hover) hover:bg-(--surface)',
            )}
          >
            <p className={cn('text-[10px] font-bold uppercase tracking-widest', statusFilters.length === 0 ? 'text-(--blue-text)' : 'text-(--muted)')}>
              Barchasi
            </p>
            <p className={cn('mt-3 text-2xl font-semibold leading-none tracking-tight', statusFilters.length === 0 ? 'text-(--blue-text)' : 'text-(--foreground)')}>
              {baseCustomers.length}
            </p>
          </button>
          {allChipStatuses.map((option) => {
            const isActive = selectedStatusFilterSet.has(normalizeStatusKey(option.value))
            const count = statusCounts.get(normalizeStatusKey(option.value)) ?? 0
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  const key = normalizeStatusKey(option.value)
                  setStatusFilters((prev) =>
                    isActive
                      ? prev.filter((s) => normalizeStatusKey(s) !== key)
                      : [...prev, option.value],
                  )
                }}
                className={cn(
                  'flex flex-col justify-between rounded-xl border p-4 text-left transition-all min-h-24',
                  isActive ? 'shadow-sm' : 'border-(--border) bg-(--surface-elevated) hover:border-(--border-hover) hover:bg-(--surface)',
                )}
                style={isActive ? {
                  borderColor: option.color,
                  backgroundColor: `${option.color}12`,
                } : undefined}
              >
                <p
                  className={cn('text-[10px] font-bold uppercase tracking-widest truncate', !isActive && 'text-(--muted)')}
                  style={isActive ? { color: option.color } : undefined}
                >
                  {option.label}
                </p>
                <p
                  className={cn('mt-3 text-2xl font-semibold leading-none tracking-tight', !isActive && 'text-(--foreground)')}
                  style={isActive ? { color: option.color } : undefined}
                >
                  {count}
                </p>
              </button>
            )
          })}
        </div>
      )}

      <Card noPadding className="flex flex-1 flex-col overflow-hidden">
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 border-b border-(--border) py-5',
            isSidebarCollapsed ? 'px-4 xl:px-5' : 'px-6',
          )}
        >
          <div>
            <h2 className="text-lg font-semibold text-white">{t('customers.section.list.title', 'Customers')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="blue" dot>
              {t('customers.section.list.visible_badge', '{{count}} visible', { count: displayedCustomers.length })}
            </Badge>
            <Badge variant={activeFilterCount > 0 ? 'warning' : 'outline'} dot={activeFilterCount > 0}>
              {t('customers.section.list.filters_badge', '{{count}} filters', { count: activeFilterCount })}
            </Badge>
          </div>
        </div>


        <div
          className={cn(
            'border-b border-(--border) bg-(--muted-surface)/40 py-4',
            isSidebarCollapsed ? 'px-4 xl:px-5' : 'px-6',
          )}
        >
          <div className="mb-3 flex items-center justify-end">
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 px-2 text-xs">
                {t('common.clear', 'Clear')}
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-(--muted)">
                {t('customers.filters.search_label', 'Search')}
              </Label>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('customers.filters.search_placeholder', 'Name, username, note, or phone')}
                className="h-9"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-(--muted)">
                {t('customers.filters.status_label', 'Status')}
              </Label>
              <SelectField
                value={statusFilters[0] ?? ''}
                values={statusFilters}
                multiple
                options={statusFilterOptions}
                onValuesChange={setStatusFilters}
                placeholder={t('customers.filters.all_statuses', 'All statuses')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-(--muted)">
                {t('customers.filters.platform_label', 'Platform')}
              </Label>
              <SelectField
                key={`crm-platform-filter-${platformFilter || 'all'}`}
                value={platformFilter}
                options={platformFilterOptions}
                onValueChange={setPlatformFilter}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-(--muted)">
                {t('customers.filters.start_date_label', 'Start date')}
              </Label>
              <Input type="date" value={dateStart} onChange={(event) => setDateStart(event.target.value)} className="h-9" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-(--muted)">
                {t('customers.filters.end_date_label', 'End date')}
              </Label>
              <Input type="date" value={dateEnd} onChange={(event) => setDateEnd(event.target.value)} className="h-9" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-(--muted)">
                {t('customers.filters.pagination_label', 'Pagination')}
              </Label>
              <SelectField
                key={`crm-page-size-${pageSize}`}
                value={pageSize}
                options={pageSizeOptions}
                onValueChange={setPageSize}
              />
            </div>
          </div>
        </div>

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col py-5',
            isSidebarCollapsed ? 'px-2 xl:px-3' : 'px-0',
          )}
        >
          <DataTable
            key={`crm-table-${pageSizeValue}`}
            caption={t('customers.table.caption', 'CRM customers table')}
            rows={displayedCustomers}
            getRowKey={(row) => String(row.id)}
            pageSize={pageSizeValue}
            initialPage={tablePage}
            zebra
            fillHeight
            onRowClick={openCustomerDrawer}
            onPageChange={setTablePage}
            disableAutoResetPage={shouldRestoreReturnState}
            className="rounded-none border-x-0 border-b-0"
            emptyState={
              <EmptyStateBlock
                eyebrow={crmKind === 'outbound' ? t('outbound_crm.page.eyebrow', 'Outbound CRM workspace') : t('customers.page.eyebrow', 'CRM workspace')}
                title={t('customers.table.empty_title', 'No customers found')}
                description={t('customers.table.empty_description', 'The current filters returned no customer records.')}
              />
            }
            columns={[
              {
                key: 'client',
                header: t('customers.table.client', 'Customer'),
                minWidth: '280px',
                render: (row) => {
                  const displayName = getCustomerDisplayName(row)
                  return (
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          openCustomerDrawer(row)
                        }}
                        className="block truncate text-left text-sm font-semibold text-white transition hover:text-zinc-300 sm:text-[15px]"
                      >
                        {displayName}
                      </button>
                    </div>
                  )
                },
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
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={row.status} statusMetaMap={statusMetaMap} />
                    {row.lead_response_metrics && (
                      <div className="flex flex-wrap gap-1">
                        {!row.lead_response_metrics.status_changed && (
                          <span className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0 text-[9px] font-semibold text-amber-400">
                            Hali bog'lanilmagan
                          </span>
                        )}
                        {row.lead_response_metrics.status_changed && !row.lead_response_metrics.is_late_response && (
                          <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-semibold text-emerald-400">
                            ✓ O'z vaqtida
                          </span>
                        )}
                        {row.lead_response_metrics.is_late_response && (
                          <span className="inline-flex items-center rounded-md border border-red-500/20 bg-red-500/10 px-1.5 py-0 text-[9px] font-semibold text-red-400">
                            Kech {row.lead_response_metrics.late_human ?? ''}
                          </span>
                        )}
                        {row.lead_response_metrics.status_changed_without_note && (
                          <span className="inline-flex items-center rounded-md border border-orange-500/20 bg-orange-500/10 px-1.5 py-0 text-[9px] font-semibold text-orange-400">
                            Note yo'q
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'actions',
                header: t('customers.table.actions', 'Actions'),
                render: (row) => (
                  <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                    <button type="button" title={t('customers.actions.edit', 'Edit')} onClick={() => openEditModal(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button type="button" title={t('customers.actions.delete', 'Delete')} onClick={() => void handleDeleteCustomer(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                ),
              },
              {
                key: 'assistant',
                header: t('customers.table.assistant', 'Assistant'),
                render: (row) => row.assistant_name || '-',
              },
              {
                key: 'audio',
                header: t('customers.table.audio', 'Audio'),
                width: '140px',
                render: (row) => {
                  const audioSource = resolveAudioUrl(row, apiBasePath)

                  if (!audioSource) {
                    return '-'
                  }

                  return (
                    <TableAudioControl
                      src={audioSource}
                      customerName={getCustomerDisplayName(row)}
                      onOpenPlayer={(src, name) => setAudioModal({ src, name })}
                    />
                  )
                },
              },
              {
                key: 'notes',
                header: t('customers.table.notes', 'Notes'),
                width: '320px',
                render: (row) => (
                  <span className="block max-w-[320px] truncate text-sm text-(--muted-strong) sm:text-[15px]" title={row.notes ?? undefined}>
                    {summarizeCustomerNotes(row.notes)}
                  </span>
                ),
              },
              {
                key: 'recall',
                header: t('customers.table.recall', 'Recall time'),
                render: (row) => renderRecallTime(row.recall_time),
              },
              {
                key: 'created',
                header: t('customers.table.created', 'Created'),
                render: (row) => formatDateTime(row.created_at),
              },
            ]}
          />
        </div>
      </Card>

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
        statusOptions={[
          ...statusFilterOptions,
        ]}
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
    </section>
  )
}

