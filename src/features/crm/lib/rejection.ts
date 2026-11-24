/* A lead can only be rejected together with the reason why (task: "Lead Rejected qilinganida, sabab berilishi kerak"). */

const key = (value: string | null | undefined) => (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Only the status named exactly `rejected` (any case) — the backend stores the reason only for that status and
    clears it on any other one, so asking for a reason on look-alike custom statuses would lose it. */
export function isRejectedStatus(status: string | null | undefined) {
  return key(status) === 'rejected'
}

/** Shortest reason the backend gets (a single word like "qimmat" is not enough to learn from). */
export const MIN_REJECTION_REASON = 5

/** Quick picks for the most common reasons; the text can still be edited afterwards. */
/* Task #667: the same categories the CRM sales panel groups rejections by (salesPanel.rejectionKeyOf). "Boshqa" = type your own. */
export const REJECTION_PRESETS: Array<{ key: string; fallback: string }> = [
  { key: 'customers.reject.preset.no_answer', fallback: 'No answer' },
  { key: 'customers.reject.preset.not_fit', fallback: 'Service does not fit' },
  { key: 'customers.reject.preset.by_mistake', fallback: 'Left the form by mistake' },
  { key: 'customers.reject.preset.competitor', fallback: 'Solved it or chose a competitor' },
  { key: 'customers.reject.preset.small_turnover', fallback: 'Turnover too small' },
  { key: 'customers.reject.preset.price', fallback: 'Too expensive' },
]

type Translate = (key: string, fallback: string, params?: { count: number }) => string

/** Why the typed reason cannot be saved yet, or null when it is fine. */
export function rejectionReasonError(value: string, t: Translate) {
  const text = value.trim()
  if (!text) return t('customers.reject.required', 'Write why the lead was rejected.')
  if (text.length < MIN_REJECTION_REASON) return t('customers.reject.too_short', 'Write at least {{count}} characters.', { count: MIN_REJECTION_REASON })
  return null
}
