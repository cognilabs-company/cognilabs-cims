import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

type TooltipProps = {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom'
  className?: string
}

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <span className={cn('group/tooltip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-[130] -translate-x-1/2 rounded-[9px] bg-[var(--surface-inverse)] px-2.5 py-1.5',
          'text-[12px] font-medium whitespace-nowrap text-white opacity-0 shadow-[var(--elev-lg)] transition-opacity duration-150',
          'group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
        )}
      >
        {content}
      </span>
    </span>
  )
}
