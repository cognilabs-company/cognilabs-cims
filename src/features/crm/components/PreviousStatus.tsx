import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { useCrmScope } from '../lib/crmScope'
import { loadPreviousStatus } from '../lib/previousStatus'

/** "previous → current" in the lead list. The previous status loads once the row is on screen. */
export function PreviousStatus({ customerId, status, renderPrevious, children }: {
  customerId: number
  status: string
  renderPrevious: (previous: string) => ReactNode
  /** The current status (pill or picker). */
  children: ReactNode
}) {
  const { service, kind } = useCrmScope()
  const ref = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [loaded, setLoaded] = useState<{ key: string; previous: string | null } | null>(null)
  const key = `${customerId}:${status}`

  useEffect(() => {
    const node = ref.current
    if (!node || visible) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisible(true)
    }, { rootMargin: '200px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible || !status) return
    let alive = true
    void loadPreviousStatus(kind, customerId, status, (id) => service.statusHistory(id)).then((previous) => {
      if (alive) setLoaded({ key, previous })
    })
    return () => {
      alive = false
    }
  }, [customerId, key, kind, service, status, visible])

  const previous = loaded?.key === key ? loaded.previous : null
  return (
    <span ref={ref} className="flex min-w-0 items-center gap-1">
      {previous ? (
        <>
          <span className="min-w-0 shrink opacity-60">{renderPrevious(previous)}</span>
          <ArrowRight size={12} className="shrink-0 text-[var(--caption)]" />
        </>
      ) : null}
      <span className="min-w-0 shrink-0">{children}</span>
    </span>
  )
}
