import { useMemo, useState } from 'react'
import { ReceiptIcon, TargetIcon, TrendDownIcon, TrendUpIcon, WalletIcon } from '@phosphor-icons/react'
import { useAuth } from '../../auth/hooks/useAuth'
import { useLocale } from '../../../app/hooks/useLocale'
import { ceoService } from '../../../shared/api/services/ceo.service'
import {
  developerKpiService,
  FEATURE_POINTS,
  QUALITY_SEVERITY_OPTIONS,
  WEEKDAY_LABELS,
  type Feature,
  type FeatureStatus,
  type BlockedPeriod,
  type Deduction,
  type QualityEvent,
  type SalaryEstimate,
  type Snapshot,
  type WorkSchedule,
} from '../../../shared/api/services/developer-kpi.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { projectsService } from '../../../shared/api/services/projects.service'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { canReadManagedProjects } from '../../../shared/lib/permissions'
import { useToast } from '../../../shared/toast/useToast'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card, CardTitle } from '../../../shared/ui/card'
import { BarChartCard, type BarDatum } from '../../../shared/ui/charts/bar-chart-card'
import { FunnelStages, type FunnelStage } from '../../../shared/ui/charts/funnel-stages'
import { GaugeDonut, type GaugeSegment } from '../../../shared/ui/charts/gauge-donut'
import { Leaderboard, type LeaderboardEntry } from '../../../shared/ui/charts/leaderboard'
import { TaskList, type TaskRow } from '../../../shared/ui/charts/task-list'
import { Checkbox } from '../../../shared/ui/checkbox'
import { DataTable } from '../../../shared/ui/data-table'
import { Dialog } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { CalendarField } from '../../../shared/ui/calendar-field'
import { Label } from '../../../shared/ui/label'
import { Progress } from '../../../shared/ui/progress'
import { SelectField } from '../../../shared/ui/select-field'
import { StatCard } from '../../../shared/ui/stat-card'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { Tabs } from '../../../shared/ui/tabs'
import { Textarea } from '../../../shared/ui/textarea'
import { resolveTone, toneText } from '../../../shared/ui/tone'
import { TimeField } from '../../../shared/ui/time-field'

const TABS = [
  'salary_estimates',
  'features',
  'project_delivery',
  'quality_events',
  'blocked_periods',
  'deductions',
  'snapshots',
  'work_schedules',
] as const

type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = {
  salary_estimates: 'Salary Estimates',
  features: 'Features',
  project_delivery: 'Project Delivery',
  quality_events: 'Quality Events',
  blocked_periods: 'Blocked Periods',
  deductions: 'Deductions',
  snapshots: 'Frozen Snapshots',
  work_schedules: 'Work Schedules',
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const now = new Date()
const DEFAULT_YEAR = now.getFullYear()
const DEFAULT_MONTH = now.getMonth() + 1

const FILTER_SELECT = 'min-h-9 rounded-[11px] px-3 text-[13px]'
const DATA_CELL = 'text-[var(--muted-strong)]'
const PANEL = 'rounded-[18px] bg-[var(--accent-soft)] p-4'
const CHECK_ROW = 'flex cursor-pointer items-center gap-2.5 text-sm'
const CHECK_PANEL = 'flex flex-wrap items-center gap-4 rounded-[18px] bg-[var(--muted-surface)] p-3.5'

type StatusVariant = 'secondary' | 'blue' | 'success' | 'warning' | 'danger' | 'violet' | 'lime'
type KpiTone = 'blue' | 'success' | 'warning' | 'danger'

function statusVariant(status?: string | null): StatusVariant {
  const tone = resolveTone(status, 'warning')
  return tone === 'neutral' ? 'secondary' : tone
}

function kpiTone(score: number): KpiTone {
  return score >= 90 ? 'success' : score >= 70 ? 'blue' : score >= 50 ? 'warning' : 'danger'
}

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatKpi(score: number) {
  return `${score.toFixed(1)}%`
}

function IconPlan() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3.5h6v3H9zM7 5H5.5A1.5 1.5 0 0 0 4 6.5v13A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 18.5 5H17" />
      <path d="M8.5 11h7M8.5 15h4" />
    </svg>
  )
}

function IconProgress() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4.5V10h-5.5" />
    </svg>
  )
}

function IconCheckCircle() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12.5l2.8 2.8L16 9.8" />
    </svg>
  )
}

function IconTrophy() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  )
}

function KpiBadge({ score }: { score: number }) {
  return <Badge variant={kpiTone(score)}>{formatKpi(score)}</Badge>
}

function KpiBar({ label, score, weight }: { label: string; score: number; weight: string }) {
  const pct = Math.max(0, Math.min(100, score))
  const tone = kpiTone(pct)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="text-[var(--muted)]">{label} <span className="text-[var(--caption)]">({weight})</span></span>
        <span className={cn('font-semibold tabular-nums', toneText[tone])}>{pct.toFixed(1)}%</span>
      </div>
      <Progress value={pct} tone={tone} size="xs" />
    </div>
  )
}

const FEATURE_STATUS_META: Record<string, { label: string; variant: StatusVariant }> = {
  planned: { label: 'Planned', variant: 'secondary' },
  in_progress: { label: 'In Progress', variant: 'blue' },
  completed: { label: 'Completed', variant: 'warning' },
  accepted: { label: 'Accepted', variant: 'success' },
}

