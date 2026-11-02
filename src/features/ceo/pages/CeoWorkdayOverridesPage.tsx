import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  updateTrackingService,
  type WorkdayOverrideRecord,
} from '../../../shared/api/services/updateTracking.service'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { formatShortDate, formatShortDateTime, getLocalizedMonthName } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { ActionsMenu } from '../../../shared/ui/actions-menu'
import { Alert } from '../../../shared/ui/alert'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { PageHeader } from '../../../shared/ui/page-header'
import { SelectField } from '../../../shared/ui/select-field'
import { SectionTitle } from '../../../shared/ui/section-title'
import { StatCard } from '../../../shared/ui/stat-card'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import type { Tone } from '../../../shared/ui/tone'
import { WorkdayOverrideFormDialog } from '../components/WorkdayOverrideFormDialog'
import {
  getOverrideTypeLabel,
  getTypeBadgeVariant,
  normalizeDayType,
} from '../lib/workdayOverride'

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

type SummaryAccent = 'default' | 'warning' | 'blue' | 'success'

const summaryIconTone: Record<SummaryAccent, Tone> = {
  default: 'blue',
  warning: 'warning',
  blue: 'blue',
  success: 'success',
}

const summaryIcons: Record<SummaryAccent, ReactNode> = {
  default: (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3.5" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
    </svg>
  ),
  blue: (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.3l3.4 2" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9.2" cy="8.4" r="3.4" />
      <path d="M3 19.4c0-3.1 2.8-4.7 6.2-4.7s6.2 1.6 6.2 4.7" />
      <path d="M16.4 6.1a3.2 3.2 0 0 1 0 5.9M21 19.4c0-2-1.2-3.3-3.3-3.9" />
    </svg>
  ),
}

function SummaryCard({
  label,
  value,
  hint,
  accent = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  accent?: SummaryAccent
}) {
  return (
    <StatCard
      label={label}
      value={typeof value === 'number' ? value : <span className="text-[17px] font-semibold tracking-[-0.01em]">{value}</span>}
      hint={hint}
      icon={summaryIcons[accent]}
      iconTone={summaryIconTone[accent]}
      solid={accent === 'default'}
    />
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
    <section className="space-y-[18px] page-enter">
      <PageHeader
        eyebrow={tx('ceo.workday.header.eyebrow', 'CEO Workspace')}
        title={tx('ceo.workday.header.title', 'Workday Overrides')}
        description={tx('ceo.workday.header.description', 'Configure holidays and short working days that affect update expectations.')}
        actions={(
          <>
            <div className="flex h-11 items-center gap-2 rounded-[14px] bg-[var(--accent-soft)] px-3">
              <Label className="text-[12.5px] text-[var(--muted)]">{tx('common.year', 'Year')}</Label>
              <Input
                type="number"
                min="2020"
                max="2035"
                value={year}
                onChange={(event) => setYear(Number(event.target.value) || now.getFullYear())}
                className="h-8 min-h-0 w-[72px] rounded-[9px] bg-transparent px-1.5 text-sm font-semibold hover:bg-transparent focus:bg-[var(--surface)]"
              />
            </div>

            <div className="flex h-11 items-center gap-2 rounded-[14px] bg-[var(--accent-soft)] px-3">
              <Label className="text-[12.5px] text-[var(--muted)]">{tx('common.month', 'Month')}</Label>
              <SelectField
                value={String(month)}
                options={monthOptions}
                onValueChange={(value) => setMonth(Number(value))}
                className="h-8 min-h-0 min-w-28 rounded-[9px] bg-transparent px-1.5 text-sm font-semibold hover:bg-transparent"
              />
            </div>

            <Button
              variant="secondary"
              onClick={() => void handleRefresh()}
            >
              {t('common.refresh')}
            </Button>
            <Button
              variant="primary"
              onClick={openCreateDialog}
            >
              {tx('ceo.workday.actions.create', 'Create Override')}
            </Button>
          </>
        )}
      />

      <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
        <Card>
          <div className="mb-[18px] flex items-start justify-between gap-3">
            <SectionTitle
              title={tx('ceo.workday.list.title', 'Overrides for {{month}} {{year}}', { month: getMonthName(month), year })}
              description={tx('ceo.workday.list.description', 'Each entry changes how update tracking treats a specific date.')}
            />
            <Badge variant="blue">{tx('ceo.workday.list.items', '{{count}} items', { count: overrides.length })}</Badge>
          </div>

          {overrides.length > 0 ? (
            <div className="space-y-2.5">
              {overrides.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[18px] bg-[var(--accent-soft)] p-[18px]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
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

                      <p className="mt-2 text-[12.5px] text-[var(--muted)]">
                        {formatShortDate(item.special_date)}
                      </p>

                      {item.note?.trim() ? (
                        <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-[var(--muted-strong)]">
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

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-[var(--muted)]">
                    <span>{tx('common.created', 'Created')}: {formatDateTime(item.created_at)}</span>
                    <span className="text-[var(--border-hover)]">|</span>
                    <span>{tx('common.updated', 'Updated')}: {formatDateTime(item.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyStateBlock
              eyebrow={''}
              title={tx('ceo.workday.empty.title', 'No overrides yet for {{month}} {{year}}', { month: getMonthName(month), year })}
              description={tx('ceo.workday.empty.description', 'Create a holiday or short-day rule so calendars stop treating those dates as missing workdays.')}
              className="bg-[var(--accent-soft)]"
            >
              <Button variant="primary" size="sm" onClick={openCreateDialog}>
                {tx('ceo.workday.empty.action', 'Create First Override')}
              </Button>
            </EmptyStateBlock>
          )}
        </Card>

        <Card>
          <div className="space-y-[18px]">
            <SectionTitle
              title={tx('ceo.workday.guide.title', 'How It Works')}
              description={tx('ceo.workday.guide.description', 'Use these rules to control whether updates are expected on a date.')}
            />

            <Alert tone="warning" title={lt('Holiday')}>
              {tx('ceo.workday.guide.holiday_description', 'Mark a date as a holiday when no update should be expected. Calendars should treat it as an off day instead of a missing day.')}
            </Alert>

            <Alert tone="blue" title={lt('Short Day')}>
              {tx('ceo.workday.guide.short_day_description', 'Use a short day when working hours change. You can still require updates or turn them off for that shortened date.')}
            </Alert>

            <Alert tone="neutral" title={tx('ceo.workday.guide.member_targeting_title', 'Member Targeting')}>
              {tx('ceo.workday.guide.member_targeting_description', 'Choose all members for company-wide holidays, or select one or more members when the override is specific to a subset of the team.')}
            </Alert>
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
