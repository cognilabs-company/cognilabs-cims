import { translateCurrentLiteral } from '../i18n/translations'
import { cn } from '../lib/cn'

type SectionTitleProps = {
  eyebrow?: string
  title: string
  description?: string
  gradient?: boolean
  className?: string
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  gradient = false,
  className,
}: SectionTitleProps) {
  const localizedEyebrow = eyebrow ? translateCurrentLiteral(eyebrow) : null
  const localizedTitle = translateCurrentLiteral(title)
  const localizedDescription = description ? translateCurrentLiteral(description) : null

  return (
    <div className={cn('space-y-1.5', className)}>
      {localizedEyebrow ? (
        <p className="ui-eyebrow">{localizedEyebrow}</p>
      ) : null}

      <h2
        className={cn(
          'ui-section-title',
          gradient ? 'text-gradient' : 'text-[var(--foreground)]',
        )}
      >
        {localizedTitle}
      </h2>

      {localizedDescription ? (
        <p className="text-[13px] text-[var(--muted)]">{localizedDescription}</p>
      ) : null}
    </div>
  )
}
