/* Task #667 data rules applied before a lead is saved (the backend may normalise again; doing it here keeps
   what the manager sees equal to what gets stored). */

/** "'+998 90 123-45-67", "90 123 45 67", "998901234567" → "+998901234567". Anything else is only cleaned of ' and spaces. */
export function normalizePhone(raw: string) {
  const trimmed = raw.trim().replace(/^'+/, '')
  if (!trimmed) return ''
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`
  if (digits.length === 9) return `+998${digits}`
  return trimmed.startsWith('+') ? `+${digits}` : trimmed.replace(/[\s'-]/g, '')
}

/** Facebook Ads / Facebook ads / Meta Ads → "Facebook Ads"; instagram → "Instagram". Other values are kept. */
export function normalizePlatform(raw: string) {
  const value = raw.trim()
  const key = value.toLowerCase().replace(/\s+/g, ' ')
  if (/^(facebook|meta)( ads)?$|^fb( ads)?$/.test(key)) return 'Facebook Ads'
  if (key === 'instagram' || key === 'insta') return 'Instagram'
  if (key === 'telegram') return 'Telegram'
  return value
}

/** Deal amount typed with spaces or separators ("12 500 000") → 12500000, or null when empty/invalid. */
export function parseDealAmount(raw: string) {
  const digits = raw.replace(/[^\d.]/g, '')
  if (!digits) return null
  const amount = Number(digits)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

export function formatDealAmount(value: number | string | null | undefined) {
  const amount = typeof value === 'string' ? Number(value) : value
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return ''
  return Math.round(amount).toLocaleString('ru-RU').replace(/[\u00a0\u202f]/g, ' ')
}

export type PhoneDuplicate = { id: number | null; name: string; status: string | null }

/** Reads /crm/dashboard/phone-check loosely: a list of matches, or a flag with an optional customer. */
export function phoneDuplicates(raw: unknown): PhoneDuplicate[] {
  if (!raw || typeof raw !== 'object') return []
  const source = raw as Record<string, unknown>
  const list = ['duplicates', 'customers', 'matches', 'items', 'results'].map((key) => source[key]).find(Array.isArray) as unknown[] | undefined
  const entries = list ?? (source.exists === true || source.duplicate === true || source.is_duplicate === true
    ? [source.customer ?? source.existing_customer ?? source]
    : [])
  return entries.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object').map((entry) => ({
    id: typeof entry.id === 'number' ? entry.id : typeof entry.customer_id === 'number' ? entry.customer_id : null,
    name: String(entry.full_name ?? entry.name ?? entry.customer_name ?? '').trim(),
    status: typeof entry.status === 'string' ? entry.status : null,
  }))
}
