export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type ApiRequestOptions = {
  path: string
  method?: ApiMethod
  query?: Record<string, string | number | boolean | undefined | null>
  body?: BodyInit | FormData | Record<string, unknown> | undefined
  headers?: Record<string, string>
  auth?: boolean
}

export type ApiResponseError = {
  message: string
  status: number
  details: unknown
}

export type SuccessResponse = {
  success?: boolean
  message: string
}

export type CreateResponse = {
  id: number
  message: string
}

export type UserRole =
  | 'CEO'
  | 'Member'
  | 'Customer'
  | 'SalesManager'
  | 'Finance'
  | 'Admin'
  | (string & {})

export type PermissionMap = Record<string, boolean>

export type AiChatRequest = {
  question: string
}

export type AiChatResponse = {
  answer?: string | null
  used_llm?: string | null
  intents?: unknown
  period?: unknown
  employee?: unknown
  context?: unknown
} & Record<string, unknown>

export type CurrentUser = {
  id: number
  email: string
  name: string
  surname: string
  profile_image?: string | null
  company_code: string
  role: UserRole
  job_title?: string | null
  is_active: boolean
  permissions: PermissionMap
}

export type TokenResponse = {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in?: number
}

export type AdditionalNote = {
  id: number
  customer_id: number
  note: string
  created_by: number
  created_by_full_name: string
  created_at: string
  updated_at: string
}

export type LeadResponseMetrics = {
  lead_created_at: string | null
  current_status: string | null
  first_status_changed_at: string | null
  first_status_changed_to: string | null
  response_minutes: number | null
  response_human: string | null
  response_limit_minutes: number
  is_late_response: boolean
  late_minutes: number | null
  late_human: string | null
  first_note_at: string | null
  note_minutes: number | null
  note_human: string | null
  note_written: boolean
  status_changed: boolean
  status_changed_without_note: boolean
  message: string | null
}

export type CustomerSummary = {
  id: number
  full_name?: string | null
  fullName?: string | null
  displayName?: string | null
  name?: string | null
  surname?: string | null
  first_name?: string | null
  last_name?: string | null
  firstName?: string | null
  lastName?: string | null
  display_name?: string | null
  customer_name?: string | null
  customerName?: string | null
  contact_name?: string | null
  full?: string | null
  client_name?: string | null
  lead_name?: string | null
  user_name?: string | null
  fio?: string | null
  platform?: string | null
  platform_name?: string | null
  source_platform?: string | null
  social_platform?: string | null
  source?: string | null
  lead_source?: string | null
  channel?: string | null
  platforms?: Array<string | null> | null
  customer?: Record<string, unknown> | null
  client?: Record<string, unknown> | null
  lead?: Record<string, unknown> | null
  contact?: Record<string, unknown> | null
  profile?: Record<string, unknown> | null
  details?: Record<string, unknown> | null
  username?: string | null
  phone_number?: string | null
  phone?: string | null
  status: string
  assistant_name?: string | null
  notes?: string | null
  aisummary?: string | null
  audio_file_id?: string | null
  audio_url?: string | null
  recall_time?: string | null
  conversation_language?: string | null
  chat_url?: string | null
  crm_customer_id?: number | null
  created_at: string
  is_archived?: boolean
  additional_notes?: AdditionalNote[]
  lead_response_metrics?: LeadResponseMetrics | null
}

export type PaymentItem = {
  id: number
  project: string
  date: string | null
  summ: number
  payment: boolean
}

export type FinanceItem = {
  id: number
  type: string
  status: string
  card: string
  card_display: string
  service: string
  summ: number
  currency: string
  date: string
  donation: number
  donation_percentage: number
  tax_percentage: number
  exchange_rate: number
  transaction_status: string
  initial_date: string
}

export type DailyMetrics = {
  today_customers: CustomerSummary[]
  need_to_call_count: number
  total_balance_uzs: number
  total_balance_formatted: string
  due_payments_today: number
}

export type DynamicStatusOption = {
  value: string
  label: string
  color: string
  order: number
}

export type CustomerStatsResponse = {
  total_customers: number
  need_to_call: number
  contacted: number
  project_started: number
  continuing: number
  finished: number
  rejected: number
  status_dict: Record<string, number>
  status_percentages: Record<string, number>
}

