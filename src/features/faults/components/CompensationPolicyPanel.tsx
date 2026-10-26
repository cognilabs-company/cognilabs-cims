import { useState } from 'react'
import { useTheme } from '../../../app/hooks/useTheme'
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
  const { theme } = useTheme()
  const isLight = theme === 'light'
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
      <Card className={className ? `rounded-xl border-[var(--border)] bg-white p-6 dark:border-white/10 dark:bg-[var(--card)] ${className}` : 'rounded-xl border-[var(--border)] bg-white p-6 dark:border-white/10 dark:bg-[var(--card)]'}>
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
            {lt('Compensation policy')}
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
            {lt('Policy configuration unavailable')}
          </h2>
          <p className="text-sm text-[var(--muted-strong)]">
            {lt('The compensation policy endpoint did not return a configuration for this employee.')}
          </p>
        </div>
      </Card>
    )
  }

  const deductionPanelStyle = isLight
    ? {
        borderColor: '#f8b4b4',
        background: 'linear-gradient(180deg, #fff4f4 0%, #ffe8e8 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.86), 0 10px 22px rgba(239,68,68,0.06)',
      }
    : undefined

  const deductionPanelLineStyle = isLight
    ? { background: 'linear-gradient(90deg, #dc2626 0%, rgba(220,38,38,0.42) 38%, transparent 74%)' }
    : undefined

  const deductionTitleStyle = isLight ? { color: '#b42318' } : undefined
  const deductionHintStyle = isLight ? { color: '#7f1d1d' } : undefined

  const bonusPanelStyle = isLight
    ? {
        borderColor: 'var(--success-border)',
        background: 'linear-gradient(180deg, var(--success-soft) 0%, var(--success-strong) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.86), 0 10px 22px rgba(var(--success-rgb),0.06)',
      }
    : undefined

  const bonusPanelLineStyle = isLight
    ? { background: 'linear-gradient(90deg, var(--success-text) 0%, rgba(var(--success-rgb),0.42) 38%, transparent 74%)' }
    : undefined

  const bonusTitleStyle = isLight ? { color: 'var(--success-text)' } : undefined
  const bonusHintStyle = isLight ? { color: 'var(--success-text)' } : undefined
  const isContentExpanded = collapsible ? isExpanded : true
  const headerContent = (
    <>
      <div className="min-w-0">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.24em] text-[var(--blue-text)]">
          {lt('Compensation policy')}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)]">
          {lt('Configured salary rules')}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted-strong)]">
          {lt('Read-only policy values returned by the compensation policy API.')}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {policy.employeeName ? <Badge variant="outline">{policy.employeeName}</Badge> : null}
          <Badge variant="secondary">{policy.deductionRates.length} {lt('deduction rates')}</Badge>
          <Badge variant="secondary">{policy.bonusRates.length} {lt('bonus rules')}</Badge>
        </div>
      </div>

      {collapsible ? (
        <div className="flex shrink-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)]">
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
    <Card className={className ? `relative overflow-hidden rounded-xl border-[var(--border)] bg-white dark:border-white/10 dark:bg-[var(--card)] ${className}` : 'relative overflow-hidden rounded-xl border-[var(--border)] bg-white dark:border-white/10 dark:bg-[var(--card)]'}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,var(--blue-text),rgba(37,99,235,0.42),transparent_76%)] dark:bg-[linear-gradient(90deg,rgba(191,219,254,0.9),rgba(96,165,250,0.34),transparent_76%)]" />
      {collapsible ? (
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          aria-label={lt('Compensation policy')}
          className="flex w-full items-start justify-between gap-4 px-6 py-6 text-left transition hover:bg-[var(--card-hover)]"
        >
          {headerContent}
        </button>
      ) : (
        <div className="flex items-start justify-between gap-4 px-6 py-6">
          {headerContent}
        </div>
      )}

      {isContentExpanded ? (
        <div className="border-t border-[var(--border)] px-6 pb-6 pt-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <DetailStatTile label={lt('Salary base')} value={formatAmount(policy.salaryBase)} theme={theme} />
            <DetailStatTile label={lt('Deduction cap %')} value={formatPercent(policy.monthlyDeductionCapPercent)} tone="danger" theme={theme} />
            <DetailStatTile label={lt('Cap amount')} value={formatAmount(policy.monthlyDeductionCapAmount)} tone="danger" theme={theme} />
            <DetailStatTile label={lt('Developer split')} value={formatPercent(policy.responsibilitySplit.developerPercent)} tone="blue" theme={theme} />
            <DetailStatTile label={lt('Reviewer split')} value={formatPercent(policy.responsibilitySplit.reviewerPercent)} tone="blue" theme={theme} />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div
              className="relative overflow-hidden rounded-xl border border-[var(--danger-border)] bg-rose-50/55 p-4 dark:border-rose-500/18 dark:bg-rose-950/15"
              style={deductionPanelStyle}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,var(--danger-text),rgba(185,28,28,0.42),transparent_74%)] dark:bg-[linear-gradient(90deg,rgba(254,205,211,0.88),rgba(251,113,133,0.32),transparent_74%)]"
                style={deductionPanelLineStyle}
              />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p
                    className="text-[12px] font-extrabold uppercase tracking-[0.24em] text-[var(--danger-text)] dark:text-rose-200/95"
                    style={deductionTitleStyle}
                  >
                    {lt('Deduction rates')}
                  </p>
                  <p
                    className="mt-1 text-[13px] font-semibold leading-5 text-slate-700 dark:text-[var(--muted-strong)]"
                    style={deductionHintStyle}
                  >
                    {lt('Severity-based deduction rules.')}
                  </p>
                </div>
                <Badge variant="outline">{policy.deductionRates.length}</Badge>
              </div>

              <div className="mt-4 space-y-3">
                {policy.deductionRates.map((rate) => (
                  <div key={rate.severity} className="rounded-xl border border-[var(--danger-border)] bg-rose-50/88 px-4 py-3 dark:border-rose-500/18 dark:bg-black/18">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{lt(rate.severity)}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="danger">{formatPercent(rate.percent)}</Badge>
                        <Badge variant="outline">{formatAmount(rate.amount)}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="relative overflow-hidden rounded-xl border border-[var(--success-border)] bg-[var(--success-soft)] p-4 dark:border-[var(--success-border)] dark:bg-[var(--success-dim)]"
              style={bonusPanelStyle}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
                style={bonusPanelLineStyle}
              />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p
                    className="text-[12px] font-extrabold uppercase tracking-[0.24em] text-[var(--success-text)]"
                    style={bonusTitleStyle}
                  >
                    {lt('Bonus rates')}
                  </p>
                  <p
                    className="mt-1 text-[13px] font-semibold leading-5 text-slate-700 dark:text-[var(--muted-strong)]"
                    style={bonusHintStyle}
                  >
                    {tr(
                      'Configured percentage rules for bonus triggers.',
                      'Bonus ishga tushishi uchun foiz qoidalari sozlangan.',
                      'Nastroeny protsentnye pravila dlya zapuska bonusov.',
                    )}
                  </p>
                </div>
                <Badge variant="outline">{policy.bonusRates.length}</Badge>
              </div>

              <div className="mt-4 space-y-3">
                {policy.bonusRates.map((rate) => (
                  <div key={rate.key} className="rounded-xl border border-[var(--success-border)] bg-[var(--success-strong)] px-4 py-3 dark:border-[var(--success-border)] dark:bg-[var(--success-dim)]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{lt(rate.label)}</p>
                      <Badge variant="success">{formatPercent(rate.percent)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
            <div className="rounded-xl border border-[var(--border)] bg-white p-4 dark:bg-[var(--surface-elevated)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{lt('Mistake taxonomy')}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {policy.mistakeCategories.map((category) => (
                  <Badge key={category.key} variant="outline">{lt(category.label)}</Badge>
                ))}
              </div>

              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{lt('Severities')}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {policy.severities.map((severity) => (
                  <Badge key={severity} variant="outline">{lt(severity)}</Badge>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-white p-4 dark:bg-[var(--surface-elevated)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{lt('Decision tree')}</p>
              <div className="mt-4 space-y-3">
                {policy.decisionTree.map((step) => (
                  <div key={`${step.step}-${step.question}`} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 dark:bg-[var(--card)]">
                    <p className="text-xs font-semibold tracking-[0.18em] text-[var(--blue-text)]">
                      {lt('Step')} {step.step}
                    </p>
                    <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{lt(step.question)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {step.ifYes ? <Badge variant="success">{lt('If yes')}: {lt(step.ifYes)}</Badge> : null}
                      {step.ifNo ? <Badge variant="outline">{lt('If no')}: {lt(step.ifNo)}</Badge> : null}
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
