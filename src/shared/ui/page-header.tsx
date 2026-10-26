import type { ReactNode } from 'react'
import { translateCurrentLiteral } from '../i18n/translations'
import { cn } from '../lib/cn'
import { Card } from './card'

type PageHeaderTone = 'neutral' | 'blue' | 'success' | 'warning' | 'danger' | 'violet'

export type PageHeaderMetaItem = {
  label: string
  value: string
  hint?: string
  tone?: PageHeaderTone
}

type PageHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  meta?: PageHeaderMetaItem[]
  actions?: ReactNode
  className?: string
}

const metaToneClassNames: Record<PageHeaderTone, string> = {
  neutral: 'meta-neutral',
  blue: 'meta-blue',
  success: 'meta-success',
  warning: 'meta-warning',
  danger: 'meta-danger',
  violet: 'meta-violet',
}

export function PageHeader({
  title,
  eyebrow,
  description: _description,
  meta = [],
  actions,
  className,
}: PageHeaderProps) {
  return (
    <Card
      variant="glass"
      noPadding
      className={cn('page-header-card page-enter overflow-hidden rounded-xl', className)}
    >
      <div className="relative overflow-hidden px-4 py-4 sm:px-5 sm:py-5">
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              {eyebrow ? (
                <p className="page-header-label ui-eyebrow">
                  {translateCurrentLiteral(eyebrow)}
                </p>
              ) : null}
              <h1 className="page-header-title ui-display-heading ui-page-title">
                {translateCurrentLiteral(title)}
              </h1>
            </div>

            {actions ? (
              <div className="flex flex-wrap items-center gap-2 xl:max-w-105 xl:justify-end">
                {actions}
              </div>
            ) : null}
          </div>

          {meta.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {meta.map((item) => (
                <div
                  data-ui-surface="true"
                  key={`${item.label}-${item.value}`}
                  className={cn(
                    'rounded-xl border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm',
                    metaToneClassNames[item.tone ?? 'neutral'],
                  )}
                >
                  <p className="page-header-label ui-eyebrow">
                    {translateCurrentLiteral(item.label)}
                  </p>
                  <p className="ui-body mt-2 font-semibold tracking-tight text-current">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
