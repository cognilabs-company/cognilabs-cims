import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  CommentAutomationEvent,
  CommentAutomationEventStatus,
  CommentAutomationMedia,
  CommentAutomationMediaListResponse,
  CommentAutomationReplyMode,
  CommentAutomationSettings,
  CommentAutomationSettingsPayload,
} from '../../../../shared/api/services/cognilabsai.service'

export const MEDIA_PAGE_LIMIT = 50
export const BULK_CHUNK_SIZE = 5000
export const EVENTS_PAGE_SIZE = 50
export const PAGE_SIZE_OPTIONS = [12, 24, 48] as const
export const DEFAULT_PAGE_SIZE = 12
export const TEMPLATE_PLACEHOLDERS = ['{username}', '{comment}', '{post_caption}'] as const
export const INSTAGRAM_GRADIENT = 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'

export type SettingsDraft = {
  automation_enabled: boolean
  public_reply_enabled: boolean
  public_reply_mode: CommentAutomationReplyMode
  public_reply_template: string
  dm_enabled: boolean
  dm_mode: CommentAutomationReplyMode
  dm_template: string
  ai_instructions: string
}

export type DraftValidationError = 'no_channel' | 'public_template_empty' | 'dm_template_empty'

export type MediaFilter = 'all' | 'enabled' | 'disabled' | 'attention' | 'post' | 'reel'

export type MediaKind = 'post' | 'reel' | 'video' | 'carousel' | 'story' | 'ad'

export type EventFilter = 'all' | CommentAutomationEventStatus

export type TranslateFn = (key: string, fallback: string, params?: Record<string, string | number>) => string

export type StatusBadgeVariant = 'secondary' | 'outline' | 'blue' | 'success' | 'warning' | 'danger' | 'violet'

export const MEDIA_FILTERS: MediaFilter[] = ['all', 'enabled', 'disabled', 'attention', 'post', 'reel']

export const EVENT_STATUSES: CommentAutomationEventStatus[] = [
  'received',
  'processing',
  'sent',
  'partial',
  'failed',
  'unknown',
  'skipped',
]

export const EVENT_STATUS_BADGE: Record<CommentAutomationEventStatus, StatusBadgeVariant> = {
  received: 'outline',
  processing: 'blue',
  sent: 'success',
  partial: 'violet',
  failed: 'danger',
  unknown: 'warning',
  skipped: 'secondary',
}

export function useCommentAutomationT(): TranslateFn {
  const { t } = useTranslation()

  return useCallback(
    (key: string, fallback: string, params?: Record<string, string | number>) =>
      t(`comment_automation.${key}`, { defaultValue: fallback, ...params }),
    [t],
  )
}

export function getEventStatusLabel(status: string, tx: TranslateFn) {
  switch (status) {
    case 'received':
      return tx('status.received', 'Received')
    case 'processing':
      return tx('status.processing', 'Processing')
    case 'sent':
      return tx('status.sent', 'Sent')
    case 'partial':
      return tx('status.partial', 'Partial')
    case 'failed':
      return tx('status.failed', 'Failed')
    case 'unknown':
      return tx('status.unknown', 'Unknown')
    case 'skipped':
      return tx('status.skipped', 'Skipped')
    default:
      return status
  }
}

export function getEventStatusBadge(status: string): StatusBadgeVariant {
  return EVENT_STATUS_BADGE[status as CommentAutomationEventStatus] ?? 'outline'
}

export function getMediaFilterLabel(filter: MediaFilter, tx: TranslateFn) {
  switch (filter) {
    case 'enabled':
      return tx('filters.enabled', 'Enabled')
    case 'disabled':
      return tx('filters.disabled', 'Disabled')
    case 'attention':
      return tx('filters.attention', 'Needs attention')
    case 'post':
      return tx('filters.post', 'Posts')
    case 'reel':
      return tx('filters.reel', 'Reels')
    default:
      return tx('filters.all', 'All')
  }
}

export function getMediaKind(media: CommentAutomationMedia): MediaKind {
  if (media.media_product_type === 'REELS') return 'reel'
  if (media.media_product_type === 'STORY') return 'story'
  if (media.media_product_type === 'AD') return 'ad'
  if (media.media_type === 'CAROUSEL_ALBUM') return 'carousel'
  if (media.media_type === 'VIDEO') return 'video'
  return 'post'
}

export function getMediaKindLabel(kind: MediaKind, tx: TranslateFn) {
  switch (kind) {
    case 'reel':
      return tx('kind.reel', 'Reel')
    case 'story':
      return tx('kind.story', 'Story')
    case 'ad':
      return tx('kind.ad', 'Ad')
    case 'carousel':
      return tx('kind.carousel', 'Carousel')
    case 'video':
      return tx('kind.video', 'Video')
    default:
      return tx('kind.post', 'Post')
  }
}

