import { useEffect, useRef, type RefObject } from 'react'
import { isInFloatingLayer } from '../../../shared/lib/floating'

/** Closes a popover on outside click or Escape. */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    if (!open) return
    const handlePointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node) && !isInFloatingLayer(event.target)) onCloseRef.current()
    }
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) onCloseRef.current() }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, ref])
}
