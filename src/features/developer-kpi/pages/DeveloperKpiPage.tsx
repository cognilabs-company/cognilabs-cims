import { useMemo, useState } from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
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
import { Card } from '../../../shared/ui/card'
import { Dialog } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { SelectField } from '../../../shared/ui/select-field'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { Textarea } from '../../../shared/ui/textarea'

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

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatKpi(score: number) {
  return `${score.toFixed(1)}%`
}

function KpiBadge({ score }: { score: number }) {
  const variant = score >= 90 ? 'success' : score >= 70 ? 'blue' : score >= 50 ? 'warning' : 'danger'
  return <Badge variant={variant}>{formatKpi(score)}</Badge>
}

function KpiBar({ label, score, weight }: { label: string; score: number; weight: string }) {
  const pct = Math.max(0, Math.min(100, score))
  const color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#3b82f6' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-(--muted)">{label} <span className="text-(--caption)">({weight})</span></span>
        <span className="font-semibold" style={{ color }}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-(--accent-soft) overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function FeatureStatusBadge({ status }: { status: FeatureStatus | string }) {
  const map: Record<string, { label: string; variant: 'outline' | 'blue' | 'success' | 'warning' | 'danger' }> = {
    planned: { label: 'Planned', variant: 'outline' },
    in_progress: { label: 'In Progress', variant: 'blue' },
    completed: { label: 'Completed', variant: 'warning' },
    accepted: { label: 'Accepted', variant: 'success' },
  }
  const cfg = map[status] ?? { label: status, variant: 'outline' }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

function SeverityBadge({ severity }: { severity: string }) {
  const danger = ['critical_prod_incident', 'critical', 'major_prod_bug'].includes(severity)
  const warning = ['major', 'major_qa_reopen', 'prod_bug'].includes(severity)
  const label = QUALITY_SEVERITY_OPTIONS.find((o) => o.value === severity)?.label ?? severity
  return <Badge variant={danger ? 'danger' : warning ? 'warning' : 'outline'}>{label}</Badge>
}

// ─── SalaryEstimatesTab ──────────────────────────────────────────────────────

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {(isCeo || users.length > 0) && (
          <div className="w-52">
            <SelectField
              value={selectedUserId != null ? String(selectedUserId) : ''}
              onValueChange={(v) => setSelectedUserId(v ? Number(v) : null)}
              options={userOptions}
            />
          </div>
        )}
      </div>

      {/* Single employee detail */}
      {selectedUserId != null && (
        <div className="space-y-4">
          {singleQuery.isLoading && <LoadingStateBlock eyebrow="KPI" title="Loading estimate..." />}
          {singleQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(singleQuery.error)} />}
          {estimate && (
            <div className="space-y-4">
              {/* Salary summary */}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  { label: 'Base Salary', value: formatCurrency(estimate.salary.base_salary), tone: 'default' },
                  { label: 'KPI Bonus', value: formatCurrency(estimate.salary.kpi_bonus), tone: 'success' },
                  { label: 'Max KPI Fund', value: formatCurrency(estimate.salary.max_kpi_fund), tone: 'default' },
                  { label: 'Deductions', value: `-${formatCurrency(estimate.salary.approved_deductions)}`, tone: estimate.salary.approved_deductions > 0 ? 'danger' : 'default' },
                  { label: 'Expected Salary', value: formatCurrency(estimate.salary.expected_salary), tone: 'primary' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      'rounded-xl border p-4 space-y-1',
                      item.tone === 'primary' ? 'border-(--blue-border) bg-(--blue-soft)' :
                      item.tone === 'success' ? 'border-emerald-500/20 bg-emerald-500/8' :
                      item.tone === 'danger' ? 'border-rose-500/20 bg-rose-500/8' :
                      'border-(--border) bg-(--surface-elevated)',
                    )}
                  >
                    <p className={cn('text-[10px] font-bold uppercase tracking-widest',
                      item.tone === 'primary' ? 'text-(--blue-text)' :
                      item.tone === 'success' ? 'text-emerald-400' :
                      item.tone === 'danger' ? 'text-rose-400' :
                      'text-(--muted)'
                    )}>
                      {item.label}
                    </p>
                    <p className={cn('text-xl font-semibold tracking-tight',
                      item.tone === 'primary' ? 'text-(--blue-text)' :
                      item.tone === 'success' ? 'text-emerald-400' :
                      item.tone === 'danger' ? 'text-rose-400' :
                      'text-(--foreground)'
                    )}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* KPI breakdown */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-(--foreground)">KPI Breakdown</h3>
                  <KpiBadge score={estimate.scores.final_kpi} />
                </div>
                <div className="space-y-3">
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

      {/* All employees table (CEO view) */}
      {isCeo && selectedUserId == null && (
        <div>
          {(estimatesQuery.isLoading || estimatesQuery.isIdle) && <LoadingStateBlock eyebrow="KPI" title="Loading estimates..." />}
          {estimatesQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(estimatesQuery.error)} />}
          {estimatesQuery.isSuccess && list.length === 0 && <EmptyStateBlock eyebrow="Empty" title="No salary estimates for this period." />}
          {estimatesQuery.isSuccess && list.length > 0 && (
            <Card noPadding className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-(--border) text-left">
                      {['Employee', 'Final KPI', 'Base', 'KPI Bonus', 'Deductions', 'Expected', 'Delivery', 'Deadline', 'Quality', 'Team', 'Discipline'].map((h) => (
                        <th key={h} className="px-4 py-3 text-[11px] font-semibold text-(--muted) uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((est, i) => {
                      const userId = est.employee_id ?? i
                      const user = users.find((u) => u.id === userId)
                      const name = est.employee_name ?? (user ? `${user.name} ${user.surname}` : `#${userId}`)
                      return (
                        <tr
                          key={userId}
                          className="border-b border-(--border) hover:bg-(--surface) transition-colors cursor-pointer"
                          onClick={() => setSelectedUserId(userId)}
                        >
                          <td className="px-4 py-3 font-medium text-(--foreground) whitespace-nowrap">{name}</td>
                          <td className="px-4 py-3"><KpiBadge score={est.scores.final_kpi} /></td>
                          <td className="px-4 py-3 text-(--muted)">{formatCurrency(est.salary.base_salary)}</td>
                          <td className="px-4 py-3 text-emerald-400 font-medium">+{formatCurrency(est.salary.kpi_bonus)}</td>
                          <td className="px-4 py-3 text-rose-400">{est.salary.approved_deductions > 0 ? `-${formatCurrency(est.salary.approved_deductions)}` : '—'}</td>
                          <td className="px-4 py-3 font-semibold text-(--foreground)">{formatCurrency(est.salary.expected_salary)}</td>
                          <td className="px-4 py-3 text-(--muted)">{formatKpi(est.scores.delivery)}</td>
                          <td className="px-4 py-3 text-(--muted)">{formatKpi(est.scores.deadline)}</td>
                          <td className="px-4 py-3 text-(--muted)">{formatKpi(est.scores.quality)}</td>
                          <td className="px-4 py-3 text-(--muted)">{formatKpi(est.scores.team)}</td>
                          <td className="px-4 py-3 text-(--muted)">{formatKpi(est.scores.discipline)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ─── FeaturesTab ─────────────────────────────────────────────────────────────

function FeaturesTab({
  year,
  month,
  users,
  isCeo,
  projects,
}: {
  year: number
  month: number
  users: Array<{ id: number; name: string; surname: string }>
  isCeo: boolean
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-48">
          <SelectField value={ownerFilter} onValueChange={setOwnerFilter} options={userOptions} />
        </div>
        {isCeo && (
          <Button onClick={() => setShowCreate(true)}>+ New Feature</Button>
        )}
        <Button variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</Button>
      </div>

      {featuresQuery.isLoading && <LoadingStateBlock eyebrow="Features" title="Loading features..." />}
      {featuresQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(featuresQuery.error)} />}
      {!featuresQuery.isLoading && features.length === 0 && <EmptyStateBlock eyebrow="Empty" title="No features for this period." />}

      {features.length > 0 && (
        <Card noPadding className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--border) text-left">
                  {['Title', 'Points', 'Owner', 'Status', 'Due Date', 'FE%', 'BE%', 'Locked', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-(--muted) uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((f) => {
                  const owner = users.find((u) => u.id === f.owner_id)
                  return (
                    <tr key={f.id} className="border-b border-(--border) hover:bg-(--surface) transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-(--foreground) max-w-48 truncate">{f.title}</div>
                        {f.is_mandatory && <span className="text-[10px] text-amber-400 font-semibold">Mandatory</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-(--accent-soft) text-xs font-bold text-(--foreground)">{f.points}</span>
                      </td>
                      <td className="px-4 py-3 text-(--muted) whitespace-nowrap">{owner ? `${owner.name} ${owner.surname}` : `#${f.owner_id}`}</td>
                      <td className="px-4 py-3"><FeatureStatusBadge status={f.status} /></td>
                      <td className="px-4 py-3 text-(--muted) whitespace-nowrap">{f.due_date ?? '—'}</td>
                      <td className="px-4 py-3 text-(--muted)">{f.frontend_percent}%</td>
                      <td className="px-4 py-3 text-(--muted)">{f.backend_percent}%</td>
                      <td className="px-4 py-3">
                        {f.is_locked
                          ? <Badge variant="warning">Locked</Badge>
                          : <span className="text-(--muted) text-xs">No</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isCeo && f.status !== 'accepted' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleAccept(f)}
                            disabled={acceptingId === f.id}
                          >
                            {acceptingId === f.id ? '...' : 'Accept'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create feature dialog */}
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
              <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
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
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_mandatory} onChange={(e) => setForm((f) => ({ ...f, is_mandatory: e.target.checked }))} />
              <span className="text-(--foreground)">Mandatory</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.lock_now} onChange={(e) => setForm((f) => ({ ...f, lock_now: e.target.checked }))} />
              <span className="text-(--foreground)">Lock immediately</span>
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

// ─── DeductionsTab ───────────────────────────────────────────────────────────

function DeductionsTab({
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
    <div className="space-y-4">
      {isCeo && (
        <div className="flex items-center gap-3">
          <div className="w-48">
            <SelectField value={employeeFilter} onValueChange={setEmployeeFilter} options={userOptions} />
          </div>
          <Button variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</Button>
        </div>
      )}

      {deductionsQuery.isLoading && <LoadingStateBlock eyebrow="Deductions" title="Loading deductions..." />}
      {deductionsQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(deductionsQuery.error)} />}
      {!deductionsQuery.isLoading && deductions.length === 0 && <EmptyStateBlock eyebrow="Empty" title="No deductions for this period." />}

      {deductions.length > 0 && (
        <Card noPadding className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--border) text-left">
                  {['Employee', 'Type', 'Amount', 'Reason', 'Status', ...(isCeo ? ['Actions'] : [])].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-(--muted) uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deductions.map((d) => {
                  const user = users.find((u) => u.id === d.employee_id)
                  const name = user ? `${user.name} ${user.surname}` : `#${d.employee_id}`
                  return (
                    <tr key={d.id} className="border-b border-(--border) hover:bg-(--surface) transition-colors">
                      <td className="px-4 py-3 font-medium text-(--foreground) whitespace-nowrap">{name}</td>
                      <td className="px-4 py-3 text-(--muted)">{d.type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 font-semibold text-rose-400">-{formatCurrency(d.amount)}</td>
                      <td className="px-4 py-3 text-(--muted) max-w-48 truncate">{d.reason ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={d.status === 'approved' ? 'success' : d.status === 'rejected' ? 'danger' : 'warning'}>
                          {d.status}
                        </Badge>
                      </td>
                      {isCeo && (
                        <td className="px-4 py-3">
                          {d.status === 'pending' && (
                            <div className="flex gap-1.5">
                              <Button size="sm" onClick={() => void handleApprove(d, 'approved')}>Approve</Button>
                              <Button size="sm" variant="secondary" onClick={() => void handleApprove(d, 'rejected')}>Reject</Button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── SnapshotsTab ─────────────────────────────────────────────────────────────

function SnapshotsTab({
  year,
  month,
  users,
  isCeo,
}: {
  year: number
  month: number
  users: Array<{ id: number; name: string; surname: string }>
  isCeo: boolean
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
    <div className="space-y-4">
      {isCeo && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-48">
            <SelectField value={freezeUserId} onValueChange={setFreezeUserId} options={userOptions} />
          </div>
          <Button onClick={() => void handleFreeze()}>
            Freeze Snapshot
          </Button>
          <Button variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</Button>
          <span className="text-xs text-(--muted)">Auto-freeze: last day of month at 23:55</span>
        </div>
      )}

      {snapshotsQuery.isLoading && <LoadingStateBlock eyebrow="Snapshots" title="Loading snapshots..." />}
      {snapshotsQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(snapshotsQuery.error)} />}
      {!snapshotsQuery.isLoading && snapshots.length === 0 && <EmptyStateBlock eyebrow="Empty" title="No frozen snapshots for this period." />}

      {snapshots.length > 0 && (
        <Card noPadding className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--border) text-left">
                  {['Employee', 'Final KPI', 'Base', 'KPI Bonus', 'Deductions', 'Expected', 'Frozen At'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-(--muted) uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => {
                  const user = users.find((u) => u.id === s.employee_id)
                  const name = user ? `${user.name} ${user.surname}` : `#${s.employee_id}`
                  return (
                    <tr key={s.id} className="border-b border-(--border) hover:bg-(--surface) transition-colors">
                      <td className="px-4 py-3 font-medium text-(--foreground) whitespace-nowrap">{name}</td>
                      <td className="px-4 py-3"><KpiBadge score={s.final_kpi} /></td>
                      <td className="px-4 py-3 text-(--muted)">{formatCurrency(s.base_salary)}</td>
                      <td className="px-4 py-3 text-emerald-400">+{formatCurrency(s.kpi_bonus)}</td>
                      <td className="px-4 py-3 text-rose-400">{s.approved_deductions > 0 ? `-${formatCurrency(s.approved_deductions)}` : '—'}</td>
                      <td className="px-4 py-3 font-semibold text-(--foreground)">{formatCurrency(s.expected_salary)}</td>
                      <td className="px-4 py-3 text-(--muted) text-xs whitespace-nowrap">{new Date(s.frozen_at).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── QualityEventsTab ─────────────────────────────────────────────────────────

function QualityEventsTab({
  year,
  month,
  users,
  isCeo,
  projects,
}: {
  year: number
  month: number
  users: Array<{ id: number; name: string; surname: string }>
  isCeo: boolean
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-48">
          <SelectField value={employeeFilter} onValueChange={setEmployeeFilter} options={userOptions} />
        </div>
        {isCeo && <Button onClick={() => setShowCreate(true)}>+ New Event</Button>}
        <Button variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</Button>
      </div>

      {eventsQuery.isLoading && <LoadingStateBlock eyebrow="Quality" title="Loading quality events..." />}
      {eventsQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(eventsQuery.error)} />}
      {!eventsQuery.isLoading && events.length === 0 && <EmptyStateBlock eyebrow="Empty" title="No quality events for this period." />}

      {events.length > 0 && (
        <Card noPadding className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--border) text-left">
                  {['Title', 'Employee', 'Severity', 'Source', 'Date', 'Confirmed', 'Duplicate', 'External'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-(--muted) uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const user = users.find((u) => u.id === ev.employee_id)
                  const name = user ? `${user.name} ${user.surname}` : `#${ev.employee_id}`
                  return (
                    <tr key={ev.id} className="border-b border-(--border) hover:bg-(--surface) transition-colors">
                      <td className="px-4 py-3 font-medium text-(--foreground) max-w-48 truncate">{ev.title}</td>
                      <td className="px-4 py-3 text-(--muted) whitespace-nowrap">{name}</td>
                      <td className="px-4 py-3"><SeverityBadge severity={ev.severity} /></td>
                      <td className="px-4 py-3"><Badge variant={ev.source === 'automatic' ? 'warning' : 'outline'}>{ev.source}</Badge></td>
                      <td className="px-4 py-3 text-(--muted) whitespace-nowrap">{ev.event_date}</td>
                      <td className="px-4 py-3">{ev.confirmed ? <Badge variant="success">Yes</Badge> : <Badge variant="outline">No</Badge>}</td>
                      <td className="px-4 py-3">{ev.is_duplicate ? <Badge variant="warning">Yes</Badge> : '—'}</td>
                      <td className="px-4 py-3">{ev.external_cause ? <Badge variant="blue">Yes</Badge> : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
              <Label>Feature ID <span className="text-(--muted)">(optional)</span></Label>
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
            <Input type="date" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} required />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.confirmed} onChange={(e) => setForm((f) => ({ ...f, confirmed: e.target.checked }))} />
              <span>Confirmed</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.external_cause} onChange={(e) => setForm((f) => ({ ...f, external_cause: e.target.checked }))} />
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

// ─── BlockedPeriodsTab ────────────────────────────────────────────────────────

function BlockedPeriodsTab({
  users,
  isCeo,
  projects,
}: {
  users: Array<{ id: number; name: string; surname: string }>
  isCeo: boolean
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-48">
          <SelectField value={employeeFilter} onValueChange={setEmployeeFilter} options={userOptions} />
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Period</Button>
        <Button variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</Button>
      </div>

      {periodsQuery.isLoading && <LoadingStateBlock eyebrow="Blocked Periods" title="Loading blocked periods..." />}
      {periodsQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(periodsQuery.error)} />}
      {!periodsQuery.isLoading && periods.length === 0 && <EmptyStateBlock eyebrow="Empty" title="No blocked periods." />}

      {periods.length > 0 && (
        <Card noPadding className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--border) text-left">
                  {['Employee', 'Reason', 'Started', 'Ended', 'Dependency', 'External', 'Status', ...(isCeo ? ['Actions'] : [])].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-(--muted) uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => {
                  const user = users.find((u) => u.id === p.employee_id)
                  const name = user ? `${user.name} ${user.surname}` : `#${p.employee_id}`
                  return (
                    <tr key={p.id} className="border-b border-(--border) hover:bg-(--surface) transition-colors">
                      <td className="px-4 py-3 font-medium text-(--foreground) whitespace-nowrap">{name}</td>
                      <td className="px-4 py-3 text-(--muted) max-w-40 truncate">{p.reason}</td>
                      <td className="px-4 py-3 text-(--muted) whitespace-nowrap">{new Date(p.started_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-(--muted) whitespace-nowrap">{p.ended_at ? new Date(p.ended_at).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-(--muted)">{p.dependency ?? '—'}</td>
                      <td className="px-4 py-3">{p.is_external ? <Badge variant="blue">External</Badge> : '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.approval_status === 'approved' ? 'success' : p.approval_status === 'rejected' ? 'danger' : 'warning'}>
                          {p.approval_status}
                        </Badge>
                      </td>
                      {isCeo && (
                        <td className="px-4 py-3">
                          {p.approval_status === 'pending' && (
                            <div className="flex gap-1.5">
                              <Button size="sm" onClick={() => void handleApprove(p.id, 'approved')}>Approve</Button>
                              <Button size="sm" variant="secondary" onClick={() => void handleApprove(p.id, 'rejected')}>Reject</Button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
              <Label>Feature ID <span className="text-(--muted)">(optional)</span></Label>
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
              <Input type="datetime-local" value={form.started_at} onChange={(e) => setForm((f) => ({ ...f, started_at: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Ended At <span className="text-(--muted)">(optional)</span></Label>
              <Input type="datetime-local" value={form.ended_at} onChange={(e) => setForm((f) => ({ ...f, ended_at: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Dependency</Label>
            <Input value={form.dependency} onChange={(e) => setForm((f) => ({ ...f, dependency: e.target.value }))} placeholder="Client, Third-party, etc." />
          </div>
          <div className="space-y-1.5">
            <Label>Evidence URL <span className="text-(--muted)">(optional)</span></Label>
            <Input type="url" value={form.evidence_url} onChange={(e) => setForm((f) => ({ ...f, evidence_url: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_external} onChange={(e) => setForm((f) => ({ ...f, is_external: e.target.checked }))} />
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

// ─── WorkSchedulesTab ─────────────────────────────────────────────────────────

function WorkSchedulesTab({
  users,
  isCeo,
}: {
  users: Array<{ id: number; name: string; surname: string }>
  isCeo: boolean
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-48">
          <SelectField value={userFilter} onValueChange={setUserFilter} options={userOptions} />
        </div>
        {isCeo && <Button onClick={() => setShowCreate(true)}>+ New Schedule</Button>}
        <Button variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</Button>
      </div>

      {schedulesQuery.isLoading && <LoadingStateBlock eyebrow="Schedules" title="Loading work schedules..." />}
      {schedulesQuery.isError && <ErrorStateBlock eyebrow="Error" title={getApiErrorMessage(schedulesQuery.error)} />}
      {!schedulesQuery.isLoading && schedules.length === 0 && <EmptyStateBlock eyebrow="Empty" title="No work schedules." />}

      {schedules.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {schedules.map((s) => {
            const user = users.find((u) => u.id === s.user_id)
            const name = user ? `${user.name} ${user.surname}` : `User #${s.user_id}`
            return (
              <Card key={s.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-(--foreground) text-sm">{name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{WEEKDAY_LABELS[s.weekday] ?? `Day ${s.weekday}`}</Badge>
                    {s.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Inactive</Badge>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-(--muted)">Work: </span>
                    <span className="text-(--foreground) font-medium">{s.work_start_time} – {s.work_end_time}</span>
                  </div>
                  {s.free_start_time && s.free_end_time && (
                    <div>
                      <span className="text-(--muted)">Break: </span>
                      <span className="text-(--foreground) font-medium">{s.free_start_time} – {s.free_end_time}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-(--muted)">Grace: </span>
                    <span className="text-(--foreground) font-medium">{s.late_grace_minutes} min</span>
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
              <Input type="time" step="1" value={form.work_start_time} onChange={(e) => setForm((f) => ({ ...f, work_start_time: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Work End</Label>
              <Input type="time" step="1" value={form.work_end_time} onChange={(e) => setForm((f) => ({ ...f, work_end_time: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Break Start <span className="text-(--muted)">(optional)</span></Label>
              <Input type="time" step="1" value={form.free_start_time} onChange={(e) => setForm((f) => ({ ...f, free_start_time: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Break End <span className="text-(--muted)">(optional)</span></Label>
              <Input type="time" step="1" value={form.free_end_time} onChange={(e) => setForm((f) => ({ ...f, free_end_time: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Grace minutes (late)</Label>
            <Input type="number" min="0" max="60" value={form.late_grace_minutes} onChange={(e) => setForm((f) => ({ ...f, late_grace_minutes: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
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

// ─── ProjectDeliveryTab ───────────────────────────────────────────────────────

type DeliveryStatus = 'in_progress' | 'delivered' | 'delayed' | 'cancelled'

const DELIVERY_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function ProjectDeliveryTab({ isCeo, projects }: { isCeo: boolean; projects: Array<{ id: number; project_name: string }> }) {
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
    <div className="space-y-5 max-w-xl">
      <p className="text-sm text-(--muted)">
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
          <Input
            type="date"
            value={form.actual_delivery_date}
            onChange={(e) => setForm((f) => ({ ...f, actual_delivery_date: e.target.value }))}
          />
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
          <p className="text-xs text-(--muted)">Approved external blocked business days removed from delay calculation.</p>
        </div>
        {isCeo && (
          <Button type="submit" disabled={saving || !projectId}>
            {saving ? 'Saving...' : 'Update Delivery'}
          </Button>
        )}
      </form>

      {result && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-(--foreground)">Result</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-(--muted) text-xs uppercase tracking-wide font-semibold">Delivery Date</p>
              <p className="text-(--foreground) font-medium mt-0.5">{result.actual_delivery_date ?? '—'}</p>
            </div>
            <div>
              <p className="text-(--muted) text-xs uppercase tracking-wide font-semibold">Status</p>
              <p className="text-(--foreground) font-medium mt-0.5">{result.delivery_status ?? '—'}</p>
            </div>
            <div>
              <p className="text-(--muted) text-xs uppercase tracking-wide font-semibold">Approved Blocked Days</p>
              <p className="text-(--foreground) font-medium mt-0.5">{result.approved_blocked_days}</p>
            </div>
            <div>
              <p className="text-(--muted) text-xs uppercase tracking-wide font-semibold">Real Delay Days</p>
              <p className={cn('font-semibold mt-0.5', result.real_delay_days > 3 ? 'text-rose-400' : 'text-emerald-400')}>
                {result.real_delay_days} {result.real_delay_days > 3 && '⚠ deduction candidate'}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function DeveloperKpiPage() {
  const { user } = useAuth()
  const isCeo = canReadManagedProjects(user)

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

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 3 }, (_, i) => currentYear - 1 + i).map((y) => ({ value: String(y), label: String(y) }))
  }, [])

  const monthOptions = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))

  const tabsWithPeriod: Tab[] = ['salary_estimates', 'features', 'deductions', 'snapshots', 'quality_events', 'blocked_periods']

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-(--foreground)">Developer KPI</h1>
          <p className="mt-0.5 text-sm text-(--muted)">
            KPI scoring · salary estimates · quality tracking
          </p>
        </div>

        {/* Period picker */}
        {tabsWithPeriod.includes(activeTab) && (
          <div className="flex items-center gap-2">
            <div className="w-28">
              <SelectField value={String(month)} onValueChange={(v) => setMonth(Number(v))} options={monthOptions} />
            </div>
            <div className="w-24">
              <SelectField value={String(year)} onValueChange={(v) => setYear(Number(v))} options={yearOptions} />
            </div>
          </div>
        )}
      </div>

      {/* Formula card */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-6 text-xs">
          <div>
            <span className="text-(--muted) uppercase tracking-wider font-semibold">KPI Formula </span>
            <span className="text-(--foreground) font-mono">Delivery×35% + Deadline×20% + Quality×20% + Team×15% + Discipline×10%</span>
          </div>
          <div>
            <span className="text-(--muted) uppercase tracking-wider font-semibold">Salary </span>
            <span className="text-(--foreground) font-mono">Base + Base×15%×KPI/100 − Deductions</span>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-(--border)">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab
                ? 'border-(--blue-border) text-(--blue-text)'
                : 'border-transparent text-(--muted) hover:text-(--foreground)',
            )}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'salary_estimates' && (
          <SalaryEstimatesTab year={year} month={month} users={users} isCeo={isCeo} selfId={user?.id} />
        )}
        {activeTab === 'features' && (
          <FeaturesTab year={year} month={month} users={users} isCeo={isCeo} projects={projects} />
        )}
        {activeTab === 'project_delivery' && (
          <ProjectDeliveryTab isCeo={isCeo} projects={projects} />
        )}
        {activeTab === 'deductions' && (
          <DeductionsTab year={year} month={month} users={users} isCeo={isCeo} selfId={user?.id} />
        )}
        {activeTab === 'snapshots' && (
          <SnapshotsTab year={year} month={month} users={users} isCeo={isCeo} />
        )}
        {activeTab === 'quality_events' && (
          <QualityEventsTab year={year} month={month} users={users} isCeo={isCeo} projects={projects} />
        )}
        {activeTab === 'blocked_periods' && (
          <BlockedPeriodsTab users={users} isCeo={isCeo} projects={projects} />
        )}
        {activeTab === 'work_schedules' && (
          <WorkSchedulesTab users={users} isCeo={isCeo} />
        )}
      </div>
    </div>
  )
}