export function getPreviewUrl(media: CommentAutomationMedia) {
  if (media.thumbnail_url) return media.thumbnail_url
  if (media.media_type === 'VIDEO') return null
  return media.media_url
}

export function matchesMediaFilter(media: CommentAutomationMedia, filter: MediaFilter) {
  switch (filter) {
    case 'enabled':
      return media.automation_enabled
    case 'disabled':
      return !media.automation_enabled
    case 'attention':
      return (media.automation_stats?.needs_attention ?? 0) > 0
    case 'post':
      return getMediaKind(media) !== 'reel'
    case 'reel':
      return getMediaKind(media) === 'reel'
    default:
      return true
  }
}

export function matchesMediaSearch(media: CommentAutomationMedia, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return (media.caption ?? '').toLowerCase().includes(normalized) || media.media_id.includes(normalized)
}

function normalizeMode(mode: string | null | undefined): CommentAutomationReplyMode {
  return mode === 'template' ? 'template' : 'ai'
}

export function draftFromSettings(settings: CommentAutomationSettings): SettingsDraft {
  return {
    automation_enabled: Boolean(settings.automation_enabled),
    public_reply_enabled: Boolean(settings.public_reply_enabled),
    public_reply_mode: normalizeMode(settings.public_reply_mode),
    public_reply_template: settings.public_reply_template ?? '',
    dm_enabled: Boolean(settings.dm_enabled),
    dm_mode: normalizeMode(settings.dm_mode),
    dm_template: settings.dm_template ?? '',
    ai_instructions: settings.ai_instructions ?? '',
  }
}

export function emptyBulkDraft(): SettingsDraft {
  return {
    automation_enabled: true,
    public_reply_enabled: true,
    public_reply_mode: 'ai',
    public_reply_template: '',
    dm_enabled: true,
    dm_mode: 'ai',
    dm_template: '',
    ai_instructions: '',
  }
}

export function isSameDraft(a: SettingsDraft, b: SettingsDraft) {
  return (Object.keys(a) as Array<keyof SettingsDraft>).every((key) => a[key] === b[key])
}

export function validateDraft(draft: SettingsDraft): DraftValidationError | null {
  if (draft.automation_enabled && !draft.public_reply_enabled && !draft.dm_enabled) return 'no_channel'
  if (draft.public_reply_enabled && draft.public_reply_mode === 'template' && !draft.public_reply_template.trim()) {
    return 'public_template_empty'
  }
  if (draft.dm_enabled && draft.dm_mode === 'template' && !draft.dm_template.trim()) return 'dm_template_empty'
  return null
}

export function getValidationMessage(error: DraftValidationError, tx: TranslateFn) {
  switch (error) {
    case 'no_channel':
      return tx('validation.no_channel', 'Turn on Public reply or DM before enabling automation.')
    case 'public_template_empty':
      return tx('validation.public_template_empty', 'Public reply template cannot be empty.')
    case 'dm_template_empty':
      return tx('validation.dm_template_empty', 'DM template cannot be empty.')
  }
}

export function payloadFromDraft(draft: SettingsDraft): CommentAutomationSettingsPayload {
  return {
    automation_enabled: draft.automation_enabled,
    public_reply_enabled: draft.public_reply_enabled,
    public_reply_mode: draft.public_reply_mode,
    public_reply_template: draft.public_reply_template.trim() || null,
    dm_enabled: draft.dm_enabled,
    dm_mode: draft.dm_mode,
    dm_template: draft.dm_template.trim() || null,
    ai_instructions: draft.ai_instructions.trim() || null,
  }
}

export function getSettingsKey(media: CommentAutomationMedia) {
  return JSON.stringify(draftFromSettings(media))
}

export function getNextCursor(response: CommentAutomationMediaListResponse) {
  return response.has_more && response.next_cursor ? response.next_cursor : null
}

export function appendUniqueMedia(current: CommentAutomationMedia[], incoming: CommentAutomationMedia[]) {
  const seen = new Set(current.map((item) => item.media_id))
  const additions = incoming.filter((item) => !seen.has(item.media_id))
  return additions.length > 0 ? [...current, ...additions] : current
}

export function chunkIds(ids: string[], size: number) {
  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size))
  }
  return chunks
}

export function getEventAlert(event: CommentAutomationEvent): 'failed' | 'unknown' | null {
  const statuses = [event.status, event.public_reply_status, event.dm_status]
  if (statuses.includes('unknown')) return 'unknown'
  if (statuses.includes('failed')) return 'failed'
  return null
}

export function getVisiblePages(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const pages = [1, current - 1, current, current + 1, total]
    .filter((page, index, list) => page >= 1 && page <= total && list.indexOf(page) === index)
    .sort((a, b) => a - b)

  const result: Array<number | 'ellipsis'> = []
  pages.forEach((page, index) => {
    const previous = pages[index - 1]
    if (previous !== undefined && page - previous > 1) result.push('ellipsis')
    result.push(page)
  })
  return result
}
