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
  description: _description,
  gradient = false,
  className,
}: SectionTitleProps) {
  const localizedEyebrow = eyebrow ? translateCurrentLiteral(eyebrow) : null
  const localizedTitle = translateCurrentLiteral(title)

  return (
    <div className={cn('space-y-1.5', className)}>
      {localizedEyebrow ? (
        <div className="flex items-center gap-2">
          <span className="inline-block h-1 w-1 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.7)]" />
          <p className="ui-eyebrow text-[var(--caption)]">
            {localizedEyebrow}
          </p>
        </div>
      ) : null}

      <h2
        className={cn(
          'ui-section-title',
          gradient ? 'text-gradient' : 'text-[var(--foreground)]',
        )}
      >
        {localizedTitle}
      </h2>
    </div>
  )
}
