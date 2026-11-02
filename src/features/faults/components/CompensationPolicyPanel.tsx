import { useState } from 'react'
import { Badge } from '../../../shared/ui/badge'
import { Card } from '../../../shared/ui/card'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { DetailStatTile } from './SalaryEstimatePrimitives'
import {
  type EmployeeCompensationPolicy,
  formatAmount,
  formatPercent,
} from '../lib/salaryEstimates'

type CompensationPolicyPanelProps = {
  policy: EmployeeCompensationPolicy | null
  className?: string
  collapsible?: boolean
  defaultExpanded?: boolean
}

export function CompensationPolicyPanel({
  policy,
  className,
  collapsible = true,
  defaultExpanded = false,
}: CompensationPolicyPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || !collapsible)
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

  if (!policy) {
    return (
      <Card className={className}>
        <div className="flex flex-col gap-2">
          <p className="ui-eyebrow">
            {lt('Compensation policy')}
          </p>
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
            {lt('Policy configuration unavailable')}
          </h2>
          <p className="text-sm text-[var(--muted)]">
            {lt('The compensation policy endpoint did not return a configuration for this employee.')}
          </p>
        </div>
      </Card>
    )
  }

  const isContentExpanded = collapsible ? isExpanded : true
  const headerContent = (
    <>
      <div className="min-w-0">
        <p className="ui-eyebrow">
          {lt('Compensation policy')}
        </p>
        <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
          {lt('Configured salary rules')}
        </h2>
        <p className="mt-1.5 text-[13px] text-[var(--muted)]">
          {lt('Read-only policy values returned by the compensation policy API.')}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {policy.employeeName ? <Badge variant="secondary">{policy.employeeName}</Badge> : null}
          <Badge variant="blue">{policy.deductionRates.length} {lt('deduction rates')}</Badge>
          <Badge variant="blue">{policy.bonusRates.length} {lt('bonus rules')}</Badge>
        </div>
      </div>

      {collapsible ? (
        <div className="flex shrink-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-[var(--input-surface)] text-[var(--muted-strong)]">
            <svg
              viewBox="0 0 16 16"
              className={cn('h-4 w-4 transition-transform duration-200', isExpanded ? 'rotate-180' : '')}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M4 6.5 8 10.5 12 6.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      ) : null}
    </>
  )

  return (
    <Card noPadding className={cn('overflow-hidden', className)}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          aria-label={lt('Compensation policy')}
          className="flex w-full items-start justify-between gap-4 p-[22px] text-left transition-colors hover:bg-[var(--card-hover)]"
        >
          {headerContent}
        </button>
      ) : (
        <div className="flex items-start justify-between gap-4 p-[22px]">
          {headerContent}
        </div>
      )}

      {isContentExpanded ? (
        <div className="border-t border-[var(--border-subtle)] px-[22px] pt-[18px] pb-[22px]">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <DetailStatTile label={lt('Salary base')} value={formatAmount(policy.salaryBase)} />
            <DetailStatTile label={lt('Deduction cap %')} value={formatPercent(policy.monthlyDeductionCapPercent)} tone="danger" />
            <DetailStatTile label={lt('Cap amount')} value={formatAmount(policy.monthlyDeductionCapAmount)} tone="danger" />
            <DetailStatTile label={lt('Developer split')} value={formatPercent(policy.responsibilitySplit.developerPercent)} tone="blue" />
            <DetailStatTile label={lt('Reviewer split')} value={formatPercent(policy.responsibilitySplit.reviewerPercent)} tone="blue" />
          </div>

          <div className="mt-[18px] grid gap-[18px] xl:grid-cols-2">
            <div className="rounded-[18px] bg-[var(--danger-dim)] p-[18px]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--danger-text)]">
                    {lt('Deduction rates')}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-5 text-[var(--muted-strong)]">
                    {lt('Severity-based deduction rules.')}
                  </p>
                </div>
                <Badge variant="secondary" className="bg-[var(--surface)]">{policy.deductionRates.length}</Badge>
              </div>

              <div className="mt-4 space-y-2.5">
                {policy.deductionRates.map((rate) => (
                  <div key={rate.severity} className="rounded-[14px] bg-[var(--surface)] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{lt(rate.severity)}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="danger">{formatPercent(rate.percent)}</Badge>
                        <Badge variant="secondary">{formatAmount(rate.amount)}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[18px] bg-[var(--success-dim)] p-[18px]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--success-text)]">
                    {lt('Bonus rates')}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-5 text-[var(--muted-strong)]">
                    {tr(
                      'Configured percentage rules for bonus triggers.',
                      'Bonus ishga tushishi uchun foiz qoidalari sozlangan.',
                      'Nastroeny protsentnye pravila dlya zapuska bonusov.',
                    )}
                  </p>
                </div>
                <Badge variant="secondary" className="bg-[var(--surface)]">{policy.bonusRates.length}</Badge>
              </div>

              <div className="mt-4 space-y-2.5">
                {policy.bonusRates.map((rate) => (
                  <div key={rate.key} className="rounded-[14px] bg-[var(--surface)] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{lt(rate.label)}</p>
                      <Badge variant="success">{formatPercent(rate.percent)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-[18px] grid gap-[18px] xl:grid-cols-[1.1fr_1fr]">
            <div className="rounded-[18px] bg-[var(--muted-surface)] p-[18px]">
              <p className="ui-card-label">{lt('Mistake taxonomy')}</p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {policy.mistakeCategories.map((category) => (
                  <Badge key={category.key} variant="secondary" className="bg-[var(--surface)]">{lt(category.label)}</Badge>
                ))}
              </div>

              <p className="ui-card-label mt-[18px]">{lt('Severities')}</p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {policy.severities.map((severity) => (
                  <Badge key={severity} variant="secondary" className="bg-[var(--surface)]">{lt(severity)}</Badge>
                ))}
              </div>
            </div>

            <div className="rounded-[18px] bg-[var(--accent-soft)] p-[18px]">
              <p className="ui-card-label">{lt('Decision tree')}</p>
              <div className="mt-3.5 space-y-2.5">
                {policy.decisionTree.map((step) => (
                  <div key={`${step.step}-${step.question}`} className="rounded-[14px] bg-[var(--surface)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--blue-text)]">
                      {lt('Step')} {step.step}
                    </p>
                    <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{lt(step.question)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {step.ifYes ? <Badge variant="success">{lt('If yes')}: {lt(step.ifYes)}</Badge> : null}
                      {step.ifNo ? <Badge variant="secondary">{lt('If no')}: {lt(step.ifNo)}</Badge> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
