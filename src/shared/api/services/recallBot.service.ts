import { request } from '../http'
import { asDict, bool, candidatesOf, num, recipientsOf, str, type BotCandidate, type BotRecipient, type Dict } from './botRecipients'

/* ──────────────────────────────────────────────────────────────
   CRM recall bot — /recall-bot (CIMS_RECALL_BOT_FRONTEND.md). CEO only.
   Responses are not typed in the OpenAPI schema, so readers are defensive.
   ────────────────────────────────────────────────────────────── */

export type RecallBotSettings = {
  enabled: boolean
  reminder_minutes: number
  retry_enabled: boolean
  max_retry_attempts: number
  retry_interval_minutes: number
  bot_username: string | null
  updated_at: string | null
}

export type RecallBotSettingsPatch = Partial<Pick<RecallBotSettings, 'enabled' | 'reminder_minutes' | 'retry_enabled' | 'max_retry_attempts' | 'retry_interval_minutes'>>

export type RecallBotStatus = {
  botConfigured: boolean | null
  botUsername: string | null
  schedulerRunning: boolean | null
  activeRecipients: number | null
  sent24h: number | null
  failed24h: number | null
  pendingRetries: number | null
}

export type { DeliveryStatus } from './botRecipients'
export type RecallRecipient = BotRecipient
export type RecallCandidate = BotCandidate

function firstOf<T>(data: Dict, keys: string[], read: (value: unknown) => T | null): T | null {
  for (const key of keys) {
    const value = read(data[key])
    if (value !== null) return value
  }
  return null
}

function normalizeSettings(raw: unknown): RecallBotSettings {
  const data = asDict(raw)
  return {
    enabled: data.enabled === true,
    reminder_minutes: num(data.reminder_minutes) ?? 5,
    retry_enabled: data.retry_enabled === true,
    max_retry_attempts: num(data.max_retry_attempts) ?? 3,
    retry_interval_minutes: num(data.retry_interval_minutes) ?? 2,
    bot_username: str(data.bot_username),
    updated_at: str(data.updated_at),
  }
}

/** Status is described only loosely in the contract: read the usual key names, nested or flat. */
function normalizeStatus(raw: unknown): RecallBotStatus {
  const data = asDict(raw)
  const bot = asDict(data.bot)
  const scheduler = asDict(data.scheduler)
  const stats = { ...asDict(data.last_24h), ...asDict(data.stats), ...asDict(data.last_24_hours) }
  const all = { ...data, ...stats }
  return {
    botConfigured: bool(bot.configured) ?? firstOf(data, ['bot_configured', 'configured', 'token_configured'], bool),
    botUsername: str(bot.username) ?? firstOf(data, ['bot_username', 'username'], str),
    schedulerRunning: bool(scheduler.running) ?? bool(scheduler.enabled) ?? firstOf(data, ['scheduler_running', 'scheduler_enabled', 'scheduler'], bool),
    activeRecipients: firstOf(all, ['active_recipients', 'active_recipient_count', 'active_recipients_count', 'recipients_active'], num),
    sent24h: firstOf(all, ['sent_last_24h', 'sent_24h', 'last_24h_sent', 'sent'], num),
    failed24h: firstOf(all, ['failed_last_24h', 'failed_24h', 'last_24h_failed', 'failed'], num),
    pendingRetries: firstOf(all, ['pending_retries', 'pending_retry_count', 'retries_pending'], num),
  }
}

const recipientPath = (id: number) => `/recall-bot/recipients/${id}`

export const recallBotService = {
  async settings() {
    return normalizeSettings(await request<unknown>({ path: '/recall-bot/settings' }))
  },

  /** Only the changed fields (an empty body is a 422). */
  async updateSettings(patch: RecallBotSettingsPatch) {
    return normalizeSettings(await request<unknown>({ path: '/recall-bot/settings', method: 'PATCH', body: patch }))
  },

  async status() {
    return normalizeStatus(await request<unknown>({ path: '/recall-bot/status' }))
  },

  async candidates(search: string) {
    return candidatesOf(await request<unknown>({ path: '/recall-bot/recipient-candidates', query: { search: search.trim() || undefined } }))
  },

  async recipients() {
    return recipientsOf(await request<unknown>({ path: '/recall-bot/recipients' }))
  },

  /** 201 new / 200 reactivated; 422 when the user has no Telegram chat yet. */
  addRecipient(userId: number) {
    return request<unknown>({ path: '/recall-bot/recipients', method: 'POST', body: { user_id: userId } })
  },

  setActive(id: number, isActive: boolean) {
    return request<unknown>({ path: recipientPath(id), method: 'PATCH', body: { is_active: isActive } })
  },

  remove(id: number) {
    return request<void>({ path: recipientPath(id), method: 'DELETE' })
  },

  /** { status: "ready" } on success; 422 with detail.status = "not_started" when the user never started the bot. */
  test(id: number) {
    return request<unknown>({ path: `${recipientPath(id)}/test`, method: 'POST' })
  },
}
