import type { ConversationItem, MessageItem } from '../../../../shared/api/services/cognilabsai.service'
import type { AppLocale } from '../../../../shared/i18n/translations'
import { monthName, weekdayShortNames } from '../../../../shared/lib/calendarLabels'

export type ChannelTab = 'all' | 'instagram' | 'telegram' | 'website'
export type FollowUpMode = 'global' | 'custom'
export type FollowUpDraft = { enabled: boolean; mode: FollowUpMode; delay_minutes: string; message: string }

export function createFollowUpDraft(conv: ConversationItem | null): FollowUpDraft {
  return {
    enabled: Boolean(conv?.follow_up_enabled),
    mode: conv?.follow_up_mode === 'custom' ? 'custom' : 'global',
    delay_minutes: conv?.follow_up_delay_minutes != null ? String(conv.follow_up_delay_minutes) : '',
    message: conv?.follow_up_message ?? '',
  }
}

export function getClientName(conv: ConversationItem): string {
  return conv.client_display_name || conv.client_full_name || conv.client_username || `#${conv.id}`
}

export function getConversationIdFromChatUrl(value?: string | null) {
  const match = value?.match(/conversation_id=(\d+)/)
  return match ? Number(match[1]) : null
}

export function getConversationTab(channel: string): Exclude<ChannelTab, 'all'> | null {
  if (channel === 'instagram') return 'instagram'
  if (channel === 'telegram') return 'telegram'
  if (channel === 'website_ai' || channel === 'website') return 'website'
  return null
}

function activityTime(conv: ConversationItem): number {
  const value = conv.last_message_at ?? conv.updated_at ?? conv.created_at
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

export function sortConversationsByActivity(conversations: ConversationItem[]): ConversationItem[] {
  return [...conversations].sort((a, b) => activityTime(b) - activityTime(a))
}

export function upsertConversation(conversations: ConversationItem[], next: ConversationItem): ConversationItem[] {
  const exists = conversations.some((conversation) => conversation.id === next.id)
  return sortConversationsByActivity(exists
    ? conversations.map((conversation) => (conversation.id === next.id ? next : conversation))
    : [next, ...conversations])
}

export function getChannelLabel(channel: string) {
  if (channel === 'instagram') return 'Instagram'
  if (channel === 'telegram') return 'Telegram'
  if (channel === 'website_ai' || channel === 'website') return 'Website'
  return channel
}

export function isOnline(conv: { telegram_is_online?: boolean | null; telegram_presence_status?: string | null }) {
  return conv.telegram_is_online === true || conv.telegram_presence_status === 'online'
}

const pad = (value: number) => String(value).padStart(2, '0')
const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

/** Chat list time: "14:05" today, weekday this week, "09.11.26" older — like Telegram. */
export function formatListTime(iso: string | null, locale: AppLocale): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (date.getTime() >= startOfToday) return clock(date)
  if (date.getTime() >= startOfToday - 6 * 86_400_000) return weekdayShortNames(locale)[(date.getDay() + 6) % 7]
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear()).slice(2)}`
}

export function formatMessageTime(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : clock(date)
}

export function dayKey(iso: string) {
  const date = new Date(iso)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/** Date pill: "Bugun" / "Kecha" / "9-noyabr" (adds the year when it isn't this year). */
export function formatDayPill(iso: string, locale: AppLocale, labels: { today: string; yesterday: string }) {
  const date = new Date(iso)
  const now = new Date()
  const start = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const diff = Math.round((start(now) - start(date)) / 86_400_000)
  if (diff === 0) return labels.today
  if (diff === 1) return labels.yesterday
  const year = date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : ''
  if (locale === 'uz') return `${date.getDate()}-${monthName(locale, date.getMonth()).toLowerCase()}${year}`
  if (locale === 'ru') return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', ...(year ? { year: 'numeric' } : {}) }).format(date)
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', ...(year ? { year: 'numeric' } : {}) }).format(date)
}

export type PresenceKind = 'online' | 'recently' | 'week' | 'month' | 'seen' | 'offline' | null

export function presenceOf(status: string | null | undefined, online: boolean | null | undefined, lastSeenAt: string | null | undefined): { kind: PresenceKind; at?: string } {
  if (online === true || status === 'online') return { kind: 'online' }
  if (status === 'recently') return { kind: 'recently' }
  if (status === 'last_week') return { kind: 'week' }
  if (status === 'last_month') return { kind: 'month' }
  if (status === 'offline') {
    if (!lastSeenAt || Number.isNaN(new Date(lastSeenAt).getTime())) return { kind: 'offline' }
    return { kind: 'seen', at: lastSeenAt }
  }
  return { kind: null }
}

const STAGE_LABEL_MAP: Record<string, string> = {
  instagram_media_inquiry: "Instagram so'rovi",
  returned_client: 'Qaytgan mijoz',
  'phone provided': 'Telefon berildi',
  phone_provided: 'Telefon berildi',
  greeted: 'Salomlashildi',
  new: 'Yangi',
  service_interest: 'Xizmatga qiziqdi',
  business_field: 'Sohasini yozdi',
  experience_years: 'Sohadagi yil etildi',
  phone_discussion: 'Telefon orqali muhokama',
  phone_collected: 'Telefon olindi',
  call_time_collected: 'Qulay vaqt olindi',
  name_collected: 'Ism olindi',
  agreement_confirmed: 'Kelishuv tasdiqlandi',
  lead_created: 'Lead yaratildi',
  lost: "Yo'qotildi",
  interested_ai: 'AI qiziqdi',
  interested_crm: 'CRM qiziqdi',
  interested_website: 'Website qiziqdi',
  interested_automation: 'Avtomatika qiziqdi',
  interested_other: 'Boshqa qiziqish',
  phone_received: 'Telefon olindi',
  not_fit: 'Mos emas',
}

export function stageLabel(stage: string | null, label: string | null): string {
  const raw = label || stage || ''
  return STAGE_LABEL_MAP[raw] ?? STAGE_LABEL_MAP[raw.toLowerCase()] ?? raw.replaceAll('_', ' ')
}

export function isStickerMediaType(value?: string | null) {
  return value === 'sticker' || value === 'animated_sticker' || value === 'video_sticker'
}

export function shouldShowStickerCaption(text?: string | null) {
  const normalized = (text ?? '').trim()
  return Boolean(normalized) && !/^\[(?:Animated Sticker|Sticker|Video Sticker).*]$/i.test(normalized)
}

/** Temporary ids for optimistic messages are Date.now() values. */
export function isPendingMessage(msg: MessageItem) {
  return msg.id > 1_000_000_000_000
}

/** Avatar colours (top → bottom gradient) from the site palette, picked from the name. */
const AVATAR_GRADIENTS = [
  ['#6A8BFF', '#2B59FF'], ['#45C983', '#17924A'], ['#FFC15A', '#EA8A1A'], ['#FF8A80', '#E5484D'],
  ['#5CCFF2', '#0EA5E9'], ['#45D2BE', '#14A394'], ['#F58BC1', '#E0458F'], ['#A3ACBE', '#64748B'],
]
export function avatarGradient(seed: string) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  const [from, to] = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
  return `linear-gradient(180deg, ${from} 0%, ${to} 100%)`
}

export function initialsOf(name: string) {
  return name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase() || '?'
}
