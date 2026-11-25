import type { Side } from './transcriptParse'

/** Sides as colours, the same everywhere in the transcript. */
export const SIDE_TEXT: Record<Side, string> = {
  seller: 'text-[var(--blue-text)]',
  client: 'text-[var(--success-text)]',
  other: 'text-[var(--violet-text)]',
}

/** Separate bubbles for the two known sides (backend roles), so operator and customer read apart at a glance. */
export const SIDE_BUBBLE: Record<Side, string> = {
  seller: 'border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_7%,var(--muted-surface))]',
  client: 'border-[color-mix(in_srgb,var(--success)_28%,var(--border))] bg-[color-mix(in_srgb,var(--success)_7%,var(--muted-surface))]',
  other: 'border-[var(--border)] bg-[var(--muted-surface)]',
}

/** "00:06": minutes always two digits, like a recorder shows it. */
export const stamp = (seconds: number) => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(Math.floor(safe % 60)).padStart(2, '0')}`
}
