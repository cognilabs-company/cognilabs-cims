import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { Badge } from '../../../shared/ui/badge'
import { Card } from '../../../shared/ui/card'
import { IconButton } from '../../../shared/ui/icon-button'
import { CompensationPolicyPanel } from './CompensationPolicyPanel'
import {
  type EmployeeCompensationPolicy,
  getMonthName,
} from '../lib/salaryEstimates'

type CompensationPolicyDrawerProps = {
  open: boolean
  policy: EmployeeCompensationPolicy | null
  memberName?: string | null
  month: number
  year: number
  onClose: () => void
}

export function CompensationPolicyDrawer({
  open,
  policy,
  memberName,
  month,
  year,
  onClose,
}: CompensationPolicyDrawerProps) {
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

  if (!open) {
    return null
  }

  const title = memberName?.trim() || policy?.employeeName?.trim() || lt('Configured salary rules')

  return createPortal(
    <div className="fixed inset-0 z-[94] compensation-policy-drawer text-[var(--foreground)]">
      <button
        type="button"
        aria-label={lt('Close compensation policy drawer')}
        className="dialog-backdrop backdrop-fade absolute inset-0"
        onClick={onClose}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        <div className="modal-pop pointer-events-auto flex max-h-full w-full max-w-[980px] flex-col overflow-hidden rounded-[22px] bg-[var(--surface)] shadow-[var(--elev-xl)]">
          <div className="flex items-start justify-between gap-4 bg-[var(--surface)] px-5 py-[18px] sm:px-6">
            <div className="min-w-0">
              <p className="ui-eyebrow">
                {lt('Compensation policy')}
              </p>
              <h2 className="mt-1.5 truncate text-xl font-bold tracking-[-0.02em] text-[var(--foreground)]">
                {title}
              </h2>
              <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                {getMonthName(month)} {year}
              </p>
            </div>

            <IconButton size="lg" label={lt('Close compensation policy drawer')} onClick={onClose}>
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 4l8 8M12 4 4 12" strokeLinecap="round" />
              </svg>
            </IconButton>
          </div>

          <div className="min-h-0 flex-1 space-y-[18px] overflow-y-auto bg-[var(--app-canvas)] px-5 py-[18px] sm:px-6">
            <Card>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h3 className="text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
                    {title}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={policy ? 'blue' : 'secondary'}>
                    {policy ? `${policy.deductionRates.length} ${lt('deduction rates')}` : lt('Unavailable')}
                  </Badge>
                  <Badge variant={policy ? 'blue' : 'secondary'}>
                    {policy ? `${policy.bonusRates.length} ${lt('bonus rules')}` : tr('Not configured', 'Sozlanmagan', 'Не настроено')}
                  </Badge>
                </div>
              </div>
            </Card>

            <CompensationPolicyPanel
              policy={policy}
              collapsible={false}
              defaultExpanded
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
