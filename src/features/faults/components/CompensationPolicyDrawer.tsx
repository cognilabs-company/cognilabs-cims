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
        <div className="modal-pop pointer-events-auto flex max-h-[min(86vh,860px)] w-full max-w-[780px] flex-col overflow-hidden rounded-[20px] bg-[var(--surface)] shadow-[var(--elev-xl)] ring-1 ring-[var(--border)]">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3.5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.06em] text-[var(--muted)] uppercase">
                {lt('Compensation policy')}
              </p>
              <h2 className="mt-0.5 truncate text-[16px] font-semibold tracking-[-0.015em] text-[var(--foreground)]">
                {title}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">
                {getMonthName(month)} {year}
              </p>
            </div>

            <IconButton size="md" label={lt('Close compensation policy drawer')} onClick={onClose}>
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 4l8 8M12 4 4 12" strokeLinecap="round" />
              </svg>
            </IconButton>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[var(--app-canvas)] px-4 py-4 sm:px-5">
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
