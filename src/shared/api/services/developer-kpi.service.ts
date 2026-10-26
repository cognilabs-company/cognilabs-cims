import { request } from '../http'

export type WorkSchedule = {
  id: number
  user_id: number
  weekday: number
  work_start_time: string
  work_end_time: string
  free_start_time: string | null
  free_end_time: string | null
  late_grace_minutes: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export type FeatureStatus = 'planned' | 'in_progress' | 'completed' | 'accepted'

export type Feature = {
  id: number
  project_id: number
  title: string
  description: string | null
  acceptance_criteria: string | null
  points: number
  owner_id: number
  frontend_percent: number
  backend_percent: number
  due_date: string | null
  status: FeatureStatus
  is_mandatory: boolean
  is_locked: boolean
  accepted_at: string | null
  created_at: string
  updated_at: string
}

export type BlockedPeriodApprovalStatus = 'pending' | 'approved' | 'rejected'

export type BlockedPeriod = {
  id: number
  project_id: number
  feature_id: number | null
  employee_id: number
  started_at: string
  ended_at: string | null
  reason: string
  dependency: string | null
  evidence_url: string | null
  is_external: boolean
  approval_status: BlockedPeriodApprovalStatus
  approved_blocked_days: number | null
  created_at: string
  updated_at?: string
}

export type QualityEventSeverity =
  | 'minor_qa_reopen'
  | 'major_qa_reopen'
  | 'prod_bug'
  | 'major_prod_bug'
  | 'critical_prod_incident'
  | 'functional'
  | 'major'
  | 'critical'

export type QualityEventSource = 'manual' | 'automatic'

export type QualityEvent = {
  id: number
  project_id: number
  feature_id: number | null
  card_id: number | null
  employee_id: number
  severity: QualityEventSeverity | string
  source: QualityEventSource
  title: string
  description: string | null
  event_date: string
  confirmed: boolean
  is_duplicate: boolean
  external_cause: boolean
  created_at: string
}

export type KpiScores = {
  delivery: number
  deadline: number
  quality: number
  team: number
  discipline: number
  final_kpi: number
}

export type SalaryInfo = {
  base_salary: number
  max_kpi_fund: number
  kpi_bonus: number
  approved_deductions: number
  expected_salary: number
}

export type SalaryEstimate = {
  employee_id?: number
  employee_name?: string
  salary: SalaryInfo
  scores: KpiScores
  details: {
    delivery: Record<string, unknown>
    quality: Record<string, unknown>
    discipline: Record<string, unknown>
    team: Record<string, unknown>
    deductions: unknown[]
  }
}

export type DeductionStatus = 'pending' | 'approved' | 'rejected'

export type Deduction = {
  id: number
  employee_id: number
  year: number
  month: number
  type: string
  amount: number
  reason: string | null
  status: DeductionStatus
  created_at: string
  updated_at?: string
}

export type Snapshot = {
  id: number
  employee_id: number
  year: number
  month: number
  final_kpi: number
  expected_salary: number
  base_salary: number
  kpi_bonus: number
  approved_deductions: number
  frozen_at: string
}

export const FEATURE_POINTS = [1, 2, 3, 5, 8, 13] as const

export const QUALITY_SEVERITY_OPTIONS: Array<{ value: QualityEventSeverity; label: string }> = [
  { value: 'minor_qa_reopen', label: 'Minor QA Reopen' },
  { value: 'major_qa_reopen', label: 'Major QA Reopen' },
  { value: 'prod_bug', label: 'Prod Bug' },
  { value: 'major_prod_bug', label: 'Major Prod Bug' },
  { value: 'critical_prod_incident', label: 'Critical Prod Incident' },
  { value: 'functional', label: 'Functional' },
  { value: 'major', label: 'Major' },
  { value: 'critical', label: 'Critical' },
]

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const developerKpiService = {
  // Work Schedules
  listWorkSchedules(userId?: number) {
    return request<WorkSchedule[]>({
      path: '/developer-kpi/work-schedules',
      query: userId != null ? { user_id: userId } : undefined,
    })
  },

  createWorkSchedule(payload: Omit<WorkSchedule, 'id' | 'created_at' | 'updated_at'>) {
    return request<WorkSchedule>({
      path: '/developer-kpi/work-schedules',
      method: 'POST',
      body: payload,
    })
  },

  updateWorkSchedule(id: number, payload: Partial<Omit<WorkSchedule, 'id' | 'created_at' | 'updated_at'>>) {
    return request<WorkSchedule>({
      path: `/developer-kpi/work-schedules/${id}`,
      method: 'PATCH',
      body: payload,
    })
  },

  // Features
  listFeatures(params?: { year?: number; month?: number; owner_id?: number; project_id?: number }) {
    return request<Feature[]>({
      path: '/developer-kpi/features',
      query: params as Record<string, string | number | boolean | undefined | null>,
    })
  },

  createFeature(payload: {
    project_id: number
    title: string
    description?: string
    acceptance_criteria?: string
    points: number
    owner_id: number
    frontend_percent?: number
    backend_percent?: number
    due_date?: string
    status?: FeatureStatus
    is_mandatory?: boolean
    lock_now?: boolean
  }) {
    return request<Feature>({
      path: '/developer-kpi/features',
      method: 'POST',
      body: payload,
    })
  },

  updateFeature(id: number, payload: Partial<{
    title: string
    description: string
    acceptance_criteria: string
    points: number
    owner_id: number
    frontend_percent: number
    backend_percent: number
    due_date: string
    status: FeatureStatus
    is_mandatory: boolean
  }>) {
    return request<Feature>({
      path: `/developer-kpi/features/${id}`,
      method: 'PATCH',
      body: payload,
    })
  },

  acceptFeature(id: number, acceptedAt?: string) {
    return request<Feature>({
      path: `/developer-kpi/features/${id}/accept`,
      method: 'POST',
      body: acceptedAt ? { accepted_at: acceptedAt } : {},
    })
  },

  // Blocked Periods
  listBlockedPeriods(params?: { employee_id?: number; project_id?: number }) {
    return request<BlockedPeriod[]>({
      path: '/developer-kpi/blocked-periods',
      query: params as Record<string, string | number | boolean | undefined | null>,
    })
  },

  createBlockedPeriod(payload: {
    project_id: number
    feature_id?: number
    employee_id: number
    started_at: string
    ended_at?: string
    reason: string
    dependency?: string
    evidence_url?: string
    is_external?: boolean
  }) {
    return request<BlockedPeriod>({
      path: '/developer-kpi/blocked-periods',
      method: 'POST',
      body: payload,
    })
  },

  updateBlockedPeriod(id: number, payload: { approval_status: BlockedPeriodApprovalStatus }) {
    return request<BlockedPeriod>({
      path: `/developer-kpi/blocked-periods/${id}`,
      method: 'PATCH',
      body: payload,
    })
  },

  // Quality Events
  listQualityEvents(params?: { year?: number; month?: number; employee_id?: number; project_id?: number }) {
    return request<QualityEvent[]>({
      path: '/developer-kpi/quality-events',
      query: params as Record<string, string | number | boolean | undefined | null>,
    })
  },

  createQualityEvent(payload: {
    project_id: number
    feature_id?: number
    card_id?: number
    employee_id: number
    severity: QualityEventSeverity
    title: string
    description?: string
    event_date: string
    confirmed?: boolean
    is_duplicate?: boolean
    external_cause?: boolean
  }) {
    return request<QualityEvent>({
      path: '/developer-kpi/quality-events',
      method: 'POST',
      body: payload,
    })
  },

  // Salary Estimates
  getSalaryEstimate(employeeId: number, year: number, month: number) {
    return request<SalaryEstimate>({
      path: '/developer-kpi/salary-estimate',
      query: { employee_id: employeeId, year, month },
    })
  },

  listSalaryEstimates(year: number, month: number) {
    return request<SalaryEstimate[]>({
      path: '/developer-kpi/salary-estimates',
      query: { year, month },
    })
  },

  // Deductions
  listDeductions(params?: { year?: number; month?: number; employee_id?: number }) {
    return request<Deduction[]>({
      path: '/developer-kpi/deductions',
      query: params as Record<string, string | number | boolean | undefined | null>,
    })
  },

  updateDeduction(id: number, payload: { status: DeductionStatus; reason?: string }) {
    return request<Deduction>({
      path: `/developer-kpi/deductions/${id}`,
      method: 'PATCH',
      body: payload,
    })
  },

  // Snapshots
  listSnapshots(year: number, month: number) {
    return request<Snapshot[]>({
      path: '/developer-kpi/snapshots',
      query: { year, month },
    })
  },

  freezeSnapshot(year: number, month: number, employeeId?: number) {
    return request<{ message: string }>({
      path: '/developer-kpi/snapshots/freeze',
      method: 'POST',
      query: {
        year,
        month,
        ...(employeeId != null ? { employee_id: employeeId } : {}),
      },
    })
  },

  // Project Delivery
  updateProjectDelivery(projectId: number, payload: {
    actual_delivery_date?: string
    delivery_status?: string
    approved_blocked_days?: number
  }) {
    return request<{
      actual_delivery_date: string | null
      delivery_status: string | null
      approved_blocked_days: number
      real_delay_days: number
    }>({
      path: `/developer-kpi/projects/${projectId}/delivery`,
      method: 'PATCH',
      body: payload,
    })
  },
}
