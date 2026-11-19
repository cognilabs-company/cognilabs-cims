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
export const REJECTION_PRESETS: Array<{ key: string; fallback: string }> = [
  { key: 'customers.reject.preset.price', fallback: 'Price is too high' },
  { key: 'customers.reject.preset.not_needed', fallback: 'Does not need the service now' },
  { key: 'customers.reject.preset.competitor', fallback: 'Chose another company' },
  { key: 'customers.reject.preset.no_budget', fallback: 'No budget' },
  { key: 'customers.reject.preset.no_answer', fallback: 'Stopped answering' },
  { key: 'customers.reject.preset.not_target', fallback: 'Not our target client' },
]

type Translate = (key: string, fallback: string, params?: { count: number }) => string

/** Why the typed reason cannot be saved yet, or null when it is fine. */
export function rejectionReasonError(value: string, t: Translate) {
  const text = value.trim()
  if (!text) return t('customers.reject.required', 'Write why the lead was rejected.')
  if (text.length < MIN_REJECTION_REASON) return t('customers.reject.too_short', 'Write at least {{count}} characters.', { count: MIN_REJECTION_REASON })
  return null
}
