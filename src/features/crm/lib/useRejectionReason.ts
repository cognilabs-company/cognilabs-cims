import { useCallback, useEffect, useRef, useState } from 'react'

export type RejectionRequest = { id: number; name: string }

/**
 * `ask(name)` opens the rejection dialog and resolves to the reason, or null when the user cancels.
 * Render `<RejectReasonDialog key={request?.id} request={request} onResolve={resolve} />` once in the page.
 */
export function useRejectionReason() {
  const [request, setRequest] = useState<RejectionRequest | null>(null)
  const waiting = useRef<((reason: string | null) => void) | null>(null)

  // A question left open when the page goes away counts as "cancelled".
  useEffect(() => () => waiting.current?.(null), [])

  const ask = useCallback((name: string) => new Promise<string | null>((done) => {
    waiting.current?.(null)
    waiting.current = done
    setRequest({ id: Date.now(), name })
  }), [])

  const resolve = useCallback((reason: string | null) => {
    waiting.current?.(reason)
    waiting.current = null
    setRequest(null)
  }, [])

  return { ask, request, resolve }
}
