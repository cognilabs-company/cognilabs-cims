import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../../../app/hooks/useTheme'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { Badge } from '../../../shared/ui/badge'
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
    <div
      className="fixed inset-0 z-[94] compensation-policy-drawer text-[var(--foreground)]"
      data-theme={theme}
      style={{ colorScheme: isLight ? 'light' : 'dark' }}
    >
      <button
        type="button"
        aria-label={lt('Close compensation policy drawer')}
        className={cn(
          'absolute inset-0 backdrop-blur-md',
          isLight
            ? 'bg-[radial-gradient(circle_at_right,rgba(59,130,246,0.08),transparent_24%),rgba(248,250,252,0.78)]'
            : 'bg-[radial-gradient(circle_at_right,rgba(59,130,246,0.10),transparent_24%),rgba(0,0,0,0.62)]',
        )}
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 w-full md:w-[min(56vw,920px)] xl:w-[min(48vw,900px)]">
        <div
          className={cn(
            'sheet-enter flex h-full flex-col overflow-hidden border-l border-[var(--border)]',
            isLight
              ? 'bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,1))]'
              : 'bg-[linear-gradient(180deg,rgba(10,12,18,0.98),rgba(8,9,14,1))]',
          )}
        >
          <div
            className={cn(
              'flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6',
              isLight ? 'bg-white/95' : 'bg-transparent',
            )}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--blue-text)]">
                {lt('Compensation policy')}
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-[var(--foreground)]">
                {title}
              </h2>
              <p className="mt-1 text-xs text-[var(--muted-strong)]">
                {getMonthName(month)} {year}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] transition',
                isLight
                  ? 'bg-[var(--surface-elevated)] text-[var(--foreground)] hover:border-[var(--border-hover)] hover:bg-[var(--card-hover)]'
                  : 'bg-white/[0.03] text-white/72 hover:border-white/16 hover:bg-white/[0.06] hover:text-white',
              )}
              aria-label={lt('Close compensation policy drawer')}
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 4l8 8M12 4 4 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6', isLight ? 'bg-white' : 'bg-transparent')}>
            <div
              className={cn(
                'rounded-xl border border-[var(--border)] p-5',
                isLight
                  ? 'bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))]'
                  : 'bg-white/[0.03]',
              )}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-[1.8rem] font-semibold tracking-tight text-[var(--foreground)]">
                    {title}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={policy ? 'secondary' : 'outline'}>
                    {policy ? `${policy.deductionRates.length} ${lt('deduction rates')}` : lt('Unavailable')}
                  </Badge>
                  <Badge variant={policy ? 'secondary' : 'outline'}>
                    {policy ? `${policy.bonusRates.length} ${lt('bonus rules')}` : tr('Not configured', 'Sozlanmagan', 'Не настроено')}
                  </Badge>
                </div>
              </div>
            </div>

            <CompensationPolicyPanel
              policy={policy}
              collapsible={false}
              defaultExpanded
              className={cn(
                'mt-5 rounded-xl border-[var(--border)]',
                isLight
                  ? 'bg-white'
                  : 'bg-white/[0.03]',
              )}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