export type CustomerStatusSummaryBucket = {
  total_customers: number
  status_stats: Record<string, number>
  status_percentages: Record<string, number>
}

export type CustomerStatusSummaryResponse = {
  generated_at: string
  today: CustomerStatusSummaryBucket
  last_3_days: CustomerStatusSummaryBucket
  last_7_days: CustomerStatusSummaryBucket
  last_30_days: CustomerStatusSummaryBucket
  last_90_days: CustomerStatusSummaryBucket
}

export type CustomerPeriodReportResponse = {
  period: string
  from_date: string
  to_date: string
  total_customers: number
  customers: CustomerSummary[]
  status_stats: Record<string, number>
  status_dict: Record<string, number>
  status_percentages: Record<string, number>
}

export type SalesStatsResponse = {
  today: number
  yesterday: number
  this_week: number
  last_week: number
  customer_type: string
}

export type SalesDashboardChartsPeriod = {
  start_date: string
  end_date: string
  days: number
}

export type SalesDashboardChartsSummary = {
  total_period_leads: number
  today: number
  yesterday: number
  this_week: number
  last_week: number
  project_started: number
  finished: number
  rejected: number
  conversion_rate_percent: number
}

export type SalesDashboardTrendPoint = {
  date: string
  count: number
}

export type SalesDashboardDistributionItem = {
  key: string
  label: string
  value: number
  percentage: number
}

export type SalesDashboardChartsResponse = {
  customer_type?: string | null
  period: SalesDashboardChartsPeriod
  summary: SalesDashboardChartsSummary
  trend: SalesDashboardTrendPoint[]
  status_distribution: SalesDashboardDistributionItem[]
  platform_distribution: SalesDashboardDistributionItem[]
  customer_type_distribution: SalesDashboardDistributionItem[]
}

export type ConversionRateResponse = {
  total_customers: number
  project_started_count: number
  conversion_rate: number
  period: string
}

export type UpdateTrackingStats = {
  user_id: number
  user_name: string
  total_updates: number
  updates_this_week: number
  updates_last_week: number
  updates_this_month: number
  updates_last_month: number
  updates_last_3_months: number
  percentage_this_week: number
  percentage_last_week: number
  percentage_this_month: number
  percentage_last_3_months: number
  expected_updates_per_week: number
}

export type CompanyStatsResponse = {
  total_employees: number
  total_updates_today: number
  total_updates_this_week: number
  avg_percentage_this_week: number
  avg_percentage_last_week: number
  avg_percentage_this_month: number
  avg_percentage_last_3_months: number
}

export type DayStatus = 'submitted' | 'missing' | 'sunday' | 'future' | 'neutral'

export type EmployeeDayStatus = {
  day: number
  status: DayStatus
  label?: string
}

export type EmployeeMonthlyStats = {
  user_id: number
  user_name: string
  telegram_username?: string | null
  profile_image?: string | null
  submitted_count: number
  missing_count: number
  completion_percentage: number
  last_update_date: string | null
  daily_statuses?: EmployeeDayStatus[] | null
  base_salary?: number | null
  estimated_salary?: number | null
  final_salary?: number | null
  deduction_amount?: number | null
  bonus_amount?: number | null
  penalty_points?: number | null
  penalties_count?: number | null
  bonuses_count?: number | null
}

export type MemberMistakeRecord = {
  id: number
  employee_id: number
  employee_name?: string | null
  reviewer_id?: number | null
  reviewer_name?: string | null
  project_id?: number | null
  project_name?: string | null
  category: string
  severity: string
  title: string
  description?: string | null
  incident_date?: string | null
  reached_client: boolean
  unclear_task: boolean
  created_at?: string | null
  updated_at?: string | null
}

export type MemberMistakePayload = {
  employee_id: number
  reviewer_id: number
  project_id?: number | null
  category: string
  severity: string
  title: string
  description?: string
  incident_date: string
  reached_client: boolean
  unclear_task: boolean
}

