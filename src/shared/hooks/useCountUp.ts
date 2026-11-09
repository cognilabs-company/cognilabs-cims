import { useEffect, useRef, useState } from 'react'

/** Animates a number from its previous value to `target` (ease-out), for KPI "count up" effects. */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    if (!Number.isFinite(target)) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = fromRef.current
    const length = reduceMotion ? 0 : duration
    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const progress = length === 0 ? 1 : Math.min(1, (now - start) / length)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = from + (target - from) * eased
      fromRef.current = next
      setValue(next)
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [duration, target])

  return value
}
