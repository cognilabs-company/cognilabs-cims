import type { ReactNode } from 'react'
import { translateCurrentLiteral } from '../i18n/translations'
import { cn } from '../lib/cn'

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
  meta = [],
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('page-enter flex flex-col gap-[18px]', !actions && meta.length === 0 && 'contents', className)}>
      {/* Page names live in the top bar; no big title / description text on the page itself. */}
      <h1 className="sr-only">{translateCurrentLiteral(title)}</h1>
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {actions}
        </div>
      ) : null}

      {meta.length > 0 ? (
        <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
          {meta.map((item) => (
            <div
              data-ui-surface="true"
              key={`${item.label}-${item.value}`}
              className={cn('rounded-[18px] border px-4 py-3.5', metaToneClassNames[item.tone ?? 'neutral'])}
            >
              <p className="page-header-label ui-eyebrow">
                {translateCurrentLiteral(item.label)}
              </p>
              <p className="mt-2 text-sm font-semibold tracking-[-0.01em] text-current">
                {item.value}
              </p>
              {item.hint ? (
                <p className="mt-1 text-xs opacity-70">{translateCurrentLiteral(item.hint)}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