export type MemberDeliveryBonusRecord = {
  id: number
  employee_id: number
  employee_name?: string | null
  project_id?: number | null
  project_name?: string | null
  bonus_type: string
  title: string
  description?: string | null
  award_date?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type MemberDeliveryBonusPayload = {
  employee_id: number
  bonus_type: string
  title: string
  description?: string
  award_date: string
  project_id?: number | null
}

export type SimpleBonusRecord = {
  id: number
  user_id: number
  year: number
  month: number
  amount: number
  reason: string
  created_at?: string | null
}

export type SimpleBonusPayload = {
  user_id: number
  year: number
  month: number
  amount: number
  reason: string
}

export type SimplePenaltyRecord = {
  id: number
  user_id: number
  year: number
  month: number
  amount: number
  reason: string
  created_at?: string | null
}

export type SimplePenaltyPayload = {
  user_id: number
  year: number
  month: number
  amount: number
  reason: string
}

export type MemberCompensationPolicyCategory = {
  key?: string | null
  value: string
  label?: string | null
}

export type MemberCompensationPolicyDeductionRate = {
  severity: string
  percent?: number | null
  amount?: number | null
}

export type MemberCompensationPolicyDecisionStep = {
  step: number
  question: string
  if_yes?: string | null
  if_no?: string | null
}

export type MemberCompensationPolicyRecord = {
  salary_base?: number | null
  monthly_deduction_cap_percent?: number | null
  monthly_deduction_cap_amount?: number | null
  responsibility_split?: {
    developer_percent?: number | null
    reviewer_percent?: number | null
  } | null
  deduction_rates?: MemberCompensationPolicyDeductionRate[] | null
  bonus_rates?: Record<string, number | null> | null
  mistake_categories?: MemberCompensationPolicyCategory[] | null
  severities?: string[] | null
  decision_tree?: MemberCompensationPolicyDecisionStep[] | null
}

export type MemberCompensationPolicyItem = {
  employee?: {
    id: number
    full_name?: string | null
  } | null
  policy?: MemberCompensationPolicyRecord | null
}

export type MemberCompensationPolicyResponse = {
  items: MemberCompensationPolicyItem[]
  total_count: number
  filters?: {
    employee_ids?: number[] | null
  } | null
}

export type TeamMonthlyResponse = {
  month: number
  year: number
  total_employees: number
  total_submitted: number
  total_missing: number
  avg_completion_percentage: number
  top_performer: EmployeeMonthlyStats | null
  employees: EmployeeMonthlyStats[]
}

export type ManagementPageRecord = {
  id: number
  name: string
  display_name: string
  description?: string | null
  route_path: string
  order: number
  is_active: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

export type ManagementPageCreatePayload = {
  name: string
  display_name: string
  description?: string
  route_path: string
  order: number
  is_active: boolean
  is_system: boolean
}

export type ManagementPageUpdatePayload = {
  display_name: string
  description?: string
  route_path: string
  order: number
  is_active: boolean
}

export type ManagementImageCleanupResponse = {
  message: string
  requested_count: number
  deleted_count: number
  missing_count: number
  skipped_count: number
  deleted_paths: string[]
  missing_paths: string[]
  skipped_items: string[]
  cleared_references: Record<string, number>
}

export type ManagementImageCategory =
  | 'project_images'
  | 'profile_images'
  | 'profil_images'
  | 'card_images'
  | (string & {})

export type ManagementImageRecord = {
  path: string
  file_url: string
  filename: string
  category: ManagementImageCategory
  size_bytes: number
  reference_count: number
  is_referenced: boolean
  updated_at: string
}

export type ManagementImagesListResponse = {
  total_count: number
  category?: ManagementImageCategory | null
  images: ManagementImageRecord[]
}

export type ManagementImageBulkDeletePayload = {
  image_paths?: string[]
  category?: ManagementImageCategory
  delete_all_in_category: boolean
  only_unreferenced: boolean
}

export type ManagementStatusRecord = {
  id: number
  name: string
  display_name: string
  description?: string | null
  color: string
  order: number
  is_active: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

export type ManagementStatusCreatePayload = {
  name: string
  display_name: string
  description?: string
  color: string
  order: number
  is_active: boolean
  is_system: boolean
}

export type ManagementStatusUpdatePayload = {
  display_name: string
  description?: string
  color: string
  order: number
  is_active: boolean
}

export type ManagementRoleRecord = {
  id: number
  name: string
  display_name: string
  description?: string | null
  is_active: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

export type ManagementRoleCreatePayload = {
  name: string
  display_name: string
  description?: string
  is_active: boolean
  is_system: boolean
}

export type ManagementRoleUpdatePayload = {
  display_name: string
  description?: string
  is_active: boolean
}
