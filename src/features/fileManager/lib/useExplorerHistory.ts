import { useCallback, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'

type Entry = { key: string; folderId: string | null }
type HistoryState = { entries: Entry[]; index: number; at: string }

/**
 * Back / Forward of the explorer. The folder lives in the URL, so the explorer's history *is* the
 * browser history of this page: every location this page has seen is remembered by its router key,
 * and Back / Forward just step the browser (the browser's own buttons stay in sync too).
 */
export function useExplorerHistory(folderId: string | null) {
  const location = useLocation()
  const navigationType = useNavigationType()
  const navigate = useNavigate()
  const [history, setHistory] = useState<HistoryState>(() => ({ entries: [{ key: location.key, folderId }], index: 0, at: location.key }))

  let current = history
  if (history.at !== location.key) {
    const entry = { key: location.key, folderId }
    const known = history.entries.findIndex((item) => item.key === location.key)
    if (navigationType === 'POP') {
      current = known >= 0
        ? { ...history, index: known, at: location.key }
        : { entries: [entry], index: 0, at: location.key }
    } else if (navigationType === 'REPLACE') {
      const entries = [...history.entries]
      entries[history.index] = entry
      current = { entries, index: history.index, at: location.key }
    } else {
      const entries = [...history.entries.slice(0, history.index + 1), entry]
      current = { entries, index: entries.length - 1, at: location.key }
    }
    setHistory(current)
  }

  const canBack = current.index > 0
  const canForward = current.index < current.entries.length - 1
  const back = useCallback(() => navigate(-1), [navigate])
  const forward = useCallback(() => navigate(1), [navigate])

  return { canBack, canForward, back, forward }
}