function FeatureStatusBadge({ status }: { status: FeatureStatus | string }) {
  const cfg = FEATURE_STATUS_META[status] ?? { label: status, variant: 'secondary' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

function SeverityBadge({ severity }: { severity: string }) {
  const danger = ['critical_prod_incident', 'critical', 'major_prod_bug'].includes(severity)
  const warning = ['major', 'major_qa_reopen', 'prod_bug'].includes(severity)
  const label = QUALITY_SEVERITY_OPTIONS.find((o) => o.value === severity)?.label ?? severity
  return <Badge variant={danger ? 'danger' : warning ? 'warning' : 'secondary'}>{label}</Badge>
}

type EstimateRow = { est: SalaryEstimate; userId: number }

function SalaryEstimatesTab({
  year,
  month,
  users,
  isCeo,
  selfId,
}: {
  year: number
  month: number
  users: Array<{ id: number; name: string; surname: string }>
  isCeo: boolean
  selfId?: number
}) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(isCeo ? null : (selfId ?? null))

  const estimatesQuery = useAsyncData(
    () => isCeo ? developerKpiService.listSalaryEstimates(year, month) : Promise.resolve([]),
    [year, month, isCeo],
    { enabled: isCeo },
  )

  const singleQuery = useAsyncData(
    () => selectedUserId != null ? developerKpiService.getSalaryEstimate(selectedUserId, year, month) : Promise.resolve(null),
    [selectedUserId, year, month],
    { enabled: selectedUserId != null },
  )

  const userOptions = useMemo(
    () => [
      { value: '', label: isCeo ? 'All employees' : 'Select employee' },
      ...users.map((u) => ({ value: String(u.id), label: `${u.name} ${u.surname}` })),
    ],
    [users, isCeo],
  )

  const estimate = singleQuery.data
  const list = Array.isArray(estimatesQuery.data) ? estimatesQuery.data : []
  const estimateRows: EstimateRow[] = list.map((est, index) => ({ est, userId: est.employee_id ?? index }))

  return (
    <div className="space-y-[18px]">
      <div className="flex flex-wrap items-center gap-2.5">
        {(isCeo || users.length > 0) && (
          <div className="w-52">
            <SelectField
              value={selectedUserId != null ? String(selectedUserId) : ''}
              onValueChange={(v) => setSelectedUserId(v ? Number(v) : null)}
              options={userOptions}
              className={FILTER_SELECT}
            />
          </div>
        )}
      </div>

      {selectedUserId != null && (
        <div className="space-y-[18px]">
          {singleQuery.isLoading && <LoadingStateBlock eyebrow="KPI" title="Loading estimate..." />}
          {singleQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(singleQuery.error)} />}
          {estimate && (
            <div className="space-y-[18px]">
              <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                {[
                  { label: 'Base Salary', value: formatCurrency(estimate.salary.base_salary), icon: <WalletIcon />, iconTone: 'blue' as const, solid: false },
                  { label: 'KPI Bonus', value: formatCurrency(estimate.salary.kpi_bonus), icon: <TrendUpIcon />, iconTone: 'success' as const, solid: false },
                  { label: 'Max KPI Fund', value: formatCurrency(estimate.salary.max_kpi_fund), icon: <TargetIcon />, iconTone: 'violet' as const, solid: false },
                  { label: 'Deductions', value: `-${formatCurrency(estimate.salary.approved_deductions)}`, icon: <TrendDownIcon />, iconTone: estimate.salary.approved_deductions > 0 ? ('danger' as const) : ('neutral' as const), solid: false },
                  { label: 'Expected Salary', value: formatCurrency(estimate.salary.expected_salary), icon: <ReceiptIcon />, iconTone: 'blue' as const, solid: true },
                ].map((item) => (
                  <StatCard
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    icon={item.icon}
                    iconTone={item.iconTone}
                    solid={item.solid}
                  />
                ))}
              </div>

              <Card className="space-y-[18px]">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>KPI Breakdown</CardTitle>
                  <KpiBadge score={estimate.scores.final_kpi} />
                </div>
                <div className="space-y-3.5 rounded-[18px] bg-[var(--muted-surface)] p-[18px]">
                  <KpiBar label="Delivery" score={estimate.scores.delivery} weight="35%" />
                  <KpiBar label="Deadline" score={estimate.scores.deadline} weight="20%" />
                  <KpiBar label="Quality" score={estimate.scores.quality} weight="20%" />
                  <KpiBar label="Team" score={estimate.scores.team} weight="15%" />
                  <KpiBar label="Discipline" score={estimate.scores.discipline} weight="10%" />
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {isCeo && selectedUserId == null && (
        <div>
          {(estimatesQuery.isLoading || estimatesQuery.isIdle) && <LoadingStateBlock eyebrow="KPI" title="Loading estimates..." />}
          {estimatesQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(estimatesQuery.error)} />}
          {estimatesQuery.isSuccess && list.length === 0 && <EmptyStateBlock eyebrow="Empty" title="No salary estimates for this period." />}
          {estimatesQuery.isSuccess && list.length > 0 && (
            <Card>
              <DataTable
                rows={estimateRows}
                getRowKey={(row: EstimateRow) => String(row.userId)}
                onRowClick={(row: EstimateRow) => setSelectedUserId(row.userId)}
                columns={[
                  {
                    key: 'employee',
                    header: 'Employee',
                    render: (row: EstimateRow) => {
                      const user = users.find((u) => u.id === row.userId)
                      const name = row.est.employee_name ?? (user ? `${user.name} ${user.surname}` : `#${row.userId}`)
                      return <span className="font-medium whitespace-nowrap text-[var(--foreground)]">{name}</span>
                    },
                  },
                  { key: 'final_kpi', header: 'Final KPI', render: (row: EstimateRow) => <KpiBadge score={row.est.scores.final_kpi} /> },
                  { key: 'base', header: 'Base', render: (row: EstimateRow) => <span className={cn('tabular-nums', DATA_CELL)}>{formatCurrency(row.est.salary.base_salary)}</span> },
                  { key: 'kpi_bonus', header: 'KPI Bonus', render: (row: EstimateRow) => <span className="font-semibold tabular-nums text-[var(--success-text)]">+{formatCurrency(row.est.salary.kpi_bonus)}</span> },
                  { key: 'deductions', header: 'Deductions', render: (row: EstimateRow) => <span className="tabular-nums text-[var(--danger-text)]">{row.est.salary.approved_deductions > 0 ? `-${formatCurrency(row.est.salary.approved_deductions)}` : '—'}</span> },
                  { key: 'expected', header: 'Expected', render: (row: EstimateRow) => <span className="font-semibold tabular-nums text-[var(--foreground)]">{formatCurrency(row.est.salary.expected_salary)}</span> },
                  { key: 'delivery', header: 'Delivery', render: (row: EstimateRow) => <span className={cn('tabular-nums', DATA_CELL)}>{formatKpi(row.est.scores.delivery)}</span> },
                  { key: 'deadline', header: 'Deadline', render: (row: EstimateRow) => <span className={cn('tabular-nums', DATA_CELL)}>{formatKpi(row.est.scores.deadline)}</span> },
                  { key: 'quality', header: 'Quality', render: (row: EstimateRow) => <span className={cn('tabular-nums', DATA_CELL)}>{formatKpi(row.est.scores.quality)}</span> },
                  { key: 'team', header: 'Team', render: (row: EstimateRow) => <span className={cn('tabular-nums', DATA_CELL)}>{formatKpi(row.est.scores.team)}</span> },
                  { key: 'discipline', header: 'Discipline', render: (row: EstimateRow) => <span className={cn('tabular-nums', DATA_CELL)}>{formatKpi(row.est.scores.discipline)}</span> },
                ]}
              />
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function FeaturesTab({
  year,
  month,
  users,
  isCeo,
  canCreate,
  canEdit,
  projects,
}: {
  year: number
  month: number
  users: Array<{ id: number; name: string; surname: string }>
  isCeo: boolean
  canCreate: boolean
  canEdit: boolean
  projects: Array<{ id: number; project_name: string }>
}) {
  const { showToast } = useToast()
  const [ownerFilter, setOwnerFilter] = useState<string>('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [acceptingId, setAcceptingId] = useState<number | null>(null)

  const [form, setForm] = useState({
    project_id: '',
    title: '',
    description: '',
    acceptance_criteria: '',
    points: '5',
    owner_id: '',
    frontend_percent: '0',
    backend_percent: '100',
    due_date: '',
    status: 'planned' as FeatureStatus,
    is_mandatory: false,
    lock_now: false,
  })

  const featuresQuery = useAsyncData(
    () => developerKpiService.listFeatures({
      year,
      month,
      owner_id: ownerFilter ? Number(ownerFilter) : undefined,
    }),
    [year, month, ownerFilter, refreshKey],
  )

  const features = featuresQuery.data ?? []

  const userOptions = useMemo(
    () => [
      { value: '', label: 'All owners' },
      ...users.map((u) => ({ value: String(u.id), label: `${u.name} ${u.surname}` })),
    ],
    [users],
  )

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'Select project' },
      ...projects.map((p) => ({ value: String(p.id), label: `#${p.id} — ${p.project_name}` })),
    ],
    [projects],
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await developerKpiService.createFeature({
        project_id: Number(form.project_id),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        acceptance_criteria: form.acceptance_criteria.trim() || undefined,
        points: Number(form.points),
        owner_id: Number(form.owner_id),
        frontend_percent: Number(form.frontend_percent),
        backend_percent: Number(form.backend_percent),
        due_date: form.due_date || undefined,
        status: form.status,
        is_mandatory: form.is_mandatory,
        lock_now: form.lock_now,
      })
      showToast({ tone: 'success', title: 'Feature created' })
      setShowCreate(false)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showToast({ tone: 'error', title: getApiErrorMessage(err) })
    }
  }

  async function handleAccept(feature: Feature) {
    setAcceptingId(feature.id)
    try {
      await developerKpiService.acceptFeature(feature.id)
      showToast({ tone: 'success', title: 'Feature accepted' })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showToast({ tone: 'error', title: getApiErrorMessage(err) })
    } finally {
      setAcceptingId(null)
    }
  }

  return (
    <div className="space-y-[18px]">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-48">
          <SelectField value={ownerFilter} onValueChange={setOwnerFilter} options={userOptions} className={FILTER_SELECT} />
        </div>
        {isCeo && canCreate && (
          <Button size="sm" onClick={() => setShowCreate(true)}>+ New Feature</Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</Button>
      </div>

      {featuresQuery.isLoading && <LoadingStateBlock eyebrow="Features" title="Loading features..." />}
      {featuresQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(featuresQuery.error)} />}
      {!featuresQuery.isLoading && features.length === 0 && <EmptyStateBlock eyebrow="Empty" title="No features for this period." />}

      {features.length > 0 && (
        <Card>
          <DataTable
            rows={features}
            getRowKey={(f: Feature) => String(f.id)}
            columns={[
              {
                key: 'title',
                header: 'Title',
                render: (f: Feature) => (
                  <div className="min-w-0">
                    <div className="max-w-48 truncate font-medium text-[var(--foreground)]">{f.title}</div>
                    {f.is_mandatory && <Badge variant="warning" className="mt-1.5">Mandatory</Badge>}
                  </div>
                ),
              },
              {
                key: 'points',
                header: 'Points',
                render: (f: Feature) => (
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-[9px] bg-[var(--blue-dim)] px-1.5 text-xs font-bold tabular-nums text-[var(--blue-text)]">{f.points}</span>
                ),
              },
              {
                key: 'owner',
                header: 'Owner',
                render: (f: Feature) => {
                  const owner = users.find((u) => u.id === f.owner_id)
                  return <span className={cn('whitespace-nowrap', DATA_CELL)}>{owner ? `${owner.name} ${owner.surname}` : `#${f.owner_id}`}</span>
                },
              },
              { key: 'status', header: 'Status', render: (f: Feature) => <FeatureStatusBadge status={f.status} /> },
              { key: 'due_date', header: 'Due Date', render: (f: Feature) => <span className={cn('whitespace-nowrap tabular-nums', DATA_CELL)}>{f.due_date ?? '—'}</span> },
              { key: 'frontend_percent', header: 'FE%', render: (f: Feature) => <span className={cn('tabular-nums', DATA_CELL)}>{f.frontend_percent}%</span> },
              { key: 'backend_percent', header: 'BE%', render: (f: Feature) => <span className={cn('tabular-nums', DATA_CELL)}>{f.backend_percent}%</span> },
              {
                key: 'locked',
                header: 'Locked',
                render: (f: Feature) => (
                  f.is_locked
                    ? <Badge variant="warning">Locked</Badge>
                    : <span className="text-xs text-[var(--muted)]">No</span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (f: Feature) => (
                  isCeo && canEdit && f.status !== 'accepted' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleAccept(f)}
                      disabled={acceptingId === f.id}
                    >
                      {acceptingId === f.id ? '...' : 'Accept'}
                    </Button>
                  ) : null
                ),
              },
            ]}
          />
        </Card>
      )}

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="New Feature">
        <form onSubmit={(e) => void handleCreate(e)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <SelectField
                value={form.project_id}
                onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}
                options={projectOptions}
                searchable
              />
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <SelectField
                value={form.owner_id}
                onValueChange={(v) => setForm((f) => ({ ...f, owner_id: v }))}
                options={[{ value: '', label: 'Select owner' }, ...users.map((u) => ({ value: String(u.id), label: `${u.name} ${u.surname}` }))]}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Acceptance Criteria</Label>
            <Textarea value={form.acceptance_criteria} onChange={(e) => setForm((f) => ({ ...f, acceptance_criteria: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Points</Label>
              <SelectField
                value={form.points}
                onValueChange={(v) => setForm((f) => ({ ...f, points: v }))}
                options={FEATURE_POINTS.map((p) => ({ value: String(p), label: String(p) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>FE %</Label>
              <Input type="number" min="0" max="100" value={form.frontend_percent} onChange={(e) => setForm((f) => ({ ...f, frontend_percent: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>BE %</Label>
              <Input type="number" min="0" max="100" value={form.backend_percent} onChange={(e) => setForm((f) => ({ ...f, backend_percent: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <CalendarField value={form.due_date} onValueChange={(value) => setForm((f) => ({ ...f, due_date: value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <SelectField
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as FeatureStatus }))}
                options={[
                  { value: 'planned', label: 'Planned' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'completed', label: 'Completed' },
                ]}
              />
            </div>
          </div>
          <div className={CHECK_PANEL}>
            <label className={CHECK_ROW}>
              <Checkbox size="sm" checked={form.is_mandatory} onChange={(e) => setForm((f) => ({ ...f, is_mandatory: e.target.checked }))} />
              <span className="text-[var(--foreground)]">Mandatory</span>
            </label>
            <label className={CHECK_ROW}>
              <Checkbox size="sm" checked={form.lock_now} onChange={(e) => setForm((f) => ({ ...f, lock_now: e.target.checked }))} />
              <span className="text-[var(--foreground)]">Lock immediately</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit">Create Feature</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

function DeductionsTab({
  year,
  month,
  users,
  isCeo,
  canEdit,
  selfId,
}: {
  year: number
  month: number
  users: Array<{ id: number; name: string; surname: string }>
  isCeo: boolean
  canEdit: boolean
  selfId?: number
}) {
  const { showToast } = useToast()
  const [employeeFilter, setEmployeeFilter] = useState(isCeo ? '' : String(selfId ?? ''))
  const [refreshKey, setRefreshKey] = useState(0)

  const deductionsQuery = useAsyncData(
    () => developerKpiService.listDeductions({
      year,
      month,
      employee_id: employeeFilter ? Number(employeeFilter) : undefined,
    }),
    [year, month, employeeFilter, refreshKey],
  )

  const deductions: Deduction[] = deductionsQuery.data ?? []

  async function handleApprove(d: Deduction, status: 'approved' | 'rejected') {
    try {
      await developerKpiService.updateDeduction(d.id, { status })
      showToast({ tone: 'success', title: `Deduction ${status}` })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showToast({ tone: 'error', title: getApiErrorMessage(err) })
    }
  }

  const userOptions = useMemo(
    () => [
      { value: '', label: 'All employees' },
      ...users.map((u) => ({ value: String(u.id), label: `${u.name} ${u.surname}` })),
    ],
    [users],
  )

  return (
    <div className="space-y-[18px]">
      {isCeo && (
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-48">
            <SelectField value={employeeFilter} onValueChange={setEmployeeFilter} options={userOptions} className={FILTER_SELECT} />
          </div>
          <Button size="sm" variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</Button>
        </div>
      )}

      {deductionsQuery.isLoading && <LoadingStateBlock eyebrow="Deductions" title="Loading deductions..." />}
      {deductionsQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(deductionsQuery.error)} />}
      {!deductionsQuery.isLoading && deductions.length === 0 && <EmptyStateBlock eyebrow="Empty" title="No deductions for this period." />}

      {deductions.length > 0 && (
        <Card>
          <DataTable
            rows={deductions}
            getRowKey={(d: Deduction) => String(d.id)}
            columns={[
              {
                key: 'employee',
                header: 'Employee',
                render: (d: Deduction) => {
                  const user = users.find((u) => u.id === d.employee_id)
                  const name = user ? `${user.name} ${user.surname}` : `#${d.employee_id}`
                  return <span className="font-medium whitespace-nowrap text-[var(--foreground)]">{name}</span>
                },
              },
              { key: 'type', header: 'Type', render: (d: Deduction) => <span className={DATA_CELL}>{d.type?.replace(/_/g, ' ') || '—'}</span> },
              { key: 'amount', header: 'Amount', render: (d: Deduction) => <span className="font-semibold tabular-nums text-[var(--danger-text)]">-{formatCurrency(d.amount)}</span> },
              { key: 'reason', header: 'Reason', render: (d: Deduction) => <span className={cn('block max-w-48 truncate', DATA_CELL)}>{d.reason ?? '—'}</span> },
              { key: 'status', header: 'Status', render: (d: Deduction) => <Badge variant={statusVariant(d.status)}>{d.status}</Badge> },
              ...(isCeo && canEdit
                ? [{
                    key: 'actions',
                    header: 'Actions',
                    render: (d: Deduction) => (
                      d.status === 'pending' ? (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="success" onClick={() => void handleApprove(d, 'approved')}>Approve</Button>
                          <Button size="sm" variant="danger" onClick={() => void handleApprove(d, 'rejected')}>Reject</Button>
                        </div>
                      ) : null
                    ),
                  }]
                : []),
            ]}
          />
        </Card>
      )}
    </div>
  )
}

function SnapshotsTab({
  year,
  month,
  users,
  isCeo,
  canCreate,
}: {
  year: number
  month: number
  users: Array<{ id: number; name: string; surname: string }>
  isCeo: boolean
  canCreate: boolean
}) {
  const { showToast } = useToast()
  const [refreshKey, setRefreshKey] = useState(0)
  const [freezeUserId, setFreezeUserId] = useState('')

  const snapshotsQuery = useAsyncData(
    () => developerKpiService.listSnapshots(year, month),
    [year, month, refreshKey],
  )

  const snapshots: Snapshot[] = snapshotsQuery.data ?? []

  async function handleFreeze() {
    try {
      await developerKpiService.freezeSnapshot(year, month, freezeUserId ? Number(freezeUserId) : undefined)
      showToast({ tone: 'success', title: 'Snapshot frozen successfully' })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showToast({ tone: 'error', title: getApiErrorMessage(err) })
    }
  }

  const userOptions = useMemo(
    () => [
      { value: '', label: 'All employees' },
      ...users.map((u) => ({ value: String(u.id), label: `${u.name} ${u.surname}` })),
    ],
    [users],
  )

  return (
    <div className="space-y-[18px]">
      {isCeo && (
        <div className="flex flex-wrap items-center gap-2.5">
          {canCreate && (
            <>
              <div className="w-48">
                <SelectField value={freezeUserId} onValueChange={setFreezeUserId} options={userOptions} className={FILTER_SELECT} />
              </div>
              <Button size="sm" onClick={() => void handleFreeze()}>
                Freeze Snapshot
              </Button>
            </>
          )}
          <Button size="sm" variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</Button>
          <span className="text-[12.5px] text-[var(--muted)]">Auto-freeze: last day of month at 23:55</span>
        </div>
      )}

      {snapshotsQuery.isLoading && <LoadingStateBlock eyebrow="Snapshots" title="Loading snapshots..." />}
      {snapshotsQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(snapshotsQuery.error)} />}
      {!snapshotsQuery.isLoading && snapshots.length === 0 && <EmptyStateBlock eyebrow="Empty" title="No frozen snapshots for this period." />}

      {snapshots.length > 0 && (
        <Card>
          <DataTable
            rows={snapshots}
            getRowKey={(s: Snapshot) => String(s.id)}
            columns={[
              {
                key: 'employee',
                header: 'Employee',
                render: (s: Snapshot) => {
                  const user = users.find((u) => u.id === s.employee_id)
                  const name = user ? `${user.name} ${user.surname}` : `#${s.employee_id}`
                  return <span className="font-medium whitespace-nowrap text-[var(--foreground)]">{name}</span>
                },
              },
              { key: 'final_kpi', header: 'Final KPI', render: (s: Snapshot) => <KpiBadge score={s.final_kpi} /> },
              { key: 'base', header: 'Base', render: (s: Snapshot) => <span className={cn('tabular-nums', DATA_CELL)}>{formatCurrency(s.base_salary)}</span> },
              { key: 'kpi_bonus', header: 'KPI Bonus', render: (s: Snapshot) => <span className="font-semibold tabular-nums text-[var(--success-text)]">+{formatCurrency(s.kpi_bonus)}</span> },
              { key: 'deductions', header: 'Deductions', render: (s: Snapshot) => <span className="tabular-nums text-[var(--danger-text)]">{s.approved_deductions > 0 ? `-${formatCurrency(s.approved_deductions)}` : '—'}</span> },
              { key: 'expected', header: 'Expected', render: (s: Snapshot) => <span className="font-semibold tabular-nums text-[var(--foreground)]">{formatCurrency(s.expected_salary)}</span> },
              { key: 'frozen_at', header: 'Frozen At', render: (s: Snapshot) => <span className="text-xs whitespace-nowrap tabular-nums text-[var(--muted)]">{new Date(s.frozen_at).toLocaleString()}</span> },
            ]}
          />
        </Card>
      )}
    </div>
  )
}

function QualityEventsTab({
  year,
  month,
  users,
  isCeo,
  canCreate,
  projects,
}: {
  year: number
  month: number
  users: Array<{ id: number; name: string; surname: string }>
  isCeo: boolean
  canCreate: boolean
  projects: Array<{ id: number; project_name: string }>
}) {
  const { showToast } = useToast()
  const [refreshKey, setRefreshKey] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [employeeFilter, setEmployeeFilter] = useState('')

  const [form, setForm] = useState({
    project_id: '',
    feature_id: '',
    employee_id: '',
    severity: 'major' as string,
    title: '',
    description: '',
    event_date: new Date().toISOString().slice(0, 10),
    confirmed: true,
    is_duplicate: false,
    external_cause: false,
  })

  const eventsQuery = useAsyncData(
    () => developerKpiService.listQualityEvents({
      year,
      month,
      employee_id: employeeFilter ? Number(employeeFilter) : undefined,
    }),
    [year, month, employeeFilter, refreshKey],
  )

  const events: QualityEvent[] = eventsQuery.data ?? []

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await developerKpiService.createQualityEvent({
        project_id: Number(form.project_id),
        feature_id: form.feature_id ? Number(form.feature_id) : undefined,
        employee_id: Number(form.employee_id),
        severity: form.severity as never,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        event_date: form.event_date,
        confirmed: form.confirmed,
        is_duplicate: form.is_duplicate,
        external_cause: form.external_cause,
      })
      showToast({ tone: 'success', title: 'Quality event created' })
      setShowCreate(false)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showToast({ tone: 'error', title: getApiErrorMessage(err) })
    }
  }

  const userOptions = useMemo(
    () => [
      { value: '', label: 'All employees' },
      ...users.map((u) => ({ value: String(u.id), label: `${u.name} ${u.surname}` })),
    ],
    [users],
  )

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'Select project' },
      ...projects.map((p) => ({ value: String(p.id), label: `#${p.id} — ${p.project_name}` })),
    ],
    [projects],
  )

  return (
    <div className="space-y-[18px]">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-48">
          <SelectField value={employeeFilter} onValueChange={setEmployeeFilter} options={userOptions} className={FILTER_SELECT} />
        </div>
        {isCeo && canCreate && <Button size="sm" onClick={() => setShowCreate(true)}>+ New Event</Button>}
        <Button size="sm" variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</Button>
      </div>

      {eventsQuery.isLoading && <LoadingStateBlock eyebrow="Quality" title="Loading quality events..." />}
      {eventsQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(eventsQuery.error)} />}
      {!eventsQuery.isLoading && events.length === 0 && <EmptyStateBlock eyebrow="Empty" title="No quality events for this period." />}

      {events.length > 0 && (
        <Card>
          <DataTable
            rows={events}
            getRowKey={(ev: QualityEvent) => String(ev.id)}
            columns={[
              { key: 'title', header: 'Title', render: (ev: QualityEvent) => <span className="block max-w-48 truncate font-medium text-[var(--foreground)]">{ev.title}</span> },
              {
                key: 'employee',
                header: 'Employee',
                render: (ev: QualityEvent) => {
                  const user = users.find((u) => u.id === ev.employee_id)
                  const name = user ? `${user.name} ${user.surname}` : `#${ev.employee_id}`
                  return <span className={cn('whitespace-nowrap', DATA_CELL)}>{name}</span>
                },
              },
              { key: 'severity', header: 'Severity', render: (ev: QualityEvent) => <SeverityBadge severity={ev.severity} /> },
              { key: 'source', header: 'Source', render: (ev: QualityEvent) => <Badge variant={ev.source === 'automatic' ? 'warning' : 'secondary'}>{ev.source}</Badge> },
              { key: 'event_date', header: 'Date', render: (ev: QualityEvent) => <span className={cn('whitespace-nowrap tabular-nums', DATA_CELL)}>{ev.event_date}</span> },
              { key: 'confirmed', header: 'Confirmed', render: (ev: QualityEvent) => (ev.confirmed ? <Badge variant="success">Yes</Badge> : <Badge variant="secondary">No</Badge>) },
              { key: 'is_duplicate', header: 'Duplicate', render: (ev: QualityEvent) => (ev.is_duplicate ? <Badge variant="warning">Yes</Badge> : '—') },
              { key: 'external_cause', header: 'External', render: (ev: QualityEvent) => (ev.external_cause ? <Badge variant="blue">Yes</Badge> : '—') },
            ]}
          />
        </Card>
      )}

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="New Quality Event">
        <form onSubmit={(e) => void handleCreate(e)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <SelectField
                value={form.project_id}
                onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}
                options={projectOptions}
                searchable
              />
            </div>
            <div className="space-y-1.5">
              <Label>Feature ID <span className="text-[var(--muted)]">(optional)</span></Label>
              <Input type="number" value={form.feature_id} onChange={(e) => setForm((f) => ({ ...f, feature_id: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Employee</Label>
            <SelectField
              value={form.employee_id}
              onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}
              options={[{ value: '', label: 'Select employee' }, ...users.map((u) => ({ value: String(u.id), label: `${u.name} ${u.surname}` }))]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Severity</Label>
            <SelectField
              value={form.severity}
              onValueChange={(v) => setForm((f) => ({ ...f, severity: v }))}
              options={QUALITY_SEVERITY_OPTIONS}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Event Date</Label>
            <CalendarField value={form.event_date} onValueChange={(value) => setForm((f) => ({ ...f, event_date: value }))} required />
          </div>
          <div className={CHECK_PANEL}>
            <label className={CHECK_ROW}>
              <Checkbox size="sm" checked={form.confirmed} onChange={(e) => setForm((f) => ({ ...f, confirmed: e.target.checked }))} />
              <span>Confirmed</span>
            </label>
            <label className={CHECK_ROW}>
              <Checkbox size="sm" checked={form.external_cause} onChange={(e) => setForm((f) => ({ ...f, external_cause: e.target.checked }))} />
              <span>External cause</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

function BlockedPeriodsTab({
  users,
  isCeo,
  canCreate,
  canEdit,
  projects,
}: {
  users: Array<{ id: number; name: string; surname: string }>
  isCeo: boolean
  canCreate: boolean
  canEdit: boolean
  projects: Array<{ id: number; project_name: string }>
}) {
  const { showToast } = useToast()
  const [refreshKey, setRefreshKey] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [employeeFilter, setEmployeeFilter] = useState('')

  const [form, setForm] = useState({
    project_id: '',
    feature_id: '',
    employee_id: '',
    started_at: '',
    ended_at: '',
    reason: '',
    dependency: '',
    evidence_url: '',
    is_external: true,
  })

  const periodsQuery = useAsyncData(
    () => developerKpiService.listBlockedPeriods(employeeFilter ? { employee_id: Number(employeeFilter) } : undefined),
    [employeeFilter, refreshKey],
  )

  const periods: BlockedPeriod[] = periodsQuery.data ?? []

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await developerKpiService.createBlockedPeriod({
        project_id: Number(form.project_id),
        feature_id: form.feature_id ? Number(form.feature_id) : undefined,
        employee_id: Number(form.employee_id),
        started_at: form.started_at,
        ended_at: form.ended_at || undefined,
        reason: form.reason.trim(),
        dependency: form.dependency.trim() || undefined,
        evidence_url: form.evidence_url.trim() || undefined,
        is_external: form.is_external,
      })
      showToast({ tone: 'success', title: 'Blocked period created' })
      setShowCreate(false)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showToast({ tone: 'error', title: getApiErrorMessage(err) })
    }
  }

  async function handleApprove(id: number, status: 'approved' | 'rejected') {
    try {
      await developerKpiService.updateBlockedPeriod(id, { approval_status: status })
      showToast({ tone: 'success', title: `Period ${status}` })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showToast({ tone: 'error', title: getApiErrorMessage(err) })
    }
  }

  const userOptions = useMemo(
    () => [
      { value: '', label: 'All employees' },
      ...users.map((u) => ({ value: String(u.id), label: `${u.name} ${u.surname}` })),
    ],
    [users],
  )

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'Select project' },
      ...projects.map((p) => ({ value: String(p.id), label: `#${p.id} — ${p.project_name}` })),
    ],
    [projects],
  )

  return (
    <div className="space-y-[18px]">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-48">
          <SelectField value={employeeFilter} onValueChange={setEmployeeFilter} options={userOptions} className={FILTER_SELECT} />
        </div>
        {canCreate && <Button size="sm" onClick={() => setShowCreate(true)}>+ New Period</Button>}
        <Button size="sm" variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</Button>
      </div>

      {periodsQuery.isLoading && <LoadingStateBlock eyebrow="Blocked Periods" title="Loading blocked periods..." />}
      {periodsQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(periodsQuery.error)} />}
      {!periodsQuery.isLoading && periods.length === 0 && <EmptyStateBlock eyebrow="Empty" title="No blocked periods." />}

      {periods.length > 0 && (
        <Card>
          <DataTable
            rows={periods}
            getRowKey={(p: BlockedPeriod) => String(p.id)}
            columns={[
              {
                key: 'employee',
                header: 'Employee',
                render: (p: BlockedPeriod) => {
                  const user = users.find((u) => u.id === p.employee_id)
                  const name = user ? `${user.name} ${user.surname}` : `#${p.employee_id}`
                  return <span className="font-medium whitespace-nowrap text-[var(--foreground)]">{name}</span>
                },
              },
              { key: 'reason', header: 'Reason', render: (p: BlockedPeriod) => <span className={cn('block max-w-40 truncate', DATA_CELL)}>{p.reason}</span> },
              { key: 'started_at', header: 'Started', render: (p: BlockedPeriod) => <span className={cn('whitespace-nowrap tabular-nums', DATA_CELL)}>{new Date(p.started_at).toLocaleDateString()}</span> },
              { key: 'ended_at', header: 'Ended', render: (p: BlockedPeriod) => <span className={cn('whitespace-nowrap tabular-nums', DATA_CELL)}>{p.ended_at ? new Date(p.ended_at).toLocaleDateString() : '—'}</span> },
              { key: 'dependency', header: 'Dependency', render: (p: BlockedPeriod) => <span className={DATA_CELL}>{p.dependency ?? '—'}</span> },
              { key: 'is_external', header: 'External', render: (p: BlockedPeriod) => (p.is_external ? <Badge variant="blue">External</Badge> : '—') },
              { key: 'status', header: 'Status', render: (p: BlockedPeriod) => <Badge variant={statusVariant(p.approval_status)}>{p.approval_status}</Badge> },
              ...(isCeo && canEdit
                ? [{
                    key: 'actions',
                    header: 'Actions',
                    render: (p: BlockedPeriod) => (
                      p.approval_status === 'pending' ? (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="success" onClick={() => void handleApprove(p.id, 'approved')}>Approve</Button>
                          <Button size="sm" variant="danger" onClick={() => void handleApprove(p.id, 'rejected')}>Reject</Button>
                        </div>
                      ) : null
                    ),
                  }]
                : []),
            ]}
          />
        </Card>
      )}

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="New Blocked Period">
        <form onSubmit={(e) => void handleCreate(e)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <SelectField
                value={form.project_id}
                onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}
                options={projectOptions}
                searchable
              />
            </div>
            <div className="space-y-1.5">
              <Label>Feature ID <span className="text-[var(--muted)]">(optional)</span></Label>
              <Input type="number" value={form.feature_id} onChange={(e) => setForm((f) => ({ ...f, feature_id: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Employee</Label>
            <SelectField
              value={form.employee_id}
              onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}
              options={[{ value: '', label: 'Select employee' }, ...users.map((u) => ({ value: String(u.id), label: `${u.name} ${u.surname}` }))]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={2} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Started At</Label>
              <CalendarField mode="datetime" value={form.started_at} onValueChange={(value) => setForm((f) => ({ ...f, started_at: value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Ended At <span className="text-[var(--muted)]">(optional)</span></Label>
              <CalendarField mode="datetime" value={form.ended_at} onValueChange={(value) => setForm((f) => ({ ...f, ended_at: value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Dependency</Label>
            <Input value={form.dependency} onChange={(e) => setForm((f) => ({ ...f, dependency: e.target.value }))} placeholder="Client, Third-party, etc." />
          </div>
          <div className="space-y-1.5">
            <Label>Evidence URL <span className="text-[var(--muted)]">(optional)</span></Label>
            <Input type="url" value={form.evidence_url} onChange={(e) => setForm((f) => ({ ...f, evidence_url: e.target.value }))} />
          </div>
          <label className={cn(CHECK_ROW, 'rounded-[18px] bg-[var(--muted-surface)] p-3.5')}>
            <Checkbox size="sm" checked={form.is_external} onChange={(e) => setForm((f) => ({ ...f, is_external: e.target.checked }))} />
            <span>External blocker (counts toward approved blocked days)</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

function WorkSchedulesTab({
  users,
  isCeo,
  canCreate,
}: {
  users: Array<{ id: number; name: string; surname: string }>
  isCeo: boolean
  canCreate: boolean
}) {
  const { showToast } = useToast()
  const [refreshKey, setRefreshKey] = useState(0)
  const [userFilter, setUserFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const [form, setForm] = useState({
    user_id: '',
    weekday: '0',
    work_start_time: '09:00:00',
    work_end_time: '18:00:00',
    free_start_time: '',
    free_end_time: '',
    late_grace_minutes: '10',
    is_active: true,
  })

  const schedulesQuery = useAsyncData(
    () => developerKpiService.listWorkSchedules(userFilter ? Number(userFilter) : undefined),
    [userFilter, refreshKey],
  )

  const schedules: WorkSchedule[] = schedulesQuery.data ?? []

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await developerKpiService.createWorkSchedule({
        user_id: Number(form.user_id),
        weekday: Number(form.weekday),
        work_start_time: form.work_start_time,
        work_end_time: form.work_end_time,
        free_start_time: form.free_start_time || null,
        free_end_time: form.free_end_time || null,
        late_grace_minutes: Number(form.late_grace_minutes),
        is_active: form.is_active,
      })
      showToast({ tone: 'success', title: 'Work schedule created' })
      setShowCreate(false)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showToast({ tone: 'error', title: getApiErrorMessage(err) })
    }
  }

  const userOptions = useMemo(
    () => [
      { value: '', label: 'All employees' },
      ...users.map((u) => ({ value: String(u.id), label: `${u.name} ${u.surname}` })),
    ],
    [users],
  )

  return (
    <div className="space-y-[18px]">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-48">
          <SelectField value={userFilter} onValueChange={setUserFilter} options={userOptions} className={FILTER_SELECT} />
        </div>
        {isCeo && canCreate && <Button size="sm" onClick={() => setShowCreate(true)}>+ New Schedule</Button>}
        <Button size="sm" variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</Button>
      </div>

      {schedulesQuery.isLoading && <LoadingStateBlock eyebrow="Schedules" title="Loading work schedules..." />}
      {schedulesQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(schedulesQuery.error)} />}
      {!schedulesQuery.isLoading && schedules.length === 0 && <EmptyStateBlock eyebrow="Empty" title="No work schedules." />}

      {schedules.length > 0 && (
        <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
          {schedules.map((s) => {
            const user = users.find((u) => u.id === s.user_id)
            const name = user ? `${user.name} ${user.surname}` : `User #${s.user_id}`
            return (
              <Card key={s.id} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <span className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{name}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary">{WEEKDAY_LABELS[s.weekday] ?? `Day ${s.weekday}`}</Badge>
                    {s.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Inactive</Badge>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 rounded-[18px] bg-[var(--accent-soft)] p-3.5 text-[12.5px]">
                  <div>
                    <span className="text-[var(--muted)]">Work: </span>
                    <span className="font-semibold tabular-nums text-[var(--foreground)]">{s.work_start_time} – {s.work_end_time}</span>
                  </div>
                  {s.free_start_time && s.free_end_time && (
                    <div>
                      <span className="text-[var(--muted)]">Break: </span>
                      <span className="font-semibold tabular-nums text-[var(--foreground)]">{s.free_start_time} – {s.free_end_time}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[var(--muted)]">Grace: </span>
                    <span className="font-semibold tabular-nums text-[var(--foreground)]">{s.late_grace_minutes} min</span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="New Work Schedule">
        <form onSubmit={(e) => void handleCreate(e)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Employee</Label>
            <SelectField
              value={form.user_id}
              onValueChange={(v) => setForm((f) => ({ ...f, user_id: v }))}
              options={[{ value: '', label: 'Select employee' }, ...users.map((u) => ({ value: String(u.id), label: `${u.name} ${u.surname}` }))]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Weekday</Label>
            <SelectField
              value={form.weekday}
              onValueChange={(v) => setForm((f) => ({ ...f, weekday: v }))}
              options={WEEKDAY_LABELS.map((d, i) => ({ value: String(i), label: d }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Work Start</Label>
              <TimeField value={form.work_start_time} onValueChange={(value) => setForm((f) => ({ ...f, work_start_time: value ? `${value}:00` : '' }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Work End</Label>
              <TimeField value={form.work_end_time} onValueChange={(value) => setForm((f) => ({ ...f, work_end_time: value ? `${value}:00` : '' }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Break Start <span className="text-[var(--muted)]">(optional)</span></Label>
              <TimeField value={form.free_start_time} onValueChange={(value) => setForm((f) => ({ ...f, free_start_time: value ? `${value}:00` : '' }))} clearable />
            </div>
            <div className="space-y-1.5">
              <Label>Break End <span className="text-[var(--muted)]">(optional)</span></Label>
              <TimeField value={form.free_end_time} onValueChange={(value) => setForm((f) => ({ ...f, free_end_time: value ? `${value}:00` : '' }))} clearable />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Grace minutes (late)</Label>
            <Input type="number" min="0" max="60" value={form.late_grace_minutes} onChange={(e) => setForm((f) => ({ ...f, late_grace_minutes: e.target.value }))} />
          </div>
          <label className={cn(CHECK_ROW, 'rounded-[18px] bg-[var(--muted-surface)] p-3.5')}>
            <Checkbox size="sm" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
            <span>Active</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit">Create Schedule</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

type DeliveryStatus = 'in_progress' | 'delivered' | 'delayed' | 'cancelled'

const DELIVERY_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function ProjectDeliveryTab({ isCeo, canEdit, projects }: { isCeo: boolean; canEdit: boolean; projects: Array<{ id: number; project_name: string }> }) {
  const { showToast } = useToast()
  const [projectId, setProjectId] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    actual_delivery_date: '',
    delivery_status: 'in_progress' as DeliveryStatus,
    approved_blocked_days: '0',
  })
  const [result, setResult] = useState<{
    actual_delivery_date: string | null
    delivery_status: string | null
    approved_blocked_days: number
    real_delay_days: number
  } | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId) return
    setSaving(true)
    try {
      const res = await developerKpiService.updateProjectDelivery(Number(projectId), {
        actual_delivery_date: form.actual_delivery_date || undefined,
        delivery_status: form.delivery_status,
        approved_blocked_days: Number(form.approved_blocked_days),
      })
      setResult(res)
      showToast({ tone: 'success', title: 'Project delivery updated' })
    } catch (err) {
      showToast({ tone: 'error', title: getApiErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'Select project' },
      ...projects.map((p) => ({ value: String(p.id), label: `#${p.id} — ${p.project_name}` })),
    ],
    [projects],
  )

  return (
    <div className="max-w-2xl space-y-[18px]">
      <Card className="space-y-[18px]">
        <p className="text-sm text-[var(--muted)]">
          Set the actual delivery date for a project. Backend calculates real delay days (Sunday-off) and creates deduction candidates if delay exceeds 3 business days.
        </p>

        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Project</Label>
            <SelectField
              value={projectId}
              onValueChange={setProjectId}
              options={projectOptions}
              searchable
            />
          </div>
          <div className="space-y-1.5">
            <Label>Actual Delivery Date</Label>
            <CalendarField value={form.actual_delivery_date} onValueChange={(value) => setForm((f) => ({ ...f, actual_delivery_date: value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Delivery Status</Label>
            <SelectField
              value={form.delivery_status}
              onValueChange={(v) => setForm((f) => ({ ...f, delivery_status: v as DeliveryStatus }))}
              options={DELIVERY_STATUS_OPTIONS}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Approved Blocked Days</Label>
            <Input
              type="number"
              min="0"
              value={form.approved_blocked_days}
              onChange={(e) => setForm((f) => ({ ...f, approved_blocked_days: e.target.value }))}
            />
            <p className="text-xs text-[var(--muted)]">Approved external blocked business days removed from delay calculation.</p>
          </div>
          {isCeo && canEdit && (
            <Button type="submit" disabled={saving || !projectId}>
              {saving ? 'Saving...' : 'Update Delivery'}
            </Button>
          )}
        </form>
      </Card>

      {result && (
        <Card className="space-y-4">
          <CardTitle>Result</CardTitle>
          <div className="grid grid-cols-2 gap-[18px]">
            <div className={PANEL}>
              <p className="ui-card-label">Delivery Date</p>
              <p className="mt-2 text-sm font-semibold tabular-nums text-[var(--foreground)]">{result.actual_delivery_date ?? '—'}</p>
            </div>
            <div className={PANEL}>
              <p className="ui-card-label">Status</p>
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{result.delivery_status ?? '—'}</p>
            </div>
            <div className={PANEL}>
              <p className="ui-card-label">Approved Blocked Days</p>
              <p className="mt-2 text-sm font-semibold tabular-nums text-[var(--foreground)]">{result.approved_blocked_days}</p>
            </div>
            <div className={PANEL}>
              <p className="ui-card-label">Real Delay Days</p>
              <p className={cn('mt-2 text-sm font-semibold tabular-nums', result.real_delay_days > 3 ? 'text-[var(--danger-text)]' : 'text-[var(--success-text)]')}>
                {result.real_delay_days} {result.real_delay_days > 3 && '⚠ deduction candidate'}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
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

type DeveloperKpiOverviewProps = {
  estimates: SalaryEstimate[]
  features: Feature[]
  users: Array<{ id: number; name: string; surname: string }>
  isCeo: boolean
  monthLabel: string
  onOpenTab: (tab: Tab) => void
}

function DeveloperKpiOverview({
  estimates,
  features,
  users,
  isCeo,
  monthLabel,
  onOpenTab,
}: DeveloperKpiOverviewProps) {
  const { t } = useLocale()

  const hasEstimates = estimates.length > 0

  const scores = useMemo(() => {
    const divisor = estimates.length || 1
    const totals = estimates.reduce(
      (acc, item) => ({
        delivery: acc.delivery + item.scores.delivery,
        deadline: acc.deadline + item.scores.deadline,
        quality: acc.quality + item.scores.quality,
        team: acc.team + item.scores.team,
        discipline: acc.discipline + item.scores.discipline,
        final_kpi: acc.final_kpi + item.scores.final_kpi,
      }),
      { delivery: 0, deadline: 0, quality: 0, team: 0, discipline: 0, final_kpi: 0 },
    )

    return {
      delivery: totals.delivery / divisor,
      deadline: totals.deadline / divisor,
      quality: totals.quality / divisor,
      team: totals.team / divisor,
      discipline: totals.discipline / divisor,
      final: totals.final_kpi / divisor,
    }
  }, [estimates])

  const payroll = useMemo(
    () =>
      estimates.reduce(
        (acc, item) => ({
          base: acc.base + item.salary.base_salary,
          bonus: acc.bonus + item.salary.kpi_bonus,
          maxFund: acc.maxFund + item.salary.max_kpi_fund,
          deductions: acc.deductions + item.salary.approved_deductions,
          expected: acc.expected + item.salary.expected_salary,
        }),
        { base: 0, bonus: 0, maxFund: 0, deductions: 0, expected: 0 },
      ),
    [estimates],
  )

  const scoreBars = useMemo<BarDatum[]>(() => {
    if (!hasEstimates) {
      return []
    }

    return [
      { key: 'delivery', label: 'Delivery', value: scores.delivery, amount: formatKpi(scores.delivery), delta: '35%' },
      { key: 'deadline', label: 'Deadline', value: scores.deadline, amount: formatKpi(scores.deadline), delta: '20%' },
      { key: 'quality', label: 'Quality', value: scores.quality, amount: formatKpi(scores.quality), delta: '20%' },
      { key: 'team', label: 'Team', value: scores.team, amount: formatKpi(scores.team), delta: '15%' },
      { key: 'discipline', label: 'Discipline', value: scores.discipline, amount: formatKpi(scores.discipline), delta: '10%' },
    ]
  }, [hasEstimates, scores])

  const weakestKey = useMemo(() => {
    if (scoreBars.length === 0) {
      return undefined
    }

    return scoreBars.reduce((lowest, item) => (item.value < lowest.value ? item : lowest), scoreBars[0]).key
  }, [scoreBars])

  const tiers = useMemo<GaugeSegment[]>(() => {
    let excellent = 0
    let onTrack = 0
    let atRisk = 0

    for (const item of estimates) {
      if (item.scores.final_kpi >= 90) {
        excellent += 1
      } else if (item.scores.final_kpi >= 70) {
        onTrack += 1
      } else {
        atRisk += 1
      }
    }

    return [
      { key: 'excellent', label: t('developer_kpi.overview.tier_excellent', 'Excellent'), value: excellent, color: '#A6E83B' },
      { key: 'on_track', label: t('developer_kpi.overview.tier_on_track', 'On track'), value: onTrack, color: '#2B59FF' },
      { key: 'at_risk', label: t('developer_kpi.overview.tier_at_risk', 'At risk'), value: atRisk, color: '#FFB86B' },
    ]
  }, [estimates, t])

  const pipeline = useMemo(() => {
    const counts: Record<FeatureStatus, number> = { planned: 0, in_progress: 0, completed: 0, accepted: 0 }
    let points = 0
    let acceptedPoints = 0
    let mandatory = 0

    for (const feature of features) {
      const status = feature.status

      if (status === 'planned' || status === 'in_progress' || status === 'completed' || status === 'accepted') {
        counts[status] += 1
      }

      points += feature.points

      if (status === 'accepted') {
        acceptedPoints += feature.points
      }

      if (feature.is_mandatory) {
        mandatory += 1
      }
    }

    return { counts, points, acceptedPoints, mandatory }
  }, [features])

  const funnelStages = useMemo<FunnelStage[]>(() => {
    const steps = [
      { key: 'planned' as FeatureStatus, icon: <IconPlan />, hero: false },
      { key: 'in_progress' as FeatureStatus, icon: <IconProgress />, hero: false },
      { key: 'completed' as FeatureStatus, icon: <IconCheckCircle />, hero: false },
      { key: 'accepted' as FeatureStatus, icon: <IconTrophy />, hero: true },
    ]
    const max = steps.reduce((acc, step) => Math.max(acc, pipeline.counts[step.key]), 0) || 1

    return steps.map((step) => ({
      key: step.key,
      label: FEATURE_STATUS_META[step.key].label,
      count: pipeline.counts[step.key],
      value: pipeline.counts[step.key],
      percent: Math.round((pipeline.counts[step.key] / max) * 100),
      icon: step.icon,
      hero: step.hero,
    }))
  }, [pipeline])

  const deadlines = useMemo<TaskRow[]>(() => {
    const reference = new Date()
    const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime()
    const dayMs = 86_400_000

    return features
      .filter((feature) => Boolean(feature.due_date) && feature.status !== 'accepted')
      .sort((left, right) => String(left.due_date).localeCompare(String(right.due_date)))
      .slice(0, 6)
      .map((feature) => {
        const due = new Date(String(feature.due_date))
        const dueStart = Number.isNaN(due.getTime())
          ? today
          : new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()
        const daysLeft = Math.round((dueStart - today) / dayMs)
        const owner = users.find((item) => item.id === feature.owner_id)
        const tone: TaskRow['tone'] = daysLeft < 0 ? 'danger' : daysLeft <= 3 ? 'warning' : 'blue'

        return {
          key: String(feature.id),
          title: feature.title,
          meta: owner ? `${owner.name} ${owner.surname}` : `#${feature.owner_id}`,
          tag: String(feature.due_date),
          tone,
        }
      })
  }, [features, users])

  const owners = useMemo<LeaderboardEntry[]>(() => {
    const buckets = new Map<number, { points: number; count: number }>()

    for (const feature of features) {
      const bucket = buckets.get(feature.owner_id) ?? { points: 0, count: 0 }
      bucket.points += feature.points
      bucket.count += 1
      buckets.set(feature.owner_id, bucket)
    }

    const ranked = [...buckets.entries()].sort(([, left], [, right]) => right.points - left.points).slice(0, 5)
    const max = ranked.length > 0 ? ranked[0][1].points : 0

    return ranked.map(([ownerId, bucket]) => {
      const owner = users.find((item) => item.id === ownerId)
      const name = owner ? `${owner.name} ${owner.surname}` : `#${ownerId}`

      return {
        key: String(ownerId),
        name,
        initials: initialsOf(name),
        caption: t('developer_kpi.overview.owner_features', '{{count}} features', { count: bucket.count }),
        amount: bucket.points,
        percent: max > 0 ? Math.round((bucket.points / max) * 100) : 0,
      }
    })
  }, [features, t, users])

  const emptyHint = (
    <p className="py-10 text-center text-[13px] text-[var(--muted)]">
      {t('developer_kpi.overview.no_data', 'No KPI data for this period yet.')}
    </p>
  )

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        <StatCard
          solid
          label={isCeo ? t('developer_kpi.overview.team_kpi', 'Team KPI') : t('developer_kpi.overview.my_kpi', 'My KPI')}
          value={hasEstimates ? formatKpi(scores.final) : '—'}
          icon={<TargetIcon />}
          hint={t('developer_kpi.overview.weighted_hint', 'Weighted across five KPI components')}
        />
        <StatCard
          label={t('developer_kpi.overview.expected_payroll', 'Expected payroll')}
          value={hasEstimates ? formatCurrency(payroll.expected) : '—'}
          icon={<WalletIcon />}
          iconTone="blue"
          hint={t('developer_kpi.overview.base_hint', 'Base: {{amount}}', { amount: formatCurrency(payroll.base) })}
          onOpen={() => onOpenTab('salary_estimates')}
        />
        <StatCard
          label={t('developer_kpi.overview.bonus_pool', 'KPI bonus pool')}
          value={hasEstimates ? formatCurrency(payroll.bonus) : '—'}
          icon={<TrendUpIcon />}
          iconTone="success"
          delta={payroll.maxFund > 0 ? `${Math.round((payroll.bonus / payroll.maxFund) * 100)}%` : undefined}
          hint={t('developer_kpi.overview.max_fund_hint', 'Max fund: {{amount}}', { amount: formatCurrency(payroll.maxFund) })}
        />
        <StatCard
          label={t('developer_kpi.overview.deductions_total', 'Deductions')}
          value={hasEstimates ? (payroll.deductions > 0 ? `-${formatCurrency(payroll.deductions)}` : formatCurrency(0)) : '—'}
          icon={<TrendDownIcon />}
          iconTone={payroll.deductions > 0 ? 'danger' : 'neutral'}
          hint={t('developer_kpi.overview.deductions_hint', 'Approved for this period')}
          onOpen={() => onOpenTab('deductions')}
        />
      </div>

      <div className="flex flex-wrap gap-[18px]">
        <BarChartCard
          className="min-w-0 flex-[1.5_1_520px]"
          title={t('developer_kpi.overview.breakdown', 'KPI components')}
          deltaBadge={hasEstimates ? formatKpi(scores.final) : undefined}
          deltaCaption={t('developer_kpi.overview.breakdown_caption', 'Average score per weighted component')}
          data={scoreBars}
          highlightKey={weakestKey}
          summaryTitle={t('developer_kpi.overview.breakdown_summary', 'Delivery and deadline carry 55% of the final score.')}
          total={hasEstimates ? formatKpi(scores.final) : '—'}
          totalCaption={t('developer_kpi.overview.final_caption', 'final KPI score')}
          emptyState={emptyHint}
        />

        <GaugeDonut
          className="min-w-0 flex-[1_1_360px]"
          title={t('developer_kpi.overview.distribution', 'Score distribution')}
          segments={tiers}
          centerValue={estimates.length}
          centerCaption={t('developer_kpi.overview.tracked_caption', 'tracked employees')}
          emptyState={emptyHint}
        />
      </div>

      <div className="flex flex-wrap gap-[18px]">
        <div className="flex min-w-0 flex-[1.3_1_440px] flex-col gap-4 rounded-[24px] bg-[var(--card)] p-[22px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
              {t('developer_kpi.overview.pipeline', 'Feature pipeline')}
            </span>
            <span className="text-[13px] text-[var(--muted)]">
              {t('developer_kpi.overview.pipeline_total', 'total')}{' '}
              <b className="font-semibold text-[var(--foreground)]">{features.length}</b>
            </span>
          </div>

          <FunnelStages stages={funnelStages} />

          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
            <div className="rounded-[18px] bg-[var(--accent-soft)] p-3.5">
              <p className="ui-card-label">{t('developer_kpi.overview.total_points', 'Total points')}</p>
              <p className="mt-2 text-[17px] font-bold tracking-[-0.02em] tabular-nums text-[var(--foreground)]">{pipeline.points}</p>
            </div>
            <div className="rounded-[18px] bg-[var(--accent-soft)] p-3.5">
              <p className="ui-card-label">{t('developer_kpi.overview.accepted_points', 'Accepted points')}</p>
              <p className="mt-2 text-[17px] font-bold tracking-[-0.02em] tabular-nums text-[var(--success-text)]">{pipeline.acceptedPoints}</p>
            </div>
            <div className="rounded-[18px] bg-[var(--accent-soft)] p-3.5">
              <p className="ui-card-label">{t('developer_kpi.overview.mandatory', 'Mandatory')}</p>
              <p className="mt-2 text-[17px] font-bold tracking-[-0.02em] tabular-nums text-[var(--foreground)]">{pipeline.mandatory}</p>
            </div>
          </div>
        </div>

        <TaskList
          className="min-w-0 flex-[1_1_300px]"
          title={t('developer_kpi.overview.deadlines', 'Upcoming deadlines')}
          tasks={deadlines}
          onSelect={() => onOpenTab('features')}
          action={
            deadlines.length > 0 ? (
              <span className="rounded-full bg-[var(--blue-dim)] px-2.5 py-1 text-xs font-semibold text-[var(--blue-text)]" data-ui-number="true">
                {deadlines.length}
              </span>
            ) : undefined
          }
          emptyState={
            <p className="py-8 text-center text-[13px] text-[var(--muted)]">
              {t('developer_kpi.overview.no_deadlines', 'No feature deadlines ahead.')}
            </p>
          }
        />

        <Leaderboard
          className="min-w-0 flex-[1_1_300px]"
          title={t('developer_kpi.overview.top_owners', 'Top feature owners')}
          badge={monthLabel}
          entries={owners}
          emptyState={
            <p className="py-8 text-center text-[13px] text-[var(--on-inverse-muted)]">
              {t('developer_kpi.overview.no_owners', 'No feature owners for this period.')}
            </p>
          }
        />
      </div>
    </div>
  )
}

export function DeveloperKpiPage() {
  const { user, can } = useAuth()
  const isCeo = canReadManagedProjects(user)
  // RBAC developer_kpi.* only hides actions; `isCeo` still decides the data scope (team vs. self).
  const canCreate = can('developer_kpi', 'create')
  const canEdit = can('developer_kpi', 'edit')

  const [activeTab, setActiveTab] = useState<Tab>('salary_estimates')
  const [year, setYear] = useState(DEFAULT_YEAR)
  const [month, setMonth] = useState(DEFAULT_MONTH)

  const usersQuery = useAsyncData(
    () => isCeo ? ceoService.getDashboard() : Promise.resolve({ users: [] as Array<{ id: number; name: string; surname: string }>, statistics: {} }),
    [isCeo],
    { enabled: isCeo },
  )

  const users = useMemo(
    () => (usersQuery.data?.users ?? []).map((u) => ({ id: u.id, name: u.name, surname: u.surname })),
    [usersQuery.data?.users],
  )

  const projectsQuery = useAsyncData(
    () => projectsService.listProjects().then((r) => r.projects),
    [],
  )
  const projects = projectsQuery.data ?? []

  const overviewEstimatesQuery = useAsyncData<SalaryEstimate[]>(
    () => {
      if (isCeo) {
        return developerKpiService.listSalaryEstimates(year, month)
      }

      if (user?.id != null) {
        return developerKpiService.getSalaryEstimate(user.id, year, month).then((estimate) => [estimate])
      }

      return Promise.resolve([])
    },
    [isCeo, user?.id, year, month],
  )

  const overviewFeaturesQuery = useAsyncData(
    () => developerKpiService.listFeatures({ year, month }),
    [year, month],
  )

  const overviewEstimates = useMemo(
    () => (Array.isArray(overviewEstimatesQuery.data) ? overviewEstimatesQuery.data : []),
    [overviewEstimatesQuery.data],
  )

  const overviewFeatures = useMemo(
    () => (Array.isArray(overviewFeaturesQuery.data) ? overviewFeaturesQuery.data : []),
    [overviewFeaturesQuery.data],
  )

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 3 }, (_, i) => currentYear - 1 + i).map((y) => ({ value: String(y), label: String(y) }))
  }, [])

  const monthOptions = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))

  return (
    <section className="page-enter flex flex-col gap-[18px]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="ui-page-title text-[var(--foreground)]">Developer KPI</h1>
          <p className="text-sm text-[var(--muted)]">KPI scoring · salary estimates · quality tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-32">
            <SelectField value={String(month)} onValueChange={(v) => setMonth(Number(v))} options={monthOptions} className={FILTER_SELECT} />
          </div>
          <div className="w-24">
            <SelectField value={String(year)} onValueChange={(v) => setYear(Number(v))} options={yearOptions} className={FILTER_SELECT} />
          </div>
        </div>
      </div>

      <DeveloperKpiOverview
        estimates={overviewEstimates}
        features={overviewFeatures}
        users={users}
        isCeo={isCeo}
        monthLabel={MONTHS[month - 1]}
        onOpenTab={setActiveTab}
      />

      <Card>
        <div className="grid gap-[18px] sm:grid-cols-2">
          <div className={PANEL}>
            <p className="ui-card-label">KPI Formula </p>
            <p className="mt-2 font-mono text-[12.5px] leading-relaxed text-[var(--foreground)]">Delivery×35% + Deadline×20% + Quality×20% + Team×15% + Discipline×10%</p>
          </div>
          <div className={PANEL}>
            <p className="ui-card-label">Salary </p>
            <p className="mt-2 font-mono text-[12.5px] leading-relaxed text-[var(--foreground)]">Base + Base×15%×KPI/100 − Deductions</p>
          </div>
        </div>
      </Card>

      <div className="custom-scrollbar-visible overflow-x-auto">
        <Tabs
          items={TABS.map((tab) => ({ value: tab, label: TAB_LABELS[tab] }))}
          value={activeTab}
          onChange={setActiveTab}
          ariaLabel="Developer KPI"
          className="min-w-max"
        />
      </div>

      <div>
        {activeTab === 'salary_estimates' && (
          <SalaryEstimatesTab year={year} month={month} users={users} isCeo={isCeo} selfId={user?.id} />
        )}
        {activeTab === 'features' && (
          <FeaturesTab year={year} month={month} users={users} isCeo={isCeo} canCreate={canCreate} canEdit={canEdit} projects={projects} />
        )}
        {activeTab === 'project_delivery' && (
          <ProjectDeliveryTab isCeo={isCeo} canEdit={canEdit} projects={projects} />
        )}
        {activeTab === 'deductions' && (
          <DeductionsTab year={year} month={month} users={users} isCeo={isCeo} canEdit={canEdit} selfId={user?.id} />
        )}
        {activeTab === 'snapshots' && (
          <SnapshotsTab year={year} month={month} users={users} isCeo={isCeo} canCreate={canCreate} />
        )}
        {activeTab === 'quality_events' && (
          <QualityEventsTab year={year} month={month} users={users} isCeo={isCeo} canCreate={canCreate} projects={projects} />
        )}
        {activeTab === 'blocked_periods' && (
          <BlockedPeriodsTab users={users} isCeo={isCeo} canCreate={canCreate} canEdit={canEdit} projects={projects} />
        )}
        {activeTab === 'work_schedules' && (
          <WorkSchedulesTab users={users} isCeo={isCeo} canCreate={canCreate} />
        )}
      </div>
    </section>
  )
}
