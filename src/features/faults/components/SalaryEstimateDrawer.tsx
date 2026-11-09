import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { IconButton } from '../../../shared/ui/icon-button'
import { Progress } from '../../../shared/ui/progress'
import { DetailStatTile } from './SalaryEstimatePrimitives'
import {
  type EmployeeSalaryReport,
  formatAmount,
  formatCount,
  formatPercent,
  getMonthName,
} from '../lib/salaryEstimates'

export function SalaryEstimateDrawer({
  open,
  report,
  month,
  year,
  onClose,
  onOpenDetail,
  onAddDeliveryBonus,
}: {
  open: boolean
  report: EmployeeSalaryReport | null
  month: number
  year: number
  onClose: () => void
  onOpenDetail: () => void
  onAddDeliveryBonus: () => void
}) {
  const lt = translateCurrentLiteral
  const locale = getIntlLocale()
  const tr = (key: string, uzFallback: string, ruFallback: string) => {
    const value = lt(key)

    if (value !== key) {
      return value
    }

    if (locale.startsWith('ru')) {
      return ruFallback
    }

    if (locale.startsWith('en')) {
      return key
    }

    return uzFallback
  }

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open || !report) {
    return null
  }

  const penaltyProgress = Math.min(100, Math.max(0, Number.isFinite(report.penaltyPercentage) ? report.penaltyPercentage : 0))
  const productivityProgress = Math.min(100, Math.max(0, Number.isFinite(report.productivityPercentage) ? report.productivityPercentage : 0))

  return createPortal(
    <div className="fixed inset-0 z-[90] salary-estimate-drawer text-[var(--foreground)]">
      <button
        type="button"
        aria-label={lt('Close salary detail drawer')}
        className="dialog-backdrop backdrop-fade absolute inset-0"
        onClick={onClose}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        <div className="modal-pop pointer-events-auto flex max-h-full w-full max-w-[860px] flex-col overflow-hidden rounded-[22px] bg-[var(--surface)] shadow-[var(--elev-xl)]">
          <div className="flex items-start justify-between gap-4 bg-[var(--surface)] px-5 py-[18px] sm:px-6">
            <div className="min-w-0">
              <p className="ui-eyebrow">
                {tr('Salary estimate', 'Maosh hisobi', 'Оценка зарплаты')}
              </p>
              <h2 className="mt-1.5 truncate text-xl font-bold tracking-[-0.02em] text-[var(--foreground)]">
                {report.fullName}
              </h2>
              <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                {getMonthName(month)} {year} {lt('snapshot')}
              </p>
            </div>

            <IconButton size="lg" label={lt('Close salary drawer')} onClick={onClose}>
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 4l8 8M12 4 4 12" strokeLinecap="round" />
              </svg>
            </IconButton>
          </div>

          <div className="min-h-0 flex-1 space-y-[18px] overflow-y-auto bg-[var(--app-canvas)] px-5 py-[18px] sm:px-6">
            <Card>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--muted)]">{report.label}</p>
                  <h3 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)]">{report.fullName}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{report.roleLabel}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={report.hasPenalty ? 'danger' : 'secondary'}>
                    {report.hasPenalty ? lt('Has deduction') : lt('Clean')}
                  </Badge>
                  <Badge variant={report.hasBonus ? 'success' : 'secondary'}>
                    {report.hasBonus ? lt('Has bonus') : lt('No bonus')}
                  </Badge>
                  <Badge variant={report.qualifiesProductivityBonus ? 'success' : 'secondary'}>
                    {report.qualifiesProductivityBonus ? lt('Productivity qualified') : lt('Productivity pending')}
                  </Badge>
                </div>
              </div>

              <div className="mt-[18px] flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={onOpenDetail}>
                  {lt('Open full detail')}
                </Button>
                <Button variant="success" size="sm" onClick={onAddDeliveryBonus}>
                  {lt('Add delivery bonus')}
                </Button>
              </div>
            </Card>

            {(report.formulaText || report.calculationBreakdown) && (
              <Card className="space-y-[18px]">
                {report.formulaText && (
                  <div className="rounded-[18px] bg-[var(--muted-surface)] p-[18px]">
                    <p className="ui-card-label mb-2">Calculation Formula</p>
                    <p className="font-mono text-[13px] leading-relaxed text-[var(--foreground)] sm:text-sm">{report.formulaText}</p>
                  </div>
                )}

                {report.calculationBreakdown && (
                  <div className="grid gap-2.5">
                    {report.calculationBreakdown.bonus_lines.map((line, index) => (
                      <div key={`bonus-${index}`} className="flex items-center justify-between gap-3 rounded-[18px] bg-[var(--blue-dim)] p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="blue" size="sm" className="shrink-0 bg-[var(--surface)]">Bonus</Badge>
                            <h4 className="truncate text-[13.5px] font-semibold text-[var(--foreground)]">{line.label}</h4>
                          </div>
                          {line.reason && <p className="mt-1.5 text-[12px] text-[var(--muted-strong)]">{line.reason}</p>}
                        </div>
                        <div className="shrink-0 pl-3 text-right">
                          <p className="text-[15px] font-bold tabular-nums text-[var(--blue-text)]">+{formatAmount(line.amount)}</p>
                          <p className="text-[11.5px] font-semibold tabular-nums text-[var(--muted-strong)]">{line.percent}%</p>
                        </div>
                      </div>
                    ))}

                    {report.calculationBreakdown.deduction_lines.map((line, index) => (
                      <div key={`deduction-${index}`} className="flex items-center justify-between gap-3 rounded-[18px] bg-[var(--danger-dim)] p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="danger" size="sm" className="shrink-0 bg-[var(--surface)]">Deduction</Badge>
                            <h4 className="truncate text-[13.5px] font-semibold text-[var(--foreground)]">{line.label}</h4>
                          </div>
                          {line.reason && <p className="mt-1.5 text-[12px] text-[var(--muted-strong)]">{line.reason}</p>}
                        </div>
                        <div className="shrink-0 pl-3 text-right">
                          <p className="text-[15px] font-bold tabular-nums text-[var(--danger-text)]">-{formatAmount(line.amount)}</p>
                          <p className="text-[11.5px] font-semibold tabular-nums text-[var(--muted-strong)]">{line.percent}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            <Card>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailStatTile label={lt('Final salary')} value={formatAmount(report.finalSalary)} />
                <DetailStatTile label={lt('Estimated salary')} value={formatAmount(report.estimatedSalary)} />
                <DetailStatTile label={lt('Base salary')} value={formatAmount(report.baseSalary)} />
                <DetailStatTile label={tr('After deduction', 'Ayirmadan keyin', 'После удержания')} value={formatAmount(report.afterPenalty)} />
                <DetailStatTile label={lt('Deduction')} value={formatAmount(report.deductionAmount)} tone="danger" />
                <DetailStatTile label={lt('Bonus amount')} value={formatAmount(report.bonusAmount)} tone="success" />
                <DetailStatTile label={lt('Bonus %')} value={formatPercent(report.totalBonusPercent)} tone="success" />
                <DetailStatTile label={tr('Deduction %', 'Ayirma %', 'Удержание %')} value={formatPercent(report.penaltyPercentage)} tone="danger" />
                <DetailStatTile label={lt('Mistakes')} value={formatCount(report.mistakesCount)} tone="danger" />
                <DetailStatTile label={lt('Delivery bonuses')} value={formatCount(report.deliveryBonusCount)} tone="success" />
                <DetailStatTile label={lt('Working days')} value={formatCount(report.workingDays)} />
                <DetailStatTile label={lt('Update days')} value={formatCount(report.updateDays)} />
                <DetailStatTile
                  label={lt('Productivity')}
                  value={Number.isFinite(report.productivityPercentage)
                    ? `${formatCount(report.updateDays)}/${formatCount(report.workingDays)} / ${formatPercent(report.productivityPercentage)}`
                    : '-'}
                  tone={report.qualifiesProductivityBonus ? 'success' : 'default'}
                />
              </div>
            </Card>

            <div className="grid gap-[18px] md:grid-cols-2">
              <Card>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-[var(--muted-strong)]">{tr('deduction impact', 'ayirma ta\'siri', 'влияние удержания')}</span>
                  <span className={cn('font-semibold tabular-nums', penaltyProgress > 0 ? 'text-[var(--danger-text)]' : 'text-[var(--foreground)]')}>
                    {formatPercent(report.penaltyPercentage)}
                  </span>
                </div>
                <Progress className="mt-3.5" value={penaltyProgress} tone="danger" />
                <p className="mt-3.5 text-[12.5px] leading-6 text-[var(--muted)]">
                  {report.deductionAmount > 0
                    ? `${formatAmount(report.deductionAmount)} ${tr('deducted in this period.', 'shu davrda ayirilgan.', 'удержано за этот период.')}`
                    : tr('No deductions were recorded for this period.', 'Bu davr uchun ayirma qayd etilmadi.', 'За этот период удержания не зафиксированы.')}
                </p>
              </Card>

              <Card>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-[var(--muted-strong)]">{lt('Productivity performance')}</span>
                  <span className={cn('font-semibold tabular-nums', report.qualifiesProductivityBonus ? 'text-[var(--success-text)]' : 'text-[var(--foreground)]')}>
                    {Number.isFinite(report.productivityPercentage) ? formatPercent(report.productivityPercentage) : '-'}
                  </span>
                </div>
                <Progress className="mt-3.5" value={productivityProgress} tone="success" />
                <p className="mt-3.5 text-[12.5px] leading-6 text-[var(--muted)]">
                  {report.qualifiesProductivityBonus
                    ? lt('Productivity bonus qualified for this period.')
                    : lt('Productivity bonus did not qualify for this period.')}
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
