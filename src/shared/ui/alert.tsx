import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { toneSurface, toneText, type Tone } from './tone'

type AlertProps = {
  tone?: Tone
  title?: ReactNode
  children?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function Alert({ tone = 'blue', title, children, icon, action, className }: AlertProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-[18px] p-4',
        toneSurface[tone],
        toneText[tone],
        className,
      )}
    >
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="text-sm font-semibold">{title}</p> : null}
        {children ? <div className={cn('text-[13px]', title && 'mt-1 opacity-90')}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
