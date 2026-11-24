import type { Side } from './transcriptParse'

/** Sides as colours, the same everywhere in the transcript. */
export const SIDE_TEXT: Record<Side, string> = {
  seller: 'text-[var(--blue-text)]',
  client: 'text-[var(--success-text)]',
  other: 'text-[var(--violet-text)]',
}

/** "00:06": minutes always two digits, like a recorder shows it. */
export const stamp = (seconds: number) => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(Math.floor(safe % 60)).padStart(2, '0')}`
}
