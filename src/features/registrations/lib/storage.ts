/* The applicant's receipt per link: `{ submission_id, edit_token }` (never the password or answers). */

export type StoredReceipt = { submission_id: string; edit_token: string }

const storageKey = (slug: string) => `cims.registration.${slug}`

export function readReceipt(slug: string): StoredReceipt | null {
  try {
    const raw = window.localStorage.getItem(storageKey(slug))
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<StoredReceipt>
    return typeof data.submission_id === 'string' && data.submission_id && typeof data.edit_token === 'string' && data.edit_token
      ? { submission_id: data.submission_id, edit_token: data.edit_token }
      : null
  } catch {
    return null
  }
}

export function saveReceipt(slug: string, receipt: StoredReceipt) {
  try {
    window.localStorage.setItem(storageKey(slug), JSON.stringify({ submission_id: receipt.submission_id, edit_token: receipt.edit_token }))
  } catch {
    /* private mode — the status screen still shows for this visit */
  }
}

export function clearReceipt(slug: string) {
  try {
    window.localStorage.removeItem(storageKey(slug))
  } catch {
    /* ignore */
  }
}
