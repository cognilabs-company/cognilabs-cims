import type { CSSProperties } from 'react'

export type PopoverStyle = CSSProperties & { '--popover-origin'?: string }

/**
 * Place a popover under its trigger, or above it when there isn't room.
 * When above, it is anchored by `bottom`, so its real height never matters.
 */
export function anchorPopover(trigger: HTMLElement, height: number, width: number): PopoverStyle {
  const rect = trigger.getBoundingClientRect()
  const w = Math.min(width, window.innerWidth - 16)
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - w - 8)
  const spaceBelow = window.innerHeight - rect.bottom
  const above = spaceBelow < height + 12 && rect.top > spaceBelow
  return above
    ? { left, width: w, bottom: window.innerHeight - rect.top + 6, maxHeight: rect.top - 14, '--popover-origin': 'bottom left' }
    : { left, width: w, top: rect.bottom + 6, maxHeight: spaceBelow - 14, '--popover-origin': 'top left' }
}
