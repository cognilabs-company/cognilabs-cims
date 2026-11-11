import type { MenuAnchor } from '../components/ItemMenu'

const MENU_WIDTH = 224
const ENTRY_HEIGHT = 38
const CHROME_HEIGHT = 44

function clampAnchor(left: number, top: number, height: number, flipTop: number): MenuAnchor {
  const maxLeft = window.innerWidth - MENU_WIDTH - 8
  const fitsBelow = top + height <= window.innerHeight - 8
  return {
    left: Math.max(8, Math.min(left, maxLeft)),
    top: fitsBelow ? top : Math.max(8, flipTop - height),
  }
}

/** Under the "…" button, right-aligned; above it when there is no room below. */
export function menuAnchorFromRect(rect: DOMRect, entryCount: number): MenuAnchor {
  const height = entryCount * ENTRY_HEIGHT + CHROME_HEIGHT
  return clampAnchor(rect.right - MENU_WIDTH, rect.bottom + 4, height, rect.top - 4)
}

/** At the pointer (right click / long press). */
export function menuAnchorFromPoint(x: number, y: number, entryCount: number): MenuAnchor {
  const height = entryCount * ENTRY_HEIGHT + CHROME_HEIGHT
  return clampAnchor(x, y, height, y)
}
