/* ──────────────────────────────────────────────────────────────
   Telegram bot recipients — the shape shared by /recall-bot and /attendance/notifications.
   Responses are not typed in the OpenAPI schema, so readers are defensive.
   ────────────────────────────────────────────────────────────── */

export type DeliveryStatus = 'unknown' | 'ready' | 'not_started' | 'blocked' | 'error'

export type BotRecipient = {
  id: number
  userId: number | null
  name: string
  email: string | null
  isActive: boolean
  deliveryStatus: DeliveryStatus
  lastError: string | null
  /** When delivery was last checked or a message last went out. */
  lastCheckedAt: string | null
}

export type BotCandidate = {
  userId: number
  name: string
  email: string | null
  recipientId: number | null
  isRecipient: boolean
  deliveryStatus: DeliveryStatus
  telegramReady: boolean
}

/** What the bot-recipient UI needs from a service. */
export type BotRecipientsApi = {
  candidates(search: string): Promise<BotCandidate[]>
  recipients(): Promise<BotRecipient[]>
  addRecipient(userId: number): Promise<unknown>
  setActive(id: number, isActive: boolean): Promise<unknown>
  remove(id: number): Promise<unknown>
  test(id: number): Promise<unknown>
}

export type Dict = Record<string, unknown>
export const asDict = (value: unknown): Dict => (value && typeof value === 'object' ? (value as Dict) : {})
export const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
export const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null)
export const bool = (value: unknown) => (typeof value === 'boolean' ? value : null)

export function listOf(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  const data = asDict(raw)
  for (const key of ['items', 'recipients', 'candidates', 'logs', 'results', 'data']) if (Array.isArray(data[key])) return data[key] as unknown[]
  return []
}

export function deliveryOf(value: unknown): DeliveryStatus {
  return value === 'ready' || value === 'not_started' || value === 'blocked' || value === 'error' ? value : 'unknown'
}

/** "Name Surname" from a flat record or a nested `user`, falling back to email / username. */
export function nameOf(data: Dict): string | null {
  const user = asDict(data.user)
  const full = str(data.full_name) ?? str(user.full_name) ?? str(data.display_name)
  if (full) return full
  const joined = [str(data.name) ?? str(user.name) ?? str(data.first_name), str(data.surname) ?? str(user.surname) ?? str(data.last_name)].filter(Boolean).join(' ')
  return joined || str(data.email) || str(user.email) || str(data.username) || str(user.username)
}

export function normalizeRecipient(raw: unknown): BotRecipient | null {
  const data = asDict(raw)
  const id = num(data.id ?? data.recipient_id)
  if (id === null) return null
  return {
    id,
    userId: num(data.user_id ?? asDict(data.user).id),
    name: nameOf(data) ?? '—',
    email: str(data.email) ?? str(asDict(data.user).email),
    isActive: data.is_active !== false,
    deliveryStatus: deliveryOf(data.delivery_status),
    lastError: str(data.last_error) ?? str(data.error),
    lastCheckedAt: str(data.last_checked_at) ?? str(data.last_sent_at) ?? str(data.last_delivery_at),
  }
}

export function normalizeCandidate(raw: unknown): BotCandidate | null {
  const data = asDict(raw)
  const userId = num(data.user_id ?? data.id)
  if (userId === null) return null
  return {
    userId,
    name: nameOf(data) ?? '—',
    email: str(data.email),
    recipientId: num(data.recipient_id),
    isRecipient: data.is_recipient === true,
    deliveryStatus: deliveryOf(data.delivery_status),
    telegramReady: data.telegram_ready === true || (data.telegram_ready === undefined && Boolean(num(data.chat_id) ?? str(data.chat_id))),
  }
}

export const recipientsOf = (raw: unknown) => listOf(raw).map(normalizeRecipient).filter((item): item is BotRecipient => item !== null)
export const candidatesOf = (raw: unknown) => listOf(raw).map(normalizeCandidate).filter((item): item is BotCandidate => item !== null)
