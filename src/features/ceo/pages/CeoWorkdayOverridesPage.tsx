import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  updateTrackingService,
  type WorkdayOverrideRecord,
} from '../../../shared/api/services/updateTracking.service'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { formatShortDate, formatShortDateTime, getLocalizedMonthName } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { ActionsMenu } from '../../../shared/ui/actions-menu'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { SelectField } from '../../../shared/ui/select-field'
import { SectionTitle } from '../../../shared/ui/section-title'
import { ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import {
  WorkdayOverrideFormDialog,
  getOverrideTypeLabel,
  getTypeBadgeVariant,
  normalizeDayType,
} from '../components/WorkdayOverrideFormDialog'

const now = new Date()
const lt = translateCurrentLiteral

function getMonthName(month: number): string {
  return getLocalizedMonthName(month)
}

function formatDateTime(value: string) {
  return formatShortDateTime(value)
}

function getOverrideTargetLabel(item: WorkdayOverrideRecord) {
  if (item.target_type === 'all') {
    return lt('All members')
  }

  return item.member_name?.trim() || (item.member_id ? `${lt('Member')} #${item.member_id}` : lt('Specific member'))
}

function SummaryCard({
  label,
  value,
  hint: _hint,
  accent = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  accent?: 'default' | 'warning' | 'blue' | 'success'
}) {
  const accentClassName = {
    default: 'border-[var(--border)] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.76)] dark:border-white/8 dark:bg-white/[0.03] dark:shadow-none',
    warning: 'border-[var(--warning-border)] bg-amber-50/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] dark:border-amber-500/18 dark:bg-amber-500/[0.06] dark:shadow-none',
    blue: 'border-[var(--blue-border)] bg-[var(--blue-soft)] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] dark:border-blue-500/18 dark:bg-blue-500/[0.06] dark:shadow-none',
    success: 'border-[var(--success-border)] bg-emerald-50/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] dark:border-emerald-500/18 dark:bg-emerald-500/[0.06] dark:shadow-none',
  } as const

  const accentLabelClassName = {
    default: 'text-[var(--blue-text)] dark:text-blue-200/82',
    warning: 'text-[var(--warning-text)] dark:text-amber-200/82',
    blue: 'text-[var(--blue-text)] dark:text-blue-200/82',
    success: 'text-[#32a852] dark:text-emerald-200/82',
  } as const

  return (
    <div className={cn('rounded-xl border px-5 py-4', accentClassName[accent])}>
      <p className={cn('text-[10px] font-bold uppercase tracking-[0.22em]', accentLabelClassName[accent])}>{label}</p>
      <p className="mt-3 text-[1.75rem] font-semibold tracking-tight text-[var(--foreground)] dark:text-white">{value}</p>
    </div>
  )
}


export function CeoWorkdayOverridesPage() {
  const { t } = useTranslation()
  const locale = getIntlLocale()
  const tx = (key: string, fallback: string, params?: Record<string, string | number>) => (
    t(key, {
      defaultValue: fallback,
      ...params,
    })
  )
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingOverride, setEditingOverride] = useState<WorkdayOverrideRecord | null>(null)
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => ({
      value: String(index + 1),
      label: getMonthName(index + 1),
    })),
    [locale],
  )

  const overridesQuery = useAsyncData(
    () => updateTrackingService.workdayOverrides({ month, year }),
    [month, year],
  )

  const overrides = useMemo(
    () => [...(overridesQuery.data ?? [])].sort((left, right) => {
      return right.special_date.localeCompare(left.special_date) || left.title.localeCompare(right.title)
    }),
    [overridesQuery.data],
  )

  const holidayCount = overrides.filter((item) => normalizeDayType(item.day_type) === 'holiday').length
  const shortDayCount = overrides.filter((item) => normalizeDayType(item.day_type) === 'short_day').length
  const allMemberCount = overrides.filter((item) => item.target_type === 'all').length
  const specificMemberCount = overrides.length - allMemberCount

  function openCreateDialog() {
    setEditingOverride(null)
    setIsCreateDialogOpen(true)
  }

  function openEditDialog(item: WorkdayOverrideRecord) {
    setEditingOverride(item)
    setIsCreateDialogOpen(false)
  }

  function closeDialog() {
    setEditingOverride(null)
    setIsCreateDialogOpen(false)
  }

  async function handleRefresh() {
    try {
      await overridesQuery.refetch()
      showToast({
        title: lt('Workday overrides refreshed'),
        description: `${lt('Overrides for')} ${getMonthName(month)} ${year} ${lt('reloaded')}.`,
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: lt('Refresh failed'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    }
  }

  async function handleDelete(item: WorkdayOverrideRecord) {
    const approved = await confirm({
      title: lt('Delete workday override?'),
      description: `${item.title} ${lt('on')} ${formatShortDate(item.special_date)} ${lt('will be permanently removed.')}`,
      tone: 'danger',
      confirmLabel: lt('Delete override'),
    })

    if (!approved) {
      return
    }

    try {
      await updateTrackingService.deleteWorkdayOverride(item.id)
      await overridesQuery.refetch()
      showToast({
        title: lt('Override deleted'),
        description: `${item.title} ${lt('removed successfully.')}`,
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: 'Delete failed',
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    }
  }

  if (overridesQuery.isLoading && !overridesQuery.data) {
    return (
      <LoadingStateBlock
        eyebrow={tx('ceo.workday.header.eyebrow', 'CEO Workspace')}
        title={tx('ceo.workday.states.loading_title', 'Loading workday overrides')}
        description={tx('ceo.workday.states.loading_description', 'Fetching holiday and short-day settings for the selected period.')}
      />
    )
  }

  if (overridesQuery.isError && !overridesQuery.data) {
    return (
      <ErrorStateBlock
        eyebrow={tx('ceo.workday.header.eyebrow', 'CEO Workspace')}
        title={tx('ceo.workday.states.error_title', 'Overrides unavailable')}
        description={tx('ceo.workday.states.error_description', 'Could not load holiday and short-day overrides.')}
        actionLabel={t('common.retry')}
        onAction={() => void overridesQuery.refetch()}
      />
    )
  }

  return (
    <section className="space-y-4 page-enter">
      <Card variant="glass" noPadding className="overflow-hidden rounded-xl border-[var(--border)]">
        <div className="relative overflow-hidden px-6 py-6 sm:px-8 sm:py-7">
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--blue-text)]">
                {tx('ceo.workday.header.eyebrow', 'CEO Workspace')}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-[1.75rem]">
                {tx('ceo.workday.header.title', 'Workday Overrides')}
              </h1>
              <p className="mt-1.5 text-[13px] text-(--muted-strong)">
                {tx('ceo.workday.header.description', 'Configure holidays and short working days that affect update expectations.')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-(--muted)">{tx('common.year', 'Year')}</Label>
                <Input
                  type="number"
                  min="2020"
                  max="2035"
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value) || now.getFullYear())}
                  className="min-h-0 h-6 w-18 border-transparent bg-transparent px-2.5 text-sm text-[var(--foreground)]"
                />
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-(--muted)">{tx('common.month', 'Month')}</Label>
                <SelectField
                  value={String(month)}
                  options={monthOptions}
                  onValueChange={(value) => setMonth(Number(value))}
                  className="min-h-0 h-9 min-w-28 border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)]"
                />
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleRefresh()}
                className="min-h-9 rounded-xl"
              >
                {t('common.refresh')}
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={openCreateDialog}
                className="min-h-9 rounded-xl"
              >
                {tx('ceo.workday.actions.create', 'Create Override')}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label={tx('ceo.workday.summary.in_period', 'Overrides in period')}
          value={overrides.length}
          hint={`${getMonthName(month)} ${year}`}
        />
        <SummaryCard
          label={tx('ceo.workday.summary.holidays', 'Holiday entries')}
          value={holidayCount}
          hint={tx('ceo.workday.summary.holidays_hint', 'Full day off or no update expected.')}
          accent="warning"
        />
        <SummaryCard
          label={tx('ceo.workday.summary.short_days', 'Short day entries')}
          value={shortDayCount}
          hint={tx('ceo.workday.summary.short_days_hint', 'Reduced working hours or shortened day.')}
          accent="blue"
        />
        <SummaryCard
          label={tx('ceo.workday.summary.targeting', 'Targeting')}
          value={tx('ceo.workday.summary.targeting_value', '{{all}} all / {{specific}} specific', {
            all: allMemberCount,
            specific: specificMemberCount,
          })}
          hint={tx('ceo.workday.summary.targeting_hint', 'How many overrides apply to all members versus selected members.')}
          accent="success"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
        <Card variant="glass" className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <SectionTitle
              title={tx('ceo.workday.list.title', 'Overrides for {{month}} {{year}}', { month: getMonthName(month), year })}
              description={tx('ceo.workday.list.description', 'Each entry changes how update tracking treats a specific date.')}
            />
            <Badge variant="blue">{tx('ceo.workday.list.items', '{{count}} items', { count: overrides.length })}</Badge>
          </div>

          {overrides.length > 0 ? (
            <div className="space-y-3">
              {overrides.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/8 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold tracking-tight text-[var(--foreground)]">
                          {item.title}
                        </h3>
                        <Badge variant={getTypeBadgeVariant(item.day_type)}>
                          {getOverrideTypeLabel(item.day_type)}
                        </Badge>
                        <Badge variant={item.target_type === 'all' ? 'secondary' : 'outline'}>
                          {getOverrideTargetLabel(item)}
                        </Badge>
                        <Badge variant={item.update_required ? 'success' : 'warning'}>
                          {item.update_required ? lt('Update required') : lt('No update required')}
                        </Badge>
                        {item.workday_hours ? (
                          <Badge variant="blue">{item.workday_hours}h</Badge>
                        ) : null}
                      </div>

                      <p className="mt-2 text-sm text-[var(--muted-strong)]">
                        {formatShortDate(item.special_date)}
                      </p>

                      {item.note?.trim() ? (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]/80">
                          {item.note}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm text-[var(--muted)]">
                          {tx('ceo.workday.list.no_note', 'No note provided for this override.')}
                        </p>
                      )}
                    </div>

                    <ActionsMenu
                      label={`${tx('ceo.workday.actions.actions_for', 'Actions for')} ${item.title}`}
                      items={[
                        { label: tx('ceo.workday.actions.edit', 'Edit Override'), onSelect: () => openEditDialog(item) },
                        { label: tx('ceo.workday.actions.delete', 'Delete Override'), onSelect: () => void handleDelete(item), tone: 'danger' },
                      ]}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
                    <span>{tx('common.created', 'Created')}: {formatDateTime(item.created_at)}</span>
                    <span className="opacity-35">|</span>
                    <span>{tx('common.updated', 'Updated')}: {formatDateTime(item.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-8 text-center">
              <p className="text-base font-semibold text-[var(--foreground)]">
                {tx('ceo.workday.empty.title', 'No overrides yet for {{month}} {{year}}', { month: getMonthName(month), year })}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {tx('ceo.workday.empty.description', 'Create a holiday or short-day rule so calendars stop treating those dates as missing workdays.')}
              </p>
              <Button variant="success" size="sm" className="mt-5 rounded-xl" onClick={openCreateDialog}>
                {tx('ceo.workday.empty.action', 'Create First Override')}
              </Button>
            </div>
          )}
        </Card>

        <Card variant="glass" className="p-5">
          <div className="space-y-4">
            <SectionTitle
              title={tx('ceo.workday.guide.title', 'How It Works')}
              description={tx('ceo.workday.guide.description', 'Use these rules to control whether updates are expected on a date.')}
            />

            <div className="rounded-xl border border-[var(--warning-border)] bg-amber-50/90 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-amber-500/18 dark:bg-amber-500/[0.06] dark:shadow-none">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--warning-text)] dark:text-amber-200/82">{lt('Holiday')}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--foreground)]/80">
                {tx('ceo.workday.guide.holiday_description', 'Mark a date as a holiday when no update should be expected. Calendars should treat it as an off day instead of a missing day.')}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--blue-border)] bg-[var(--blue-soft)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-blue-500/18 dark:bg-blue-500/[0.06] dark:shadow-none">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--blue-text)] dark:text-blue-200/82">{lt('Short Day')}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--foreground)]/80">
                {tx('ceo.workday.guide.short_day_description', 'Use a short day when working hours change. You can still require updates or turn them off for that shortened date.')}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--blue-border)] bg-white px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-[var(--surface-elevated)] dark:shadow-none">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--blue-text)] dark:text-blue-200/82">{tx('ceo.workday.guide.member_targeting_title', 'Member Targeting')}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--foreground)]/78">
                {tx('ceo.workday.guide.member_targeting_description', 'Choose all members for company-wide holidays, or select one or more members when the override is specific to a subset of the team.')}
              </p>
            </div>

          </div>
        </Card>
      </div>

      <WorkdayOverrideFormDialog
        open={isCreateDialogOpen || editingOverride !== null}
        onClose={closeDialog}
        editingOverride={editingOverride}
        onSuccess={() => void overridesQuery.refetch()}
        defaultMonth={month}
        defaultYear={year}
      />
    </section>
  )
}
