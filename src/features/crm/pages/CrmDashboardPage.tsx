/* eslint-disable @typescript-eslint/no-unused-vars */
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlarmClock, Archive as ArchiveIcon, ArrowRight, CircleDashed, Filter, Globe, Layers, ListTodo, NotebookPen, Pencil, Percent, PhoneCall, Plus, RefreshCw, Search, Trash2, UserPlus, UsersRound, X } from 'lucide-react'
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
import { FilterMenu, FilterToken, PeriodPicker } from '../components/CustomerFilters'
import { statusIconFor } from '../lib/statusIcon'
import { CountUp } from '../../../shared/ui/count-up'
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



const avatarTones = [
  'bg-[var(--blue-dim)] text-[var(--blue-text)]',
  'bg-[var(--violet-dim)] text-[var(--violet-text)]',
  'bg-[var(--success-dim)] text-[var(--success-text)]',
  'bg-[var(--warning-dim)] text-[var(--warning-text)]',
  'bg-[#E9F7FB] text-[#0B7285]',
]

function avatarTone(name: string) {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  return avatarTones[hash % avatarTones.length]
}

function initialsFor(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '—'
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
  const activeFilterCount = [
    search,
    statusFilters.length > 0 ? 1 : 0,
    platformFilter,
    dateStart,
    dateEnd,
  ].filter((value) => Boolean(value)).length

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

  /* ── Customers page: header, number strip, facet rail + customisable table ── */
  const gridColumns: GridColumn<CustomerSummary>[] = [
    {
      key: 'name',
      header: t('customers.table.client', 'Customer'),
      width: 220,
      hideable: false,
      sortValue: (row) => getCustomerDisplayName(row),
      render: (row) => {
        const name = getCustomerDisplayName(row)
        return (
          <span className="flex min-w-0 items-center gap-2.5">
            <span className={cn('grid h-7 w-7 shrink-0 place-items-center text-[11px] font-bold', avatarTone(name))}>{initialsFor(name)}</span>
            <span className="truncate font-semibold text-[var(--foreground)] transition-colors group-hover/row:text-[var(--primary)]">{name}</span>
          </span>
        )
      },
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
      width: 132,
      sortValue: (row) => row.status,
      render: (row) => {
        const meta = statusMetaMap.get(normalizeStatusKey(row.status))
        const color = meta?.color ?? '#8A90A2'
        const label = meta?.label ?? row.status
        const Icon = statusIconFor(row.status)
        const metrics = row.lead_response_metrics
        const lateLabel = `${t('customers.table.late', 'Late')} ${metrics?.late_human ?? ''}`.trim()
        return (
          <span className="flex items-center gap-1">
            <span role="img" aria-label={label} title={label} className="grid h-7 w-7 place-items-center" style={{ background: `${color}1A`, color }}>
              <Icon size={15} strokeWidth={2.1} />
            </span>
            {metrics?.is_late_response ? (
              <span role="img" aria-label={lateLabel} title={lateLabel} className="grid h-7 w-7 place-items-center bg-[var(--danger-dim)] text-[var(--danger-text)]"><AlarmClock size={14} strokeWidth={2.1} /></span>
            ) : metrics && !metrics.status_changed ? (
              <span role="img" aria-label={t('customers.table.not_contacted', 'Not contacted')} title={t('customers.table.not_contacted', 'Not contacted')} className="grid h-7 w-7 place-items-center bg-[var(--warning-dim)] text-[var(--warning-text)]"><CircleDashed size={14} strokeWidth={2.1} /></span>
            ) : null}
            {metrics?.status_changed_without_note ? (
              <span role="img" aria-label={t('customers.table.no_note', 'No note')} title={t('customers.table.no_note', 'No note')} className="grid h-7 w-7 place-items-center bg-[var(--warning-dim)] text-[var(--warning-text)]"><NotebookPen size={14} strokeWidth={2.1} /></span>
            ) : null}
          </span>
        )
      },
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

  // Facets for the left rail
  const platformCounts = new Map<string, number>()
  for (const customer of baseCustomers) {
    for (const platform of getCustomerPlatforms(customer)) {
      if (platform) platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + 1)
    }
  }
  const platformFacets = [...platformCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([value, count], index) => ({ value, label: value, count, color: ['#2B59FF', '#6A3FE0', '#17924A', '#C2410C', '#0E7A55', '#8A90A2'][index % 6] }))
  const statusFacets = allChipStatuses.map((option) => ({
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
  const hasAnyFilter = activeFilterCount > 0 || Boolean(selectedPeriod)

  const metrics: Array<{ key: string; label: string; value: number; format?: (value: number) => string; caption: string; icon: ReactNode; tone: string; active: boolean; onClick?: () => void }> = [
    {
      key: 'total',
      label: t('customers.list_page.total', 'Customers'),
      value: baseCustomers.length,
      caption: periodLabel,
      icon: <UsersRound size={18} />,
      tone: 'bg-[var(--surface-inverse)] text-white',
      active: !hasAnyFilter,
      onClick: clearAll,
    },
    {
      key: 'today',
      label: t('customers.list_page.added_today', 'Added today'),
      value: createdTodayCount,
      caption: t('customers.list_page.added_today_hint', 'New leads since midnight'),
      icon: <UserPlus size={18} />,
      tone: 'bg-[var(--success-dim)] text-[var(--success-text)]',
      active: selectedPeriod === 'today',
      onClick: () => { setSelectedPeriod('today'); setDateStart(''); setDateEnd(''); setTablePage(1) },
    },
    {
      key: 'call',
      label: t('customers.list_page.need_to_call', 'Waiting for a call'),
      value: needToCallCount,
      caption: t('customers.list_page.need_to_call_hint', 'Status: Need to call'),
      icon: <PhoneCall size={18} />,
      tone: 'bg-[var(--warning-dim)] text-[var(--warning-text)]',
      active: Boolean(needToCallOption) && selectedStatusFilterSet.has('needtocall') && statusFilters.length === 1,
      onClick: needToCallOption ? () => { setStatusFilters([needToCallOption.value]); setTablePage(1) } : undefined,
    },
    conversionQuery.data
      ? {
          key: 'conversion',
          label: t('customers.stats.conversion', 'Conversion'),
          value: Number(conversionQuery.data.conversion_rate ?? 0),
          format: (value: number) => `${value.toFixed(1)}%`,
          caption: t('customers.list_page.conversion_hint', 'Projects started: {{count}}', { count: conversionQuery.data.project_started_count }),
          icon: <Percent size={18} />,
          tone: 'bg-[var(--violet-dim)] text-[var(--violet-text)]',
          active: false,
        }
      : {
          key: 'shown',
          label: t('customers.list_page.shown', 'Shown'),
          value: displayedCustomers.length,
          caption: t('customers.section.list.filters_badge', '{{count}} filters', { count: activeFilterCount }),
          icon: <Filter size={18} />,
          tone: 'bg-[var(--violet-dim)] text-[var(--violet-text)]',
          active: false,
        },
  ]

  const toolbar = (
    <>
      <label className="relative flex h-9 min-w-[200px] flex-1 items-center sm:max-w-[360px]">
        <Search size={15} className="pointer-events-none absolute left-3 text-[var(--muted)]" />
        <input
          ref={searchInputRef}
          type="search"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setTablePage(1) }}
          placeholder={t('customers.filters.search_placeholder', 'Name, username, note, or phone')}
          aria-label={t('customers.filters.search_label', 'Search')}
          className="h-9 w-full border border-[var(--border)] bg-[var(--input-surface)] pr-9 pl-9 text-[13px] text-[var(--foreground)] transition-colors placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:outline-none focus:ring-3 focus:ring-[var(--primary)]/12 [&::-webkit-search-cancel-button]:hidden"
        />
        {search ? (
          <button type="button" onClick={() => { setSearch(''); setTablePage(1) }} aria-label={t('common.clear', 'Clear')} className="absolute right-2 grid h-5 w-5 place-items-center text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]">
            <X size={13} />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-2.5 hidden border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-[11px] text-[var(--muted)] sm:block">/</kbd>
        )}
      </label>
      <PeriodPicker
        value={selectedPeriod}
        options={periodOptions}
        onChange={(value) => { setSelectedPeriod(value); setTablePage(1) }}
        dateStart={dateStart}
        dateEnd={dateEnd}
        onDatesChange={(start, end) => { setDateStart(start); setDateEnd(end); setTablePage(1) }}
        labels={{
          title: t('customers.filters.period', 'Period'),
          custom: t('customers.filters.custom_range', 'Custom range'),
          from: t('customers.filters.start_date_label', 'Start date'),
          to: t('customers.filters.end_date_label', 'End date'),
          apply: t('customers.filters.apply', 'Apply'),
        }}
      />
      <FilterMenu
        label={t('customers.filters.status_label', 'Status')}
        icon={Layers}
        items={statusFacets}
        isSelected={(value) => selectedStatusFilterSet.has(normalizeStatusKey(value))}
        onToggle={toggleStatus}
        onClear={() => { setStatusFilters([]); setTablePage(1) }}
        selectedCount={statusFilters.length}
        clearLabel={t('common.clear', 'Clear')}
      />
      {platformFacets.length > 0 ? (
        <FilterMenu
          label={t('customers.filters.platform_label', 'Platform')}
          icon={Globe}
          items={platformFacets}
          isSelected={(value) => platformFilter === value}
          onToggle={(value) => { setPlatformFilter((current) => (current === value ? '' : value)); setTablePage(1) }}
          onClear={() => { setPlatformFilter(''); setTablePage(1) }}
          selectedCount={platformFilter ? 1 : 0}
          clearLabel={t('common.clear', 'Clear')}
        />
      ) : null}
    </>
  )

  const tokens = hasAnyFilter ? (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] bg-[#FBFBFD] px-4 py-2">
      <span className="mr-1 text-[11px] font-semibold tracking-[0.08em] text-[var(--caption)] uppercase">{t('customers.filters.active', 'Filters')}</span>
      {selectedPeriod ? (
        <FilterToken onRemove={() => { setSelectedPeriod(''); setTablePage(1) }} removeLabel={t('common.clear', 'Clear')}>{periodLabel}</FilterToken>
      ) : null}
      {dateStart || dateEnd ? (
        <FilterToken onRemove={() => { setDateStart(''); setDateEnd(''); setTablePage(1) }} removeLabel={t('common.clear', 'Clear')}>
          {`${dateStart || '…'} – ${dateEnd || '…'}`}
        </FilterToken>
      ) : null}
      {statusFilters.map((value) => {
        const meta = allChipStatuses.find((option) => normalizeStatusKey(option.value) === normalizeStatusKey(value))
        return (
          <FilterToken key={value} color={meta?.color} onRemove={() => toggleStatus(value)} removeLabel={t('common.clear', 'Clear')}>
            {meta?.label ?? value}
          </FilterToken>
        )
      })}
      {platformFilter ? (
        <FilterToken onRemove={() => { setPlatformFilter(''); setTablePage(1) }} removeLabel={t('common.clear', 'Clear')}>{platformFilter}</FilterToken>
      ) : null}
      {search ? (
        <FilterToken onRemove={() => { setSearch(''); setTablePage(1) }} removeLabel={t('common.clear', 'Clear')}>“{search}”</FilterToken>
      ) : null}
      <button type="button" onClick={clearAll} className="ml-1 text-[12.5px] font-semibold text-[var(--primary)] hover:underline">
        {t('customers.filters.clear_all', 'Clear all')}
      </button>
    </div>
  ) : null

  return (
    <section className="stagger-in flex flex-col gap-4 lg:h-[var(--page-h)] lg:min-h-[620px]">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center bg-[var(--surface-inverse)] text-white">
            <UsersRound size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="text-[26px] leading-8 font-bold tracking-[-0.025em] text-[var(--foreground)]">{t('customers.list_page.title', 'Customers')}</h1>
            <p className="truncate text-[13px] text-[var(--muted)]">
              {crmKind === 'outbound'
                ? t('customers.list_page.subtitle_outbound', 'Every Outbound CRM lead — filter, sort and shape the table your way.')
                : t('customers.list_page.subtitle', 'Every CRM customer — filter, sort and shape the table your way.')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshAll()}
            title={t('customers.actions.refresh', 'Refresh')}
            aria-label={t('customers.actions.refresh', 'Refresh')}
            className="grid h-10 w-10 place-items-center border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-strong)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]"
          >
            <RefreshCw size={16} className={cn(isRefreshing && 'animate-spin')} />
          </button>
          {crmKind === 'outbound' ? (
            <button type="button" onClick={() => navigate(`${routeBasePath}/statuses`)} className="inline-flex h-10 items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface)]">
              <ListTodo size={16} /> {t('outbound_crm.actions.statuses', 'Statuses')}
            </button>
          ) : null}
          <button type="button" onClick={() => navigate(`${routeBasePath}/archived`)} className="inline-flex h-10 items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface)]">
            <ArchiveIcon size={16} /> {t('customers.actions.archive', 'Archive')}
          </button>
          <button type="button" onClick={openCreateModal} className="inline-flex h-10 items-center gap-2 bg-[var(--primary)] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-[var(--primary-hover)]">
            <Plus size={17} /> {t('customers.actions.add', 'Add customer')}
          </button>
        </div>
      </header>

      {/* Key numbers — one strip; each cell is also a quick filter */}
      <div className="grid shrink-0 grid-cols-2 overflow-hidden border border-[var(--border)] bg-[var(--card)] lg:grid-cols-4">
        {metrics.map((metric, index) => {
          const Cell = metric.onClick ? 'button' : 'div'
          return (
            <Cell
              key={metric.key}
              {...(metric.onClick ? { type: 'button' as const, onClick: metric.onClick, 'aria-pressed': metric.active } : {})}
              className={cn(
                'group relative flex items-center gap-3.5 px-5 py-4 text-left transition-colors',
                index % 2 === 1 && 'border-l border-[var(--border)]',
                index >= 2 && 'border-t border-[var(--border)] lg:border-t-0',
                index === 2 && 'lg:border-l',
                metric.onClick && 'hover:bg-[#F7F9FF]',
                metric.active && 'bg-[#F5F8FF]',
              )}
            >
              {metric.active ? <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--primary)]" /> : null}
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center transition-transform duration-300 group-hover:scale-105', metric.tone)}>{metric.icon}</span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium text-[var(--muted)]">{metric.label}</span>
                <span className="block text-[26px] leading-8 font-bold tracking-[-0.03em] text-[var(--foreground)] tabular-nums" data-ui-number="true">
                  <CountUp value={metric.value} format={metric.format} />
                </span>
                <span className="block truncate text-[11.5px] text-[var(--caption)]">{metric.caption}</span>
              </span>
            </Cell>
          )
        })}
      </div>

      {/* The table fills the rest of the screen */}
      <div className="flex min-h-[560px] flex-1 overflow-hidden border border-[var(--border)] bg-[var(--card)] lg:min-h-0">
        <DataGrid
          id={`${storageKey}-customers`}
          className="min-w-0 flex-1"
          rowNumbers
          toolbar={toolbar}
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
      </div>

      {modals}
    </section>
  )
}
