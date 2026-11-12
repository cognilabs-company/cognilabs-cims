import type { ConversationItem } from '../../../../shared/api/services/cognilabsai.service'
import type { TranslationParams } from '../../../../shared/i18n/translations'

export type StageConfig = { key: string; label: string; tone: string }

export type Translate = (key: string, fallback?: string, params?: TranslationParams) => string

/**
 * One accent per funnel step, mixed from the theme tokens so it reads in light and dark:
 * grey → blues → teal → amber → lime → green (won) … red (lost).
 */
export const STAGE_TONES: string[] = [
  'var(--muted)',
  'color-mix(in srgb, var(--blue-text) 45%, var(--muted))',
  'color-mix(in srgb, var(--blue-text) 75%, var(--muted))',
  'var(--blue-text)',
  'color-mix(in srgb, var(--blue-text) 50%, var(--success-text))',
  'color-mix(in srgb, var(--blue-text) 22%, var(--success-text))',
  'var(--warning-text)',
  'var(--lime-text)',
  'var(--success-text)',
  'color-mix(in srgb, var(--warning-text) 55%, var(--danger-text))',
  'var(--danger-text)',
  'color-mix(in srgb, var(--success-text) 55%, var(--muted))',
  'color-mix(in srgb, var(--blue-text) 60%, var(--success-text))',
  'color-mix(in srgb, var(--danger-text) 70%, var(--muted))',
  'color-mix(in srgb, var(--lime-text) 60%, var(--success-text))',
]

/** Stages the API does not list (and chats with no stage yet): calm accents that never look like "lost" or "won". */
export const EXTRA_STAGE_TONES: string[] = [
  'color-mix(in srgb, var(--blue-text) 60%, var(--success-text))',
  'color-mix(in srgb, var(--warning-text) 70%, var(--muted))',
  'color-mix(in srgb, var(--blue-text) 35%, var(--muted))',
  'color-mix(in srgb, var(--success-text) 55%, var(--muted))',
]

/** Chats the AI has not placed on a stage yet. */
export const NEW_STAGE_TONE = 'var(--muted-strong)'

/** Column well: a faint tint of the text colour, so it sits just off the page canvas in both themes. */
export const COLUMN_SURFACE = 'bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]'

/** Soft background for a tone (pills, strips). */
export function toneTint(tone: string, amount = 14) {
  return `color-mix(in srgb, ${tone} ${amount}%, transparent)`
}

export type ChannelKind = 'instagram' | 'telegram' | 'website'

export function channelKind(channel: string): ChannelKind {
  if (channel === 'instagram' || channel === 'telegram') return channel
  return 'website'
}

/** Channel accents from the tokens: Telegram blue, Instagram rose, website green. */
export const CHANNEL_TONES: Record<ChannelKind, string> = {
  telegram: 'var(--blue-text)',
  instagram: 'color-mix(in srgb, var(--danger-text) 82%, var(--primary))',
  website: 'var(--success-text)',
}

export function channelLabel(kind: ChannelKind, t: Translate) {
  if (kind === 'instagram') return 'Instagram'
  if (kind === 'telegram') return 'Telegram'
  return t('aichat.tab.website', 'Website')
}

/** Initials avatars: soft token tints, picked from the name so a person keeps the same colour. */
const AVATAR_TONES: Array<[string, string]> = [
  ['var(--blue-dim)', 'var(--blue-text)'],
  ['var(--success-dim)', 'var(--success-text)'],
  ['var(--warning-dim)', 'var(--warning-text)'],
  ['var(--lime-dim)', 'var(--lime-text)'],
  ['var(--danger-dim)', 'var(--danger-text)'],
  ['var(--muted-surface)', 'var(--muted-strong)'],
]

export function avatarTone(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

export function initialsOf(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
}

export function getClientName(conv: ConversationItem): string {
  return conv.client_display_name || conv.client_full_name || conv.client_username || `#${conv.id}`
}

/** Short "how long ago" for the card corner: now · 5m · 3h · 2d · 12.03. */
export function formatRelativeTime(iso: string | null, t: Translate): string {
  if (!iso) return ''
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 1) {
    const diffM = Math.floor(diffMs / 60000)
    return diffM < 1 ? t('aikanban.time.now', 'now') : t('aikanban.time.minutes', '{{count}}m', { count: diffM })
  }
  if (diffH < 24) return t('aikanban.time.hours', '{{count}}h', { count: diffH })
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return t('aikanban.time.days', '{{count}}d', { count: diffD })
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })
}
