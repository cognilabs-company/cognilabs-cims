import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAppShell } from '../../app/hooks/useAppShell'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import { cn } from '../../shared/lib/cn'

/**
 * A page's own buttons, shown in the top bar next to the page name (md and wider), so they do not
 * take a whole row above the content. On phones (no room in the top bar) they stay on the page.
 */
export function HeaderActions({ children, className }: { children: ReactNode; className?: string }) {
  const { headerSlot } = useAppShell()
  const wide = useMediaQuery('(min-width: 768px)')
  if (headerSlot && wide) return createPortal(children, headerSlot)
  return <div className={cn('flex flex-wrap items-center justify-end gap-2', className)}>{children}</div>
}
